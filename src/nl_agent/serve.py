from __future__ import annotations

import json
import logging
import logging.config
import uuid as uuid_module
from typing import AsyncGenerator

import gradio as gr
from ag_ui.core import AssistantMessage, EventType, RunAgentInput, UserMessage
from fastapi import FastAPI
from pydantic_ai.ui.ag_ui import AGUIAdapter
from starlette.requests import Request
from starlette.responses import Response

from nl_agent.agent import AgentDeps, agent

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


def create_app(exec_dir: str, allowed_domains: list[str] | None = None) -> FastAPI:
    domains = allowed_domains or []

    app = FastAPI(title="nl-agent")

    @app.post("/agent")
    async def run_agent_endpoint(request: Request) -> Response:
        deps = AgentDeps(exec_dir=exec_dir, allowed_domains=domains)
        return await AGUIAdapter.dispatch_request(request, agent=agent, deps=deps)

    async def chat_fn(
        message: str, history: list[dict]
    ) -> AsyncGenerator[list, None]:
        logger.info("chat_fn invoked: message=%r, history_len=%d", message, len(history))

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
        deps = AgentDeps(exec_dir=exec_dir, allowed_domains=domains)
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
