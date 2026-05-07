from __future__ import annotations

from typing import AsyncGenerator

import gradio as gr
from fastapi import FastAPI
from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart
from pydantic_ai.ui.ag_ui import AGUIAdapter
from starlette.requests import Request
from starlette.responses import Response

from nl_agent.agent import AgentDeps, agent


def _gradio_history_to_pydantic(
    history: list[dict],
) -> list[ModelRequest | ModelResponse]:
    messages: list[ModelRequest | ModelResponse] = []
    for item in history:
        role = item.get("role") if isinstance(item, dict) else item[0]
        content = item.get("content") if isinstance(item, dict) else item[1]
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
    async def run_agent(request: Request) -> Response:
        deps = AgentDeps(exec_dir=exec_dir, allowed_domains=domains)
        return await AGUIAdapter.dispatch_request(request, agent=agent, deps=deps)

    async def chat_fn(
        message: str, history: list[dict]
    ) -> AsyncGenerator[str, None]:
        deps = AgentDeps(exec_dir=exec_dir, allowed_domains=domains)
        pydantic_history = _gradio_history_to_pydantic(history)
        async with agent.run_stream(
            message, deps=deps, message_history=pydantic_history
        ) as result:
            accumulated = ""
            async for delta in result.stream_text(delta=True):
                accumulated += delta
                yield accumulated

    gradio_blocks = gr.ChatInterface(
        fn=chat_fn,
        title="NL Agent",
        description="Chat with your natural language agent",
        type="messages",
    )

    gr.mount_gradio_app(app, gradio_blocks, path="/")

    return app
