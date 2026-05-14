from __future__ import annotations

import json
import logging
import logging.config
import shutil
import uuid as uuid_module
from pathlib import Path
from typing import AsyncGenerator

import gradio as gr
from ag_ui.core import AssistantMessage, EventType, RunAgentInput, UserMessage
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pydantic_ai.ui.ag_ui import AGUIAdapter
from starlette.requests import Request
from starlette.responses import Response

from context_agent.agent import AgentDeps, agent

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


def _extract_text(content: object) -> str:
    """Normalise Gradio content to a plain string."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item["text"] if isinstance(item, dict) and item.get("type") == "text" else str(item)
            for item in content
        )
    if isinstance(content, dict) and content.get("type") == "text":
        return content["text"]
    return str(content)


def _gradio_history_to_agui(history: list[dict], current_message: str) -> list:
    """Convert Gradio chat history + current message to a list of AG-UI Message objects."""
    msgs = []
    for item in history:
        role = item.get("role") if isinstance(item, dict) else item[0]
        raw_content = item.get("content") if isinstance(item, dict) else item[1]
        metadata = item.get("metadata") if isinstance(item, dict) else None
        if metadata:  # tool-call accordion — display only, not real history
            continue
        if not raw_content:
            continue
        content = _extract_text(raw_content)
        if not content:
            continue
        if role == "user":
            msgs.append(UserMessage(id=str(uuid_module.uuid4()), content=content))
        elif role == "assistant":
            msgs.append(AssistantMessage(id=str(uuid_module.uuid4()), content=content))
    msgs.append(UserMessage(id=str(uuid_module.uuid4()), content=current_message))
    return msgs


_ALLOWED_EXTENSIONS = {".js", ".yaml", ".yml", ".md"}


class UpdateFileRequest(BaseModel):
    path: str
    content: str


def _get_session_dir(session_id: str, base_dir: Path) -> Path:
    """Get the session directory path for a given session ID."""
    return base_dir / session_id


def _initialize_session_dir(session_dir: Path, template_dir: Path | None) -> None:
    """Initialize a session directory by copying template files if provided."""
    if session_dir.exists():
        logger.debug("Session directory already exists: %s", session_dir)
        return

    session_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Created session directory: %s", session_dir)

    if template_dir and template_dir.exists():
        logger.info("Copying template files from %s to %s", template_dir, session_dir)
        for item in template_dir.iterdir():
            if item.is_file():
                shutil.copy2(item, session_dir / item.name)
            elif item.is_dir():
                shutil.copytree(item, session_dir / item.name, dirs_exist_ok=True)
        logger.info("Template files copied successfully")
    else:
        logger.info("No template directory provided or template directory does not exist")


def _extract_session_id(request: Request) -> str | None:
    """Extract session ID from request headers."""
    return request.headers.get("x-session-id")


def create_app(
    exec_dir: str | None = None,
    allowed_domains: list[str] | None = None,
    require_signatures: bool = False,
    session_mode: bool = False,
    template_dir: str | None = None,
) -> FastAPI:
    """Create the FastAPI application.

    Args:
        exec_dir: Agent execution directory (required if not in session_mode)
        allowed_domains: List of domains for Deno network access
        require_signatures: Enable HMAC signature verification (deprecated, use auth at proxy layer)
        session_mode: Enable multi-tenant session mode with per-session directories
        template_dir: Template directory to copy files from when initializing new sessions
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

    @app.post("/agent")
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

        deps = AgentDeps(exec_dir=session_exec_dir, allowed_domains=domains)
        return await AGUIAdapter.dispatch_request(request, agent=agent, deps=deps)

    @app.post("/update")
    async def update_file(request: Request, body: UpdateFileRequest) -> JSONResponse:
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

    @app.get("/files")
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

    async def chat_fn(
        message: str, history: list[dict]
    ) -> AsyncGenerator[list, None]:
        logger.info("chat_fn invoked: message=%r, history_len=%d", message, len(history))

        # In session mode, create a temporary Gradio session
        if session_mode:
            gradio_session_id = f"gradio-{uuid_module.uuid4()}"
            session_dir = _get_session_dir(gradio_session_id, sessions_base)
            _initialize_session_dir(session_dir, template_path)
            gradio_exec_dir = str(session_dir)
            logger.info("Created temporary Gradio session: %s", gradio_session_id)
        else:
            gradio_exec_dir = exec_dir

        ag_ui_messages = _gradio_history_to_agui(history, message)
        logger.info("Built %d AG-UI messages", len(ag_ui_messages))

        run_input = RunAgentInput(
            thread_id=str(uuid_module.uuid4()),
            run_id=str(uuid_module.uuid4()),
            state={},
            messages=ag_ui_messages,
            tools=[],
            context=[],
            forwarded_props=None,
        )
        deps = AgentDeps(exec_dir=gradio_exec_dir, allowed_domains=domains)
        adapter = AGUIAdapter(agent=agent, run_input=run_input)

        gradio_messages: list[dict] = []
        text_msg_index: dict[str, int] = {}  # message_id -> index in gradio_messages
        tool_args_buf: dict[str, str] = {}   # tool_call_id -> accumulated JSON args
        tool_msg_index: dict[str, int] = {}  # tool_call_id -> index in gradio_messages

        try:
            async for event in adapter.run_stream(deps=deps):
                etype = event.type
                logger.debug("AG-UI event: %s", etype)

                if etype == EventType.TEXT_MESSAGE_START:
                    logger.info("Text message start: id=%s", event.message_id)
                    for msg in gradio_messages:
                        if msg.get("metadata", {}).get("status") == "pending":
                            msg["metadata"]["status"] = "done"
                    text_msg_index[event.message_id] = len(gradio_messages)
                    gradio_messages.append({"role": "assistant", "content": ""})

                elif etype == EventType.TEXT_MESSAGE_CONTENT:
                    idx = text_msg_index.get(event.message_id)
                    if idx is not None:
                        gradio_messages[idx]["content"] += event.delta
                        yield gradio_messages

                elif etype == EventType.TOOL_CALL_START:
                    logger.info("Tool call start: %s (id=%s)", event.tool_call_name, event.tool_call_id)
                    tool_args_buf[event.tool_call_id] = ""
                    tool_msg_index[event.tool_call_id] = len(gradio_messages)
                    gradio_messages.append({
                        "role": "assistant",
                        "content": "",
                        "metadata": {"title": f"🔧 {event.tool_call_name}", "status": "pending"},
                    })
                    yield gradio_messages

                elif etype == EventType.TOOL_CALL_ARGS:
                    tool_args_buf[event.tool_call_id] = tool_args_buf.get(event.tool_call_id, "") + event.delta

                elif etype == EventType.TOOL_CALL_END:
                    tid = event.tool_call_id
                    logger.info("Tool call end: id=%s", tid)
                    idx = tool_msg_index.get(tid)
                    if idx is not None:
                        try:
                            args = json.loads(tool_args_buf.get(tid, "{}"))
                            js_code = args.get("js_code", tool_args_buf.get(tid, ""))
                        except (json.JSONDecodeError, KeyError):
                            js_code = tool_args_buf.get(tid, "")
                        gradio_messages[idx]["content"] = f"```javascript\n{js_code}\n```"
                        yield gradio_messages

                elif etype == EventType.RUN_FINISHED:
                    logger.info("Run finished")
                    break

                elif etype == EventType.RUN_ERROR:
                    logger.error("Run error: %s", event.message)
                    gradio_messages.append({"role": "assistant", "content": f"Error: {event.message}"})
                    break

        except Exception:
            logger.exception("chat_fn failed")

        yield gradio_messages

    gradio_blocks = gr.ChatInterface(
        fn=chat_fn,
        title="NL Agent",
        description="Chat with your natural language agent",
    )

    gr.mount_gradio_app(app, gradio_blocks, path="/")

    return app
