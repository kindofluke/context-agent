from __future__ import annotations

import asyncio
import logging
import logging.config
from typing import AsyncGenerator

import gradio as gr
from fastapi import FastAPI
from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart
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
    """Normalise Gradio content to a plain string.

    Gradio can give us a str, a list of {"type":"text","text":"..."} dicts
    (multimodal format), or a bare dict — flatten all of these to text.
    """
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


def _gradio_history_to_pydantic(
    history: list[dict],
) -> list[ModelRequest | ModelResponse]:
    messages: list[ModelRequest | ModelResponse] = []
    for item in history:
        role = item.get("role") if isinstance(item, dict) else item[0]
        raw_content = item.get("content") if isinstance(item, dict) else item[1]
        metadata = item.get("metadata") if isinstance(item, dict) else None
        # Skip tool-call accordion messages — they're display-only, not real assistant text
        if metadata:
            continue
        if not raw_content:
            continue
        content = _extract_text(raw_content)
        if not content:
            continue
        if role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=content)]))
        elif role == "assistant":
            messages.append(ModelResponse(parts=[TextPart(content=content)]))
    return messages


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
        queue: asyncio.Queue[tuple[str, str] | None] = asyncio.Queue()
        deps = AgentDeps(exec_dir=exec_dir, allowed_domains=domains, tool_calls_queue=queue)
        pydantic_history = _gradio_history_to_pydantic(history)
        logger.info("Converted %d history items → %d pydantic messages", len(history), len(pydantic_history))

        messages: list[dict] = []
        accumulated_text = ""
        text_started = False

        async def run() -> None:
            try:
                logger.info("Agent run_stream starting")
                async with agent.run_stream(
                    message, deps=deps, message_history=pydantic_history
                ) as result:
                    async for delta in result.stream_text(delta=True):
                        logger.debug("Stream delta: %r", delta)
                        await queue.put(("text", delta))
                logger.info("Agent run_stream complete")
            except Exception:
                logger.exception("Agent run_stream failed")
            finally:
                await queue.put(None)

        task = asyncio.create_task(run())

        while True:
            item = await queue.get()
            if item is None:
                break

            kind, value = item
            if kind == "tool_call":
                logger.info("Tool call received from queue")
                messages.append({
                    "role": "assistant",
                    "content": f"```javascript\n{value}\n```",
                    "metadata": {"title": "🔧 execute_js", "status": "pending"},
                })
                yield messages
            elif kind == "text":
                if not text_started:
                    for msg in messages:
                        if msg.get("metadata", {}).get("status") == "pending":
                            msg["metadata"]["status"] = "done"
                    messages.append({"role": "assistant", "content": ""})
                    text_started = True
                accumulated_text += value
                messages[-1] = {"role": "assistant", "content": accumulated_text}
                yield messages

        logger.info("chat_fn stream done, final message count=%d", len(messages))
        yield messages
        await task

    gradio_blocks = gr.ChatInterface(
        fn=chat_fn,
        title="NL Agent",
        description="Chat with your natural language agent",
    )

    gr.mount_gradio_app(app, gradio_blocks, path="/")

    return app
