from __future__ import annotations

import logging
import logging.config
import os
from pathlib import Path

import gradio as gr
from ag_ui.core import RunAgentInput
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic_ai.ui.ag_ui import AGUIAdapter
from starlette.requests import Request
from starlette.responses import Response

from context_agent.agent import AgentDeps, agent
from context_agent.session import (
    UpdateFileRequest,
    _ALLOWED_EXTENSIONS,
    _extract_session_id,
    _get_session_dir,
    _initialize_session_dir,
)
from context_agent.ui import create_gradio_interface

logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"level": "INFO", "handlers": ["console"]},
})

logger = logging.getLogger(__name__)


def _parse_read_only_header(request: Request) -> bool | None:
    """Parse X-Read-Only header from request.

    Returns:
        True if header is present and truthy, False if present and falsy, None if not present
    """
    header_value = request.headers.get("x-read-only")
    if header_value is None:
        return None
    return header_value.lower() in ("true", "1", "yes")


def create_app(
    exec_dir: str | None = None,
    allowed_domains: list[str] | None = None,
    require_signatures: bool = False,
    session_mode: bool = False,
    template_dir: str | None = None,
    read_only_default: bool = False,
) -> FastAPI:
    """Create the FastAPI application.

    Args:
        exec_dir: Agent execution directory (required if not in session_mode)
        allowed_domains: List of domains for Deno network access
        require_signatures: Enable HMAC signature verification (deprecated, use auth at proxy layer)
        session_mode: Enable multi-tenant session mode with per-session directories
        template_dir: Template directory to copy files from when initializing new sessions
        read_only_default: Default read-only mode for single-tenant (ignored in session mode)
    """
    domains = allowed_domains or []

    # In session mode, exec_dir becomes the base sessions directory
    if session_mode:
        sessions_base = Path(exec_dir or "/tmp/sessions").resolve()
        sessions_base.mkdir(parents=True, exist_ok=True)
        template_path = Path(template_dir).resolve() if template_dir else None
        logger.info("Session mode enabled: base_dir=%s, template_dir=%s", sessions_base, template_path)
    else:
        if not exec_dir:
            raise ValueError("exec_dir is required when not in session_mode")
        exec_path = Path(exec_dir).resolve()
        logger.info("Single-tenant mode: exec_dir=%s", exec_path)

    app = FastAPI(title="context-agent")

    # Signature verification has been removed in favor of Cloud Run authentication
    if require_signatures:
        logger.error(
            "Signature verification is no longer supported. "
            "Use Cloud Run IAM or API Gateway authentication instead."
        )
        raise ValueError("require_signatures flag is deprecated and no longer supported")

    # Get URL prefix from environment
    url_prefix = os.getenv("URL_PREFIX", "")
    if url_prefix:
        logger.info("Using URL prefix: %s", url_prefix)

    # Create router for API endpoints
    router = APIRouter()

    @router.post("/agent", include_in_schema=True)
    @router.post("/agent/", include_in_schema=False)
    async def run_agent_endpoint(request: Request) -> Response:
        if session_mode:
            session_id = _extract_session_id(request)
            if not session_id:
                raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

            session_dir = _get_session_dir(session_id, sessions_base)
            _initialize_session_dir(session_dir, template_path)
            session_exec_dir = str(session_dir)
            logger.debug("Using session directory: %s", session_exec_dir)
        else:
            session_exec_dir = exec_dir

        # Determine read-only mode
        # In session mode: only use header (no default)
        # In single-tenant: use header if present, else use default
        read_only_header = _parse_read_only_header(request)
        if session_mode:
            read_only = read_only_header if read_only_header is not None else False
        else:
            read_only = read_only_header if read_only_header is not None else read_only_default

        logger.debug("Read-only mode: %s", read_only)
        deps = AgentDeps(exec_dir=session_exec_dir, allowed_domains=domains, read_only=read_only)
        return await AGUIAdapter.dispatch_request(request, agent=agent, deps=deps)

    @router.post("/init", include_in_schema=True)
    @router.post("/init/", include_in_schema=False)
    async def init_session(request: Request) -> JSONResponse:
        """Initialize session directory without copying template files (for empty playgrounds)."""
        if not session_mode:
            raise HTTPException(status_code=400, detail="Init endpoint only available in session mode")

        session_id = _extract_session_id(request)
        if not session_id:
            raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

        session_dir = _get_session_dir(session_id, sessions_base)
        # Create directory but don't copy templates (copy_templates=False)
        _initialize_session_dir(session_dir, template_path, copy_templates=False)
        logger.info("Initialized empty session directory: %s", session_dir)
        return JSONResponse({"status": "initialized", "session_id": session_id})

    @router.delete("/session", include_in_schema=True)
    @router.delete("/session/", include_in_schema=False)
    async def delete_session(request: Request) -> Response:
        """Delete session directory and all its contents."""
        if not session_mode:
            raise HTTPException(status_code=400, detail="Session endpoint only available in session mode")

        session_id = _extract_session_id(request)
        if not session_id:
            raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

        session_dir = _get_session_dir(session_id, sessions_base)
        if session_dir.exists():
            import shutil
            shutil.rmtree(session_dir)
            logger.info("Deleted session directory: %s", session_dir)
        else:
            logger.debug("Session directory does not exist: %s", session_dir)

        return Response(status_code=204)

    @router.post("/update", include_in_schema=True)
    @router.post("/update/", include_in_schema=False)
    async def update_file(request: Request, body: UpdateFileRequest) -> JSONResponse:
        # Check read-only mode
        read_only_header = _parse_read_only_header(request)
        if session_mode:
            read_only = read_only_header if read_only_header is not None else False
        else:
            read_only = read_only_header if read_only_header is not None else read_only_default

        if read_only:
            raise HTTPException(
                status_code=403,
                detail="Write operations are disabled in read-only mode",
            )

        # Determine the exec directory based on mode
        if session_mode:
            session_id = _extract_session_id(request)
            if not session_id:
                raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

            session_dir = _get_session_dir(session_id, sessions_base)
            _initialize_session_dir(session_dir, template_path)
            current_exec_path = session_dir
        else:
            current_exec_path = exec_path

        # Resolve target path and ensure it stays within exec_dir
        target = (current_exec_path / body.path.lstrip("/")).resolve()
        try:
            target.relative_to(current_exec_path)
        except ValueError:
            raise HTTPException(status_code=400, detail="Path must be within the exec directory")

        if target.suffix.lower() not in _ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Only {', '.join(sorted(_ALLOWED_EXTENSIONS))} files are allowed",
            )

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body.content, encoding="utf-8")
        logger.info("Updated file: %s", target)
        return JSONResponse({"updated": str(target.relative_to(current_exec_path))})

    @router.get("/files", include_in_schema=True)
    @router.get("/files/", include_in_schema=False)
    async def list_files(request: Request) -> JSONResponse:
        # Determine the exec directory based on mode
        if session_mode:
            session_id = _extract_session_id(request)
            if not session_id:
                raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

            session_dir = _get_session_dir(session_id, sessions_base)
            if not session_dir.exists():
                return JSONResponse({"files": {}})
            current_exec_path = session_dir
        else:
            current_exec_path = exec_path

        # List all files in the directory (recursively)
        file_contents: dict[str, str] = {}
        try:
            for item in current_exec_path.rglob("*"):
                if item.is_file() and not item.name.startswith("_runner_"):
                    try:
                        relative_path = item.relative_to(current_exec_path)
                        # Only include allowed extensions
                        if item.suffix.lower() in _ALLOWED_EXTENSIONS:
                            content = item.read_text(encoding="utf-8")
                            file_contents[str(relative_path)] = content
                    except Exception as e:
                        logger.warning("Failed to read file %s: %s", item, e)
                        continue
        except Exception as e:
            logger.error("Failed to list files: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

        return JSONResponse({"files": file_contents})

    # Include router with URL prefix
    app.include_router(router, prefix=url_prefix)

    # Create and mount Gradio interface
    gradio_blocks = create_gradio_interface(
        exec_dir=exec_dir if not session_mode else None,
        allowed_domains=domains,
        session_mode=session_mode,
        sessions_base=sessions_base if session_mode else None,
        template_path=template_path if session_mode else None,
        read_only_default=read_only_default,
    )

    gradio_path = f"{url_prefix}/" if url_prefix else "/"
    gr.mount_gradio_app(app, gradio_blocks, path=gradio_path)

    return app
