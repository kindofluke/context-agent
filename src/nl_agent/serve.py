from __future__ import annotations

import asyncio
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
        metadata = item.get("metadata") if isinstance(item, dict) else None
        # Skip tool-call accordion messages — they're display-only, not real assistant text
        if metadata:
            continue
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
        queue: asyncio.Queue[tuple[str, str] | None] = asyncio.Queue()
        deps = AgentDeps(exec_dir=exec_dir, allowed_domains=domains, tool_calls_queue=queue)
        pydantic_history = _gradio_history_to_pydantic(history)

        messages: list[dict] = []
        accumulated_text = ""
        text_started = False

        async def run() -> None:
            async with agent.run_stream(
                message, deps=deps, message_history=pydantic_history
            ) as result:
                async for delta in result.stream_text(delta=True):
                    await queue.put(("text", delta))
            await queue.put(None)

        task = asyncio.create_task(run())

        while True:
            item = await queue.get()
            if item is None:
                break

            kind, value = item
            if kind == "tool_call":
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

        yield messages
        await task

    gradio_blocks = gr.ChatInterface(
        fn=chat_fn,
        title="NL Agent",
        description="Chat with your natural language agent",
    )

    gr.mount_gradio_app(app, gradio_blocks, path="/")

    return app
