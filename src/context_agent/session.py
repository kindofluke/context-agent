"""Session management utilities for multi-tenant and single-tenant modes."""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

from pydantic import BaseModel
from starlette.requests import Request

logger = logging.getLogger(__name__)

_ALLOWED_EXTENSIONS = {".js", ".yaml", ".yml", ".md"}


class UpdateFileRequest(BaseModel):
    path: str
    content: str


def _get_session_dir(session_id: str, base_dir: Path) -> Path:
    """Get the session directory path for a given session ID."""
    return base_dir / session_id


def _initialize_session_dir(session_dir: Path, template_dir: Path | None, copy_templates: bool = True) -> None:
    """Initialize a session directory by copying template files if provided.

    Args:
        session_dir: Directory to initialize
        template_dir: Source directory for template files
        copy_templates: If False, create directory but don't copy templates (useful for empty playgrounds)
    """
    if session_dir.exists():
        logger.debug("Session directory already exists: %s", session_dir)
        return

    session_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Created session directory: %s", session_dir)

    if copy_templates and template_dir and template_dir.exists():
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
