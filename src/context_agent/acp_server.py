from __future__ import annotations

import json
import logging
import uuid as uuid_module
from typing import Any

from ag_ui.core import AssistantMessage, EventType, RunAgentInput, UserMessage
from acp import (
    PROTOCOL_VERSION,
    Agent,
    AuthenticateResponse,
    InitializeResponse,
    LoadSessionResponse,
    NewSessionResponse,
    PromptResponse,
    SetSessionModeResponse,
    start_tool_call,
    update_agent_message_text,
    update_tool_call,
)
from acp.interfaces import Client
from acp.schema import (
    AgentCapabilities,
    AudioContentBlock,
    ClientCapabilities,
    EmbeddedResourceContentBlock,
    HttpMcpServer,
    ImageContentBlock,
    Implementation,
    McpServerStdio,
    ResourceContentBlock,
    SseMcpServer,
    TextContentBlock,
)
from pydantic_ai.ui.ag_ui import AGUIAdapter

from context_agent.agent import AgentDeps, agent

logger = logging.getLogger(__name__)


class CtACPAgent(Agent):
    _conn: Client

    def __init__(self, exec_dir: str, allowed_domains: list[str]) -> None:
        self._exec_dir = exec_dir
        self._allowed_domains = allowed_domains
        self._next_session_id = 0
        self._sessions: dict[str, list] = {}

    def on_connect(self, conn: Client) -> None:
        self._conn = conn

    async def initialize(
        self,
        protocol_version: int,
        client_capabilities: ClientCapabilities | None = None,
        client_info: Implementation | None = None,
        **kwargs: Any,
    ) -> InitializeResponse:
        return InitializeResponse(
            protocol_version=PROTOCOL_VERSION,
            agent_capabilities=AgentCapabilities(),
            agent_info=Implementation(name="ct-agent", title="Context Agent", version="0.1.0"),
        )

    async def authenticate(self, method_id: str, **kwargs: Any) -> AuthenticateResponse:
        return AuthenticateResponse()

    async def new_session(
        self,
        cwd: str,
        additional_directories: list[str] | None = None,
        mcp_servers: list[HttpMcpServer | SseMcpServer | McpServerStdio] | None = None,
        **kwargs: Any,
    ) -> NewSessionResponse:
        session_id = str(self._next_session_id)
        self._next_session_id += 1
        self._sessions[session_id] = []
        logger.info("New session: %s", session_id)
        return NewSessionResponse(session_id=session_id, modes=None)

    async def load_session(
        self,
        cwd: str,
        session_id: str,
        additional_directories: list[str] | None = None,
        mcp_servers: list[HttpMcpServer | SseMcpServer | McpServerStdio] | None = None,
        **kwargs: Any,
    ) -> LoadSessionResponse:
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        logger.info("Load session: %s", session_id)
        return LoadSessionResponse()

    async def set_session_mode(
        self, mode_id: str, session_id: str, **kwargs: Any
    ) -> SetSessionModeResponse:
        return SetSessionModeResponse()

    async def cancel(self, session_id: str, **kwargs: Any) -> None:
        pass

    async def prompt(
        self,
        prompt: list[
            TextContentBlock
            | ImageContentBlock
            | AudioContentBlock
            | ResourceContentBlock
            | EmbeddedResourceContentBlock
        ],
        session_id: str,
        message_id: str | None = None,
        **kwargs: Any,
    ) -> PromptResponse:
        logger.info("Prompt for session %s", session_id)

        text = "".join(b.text for b in prompt if isinstance(b, TextContentBlock))

        if session_id not in self._sessions:
            self._sessions[session_id] = []
        history = self._sessions[session_id]
        history.append(UserMessage(id=str(uuid_module.uuid4()), content=text))

        run_input = RunAgentInput(
            thread_id=str(uuid_module.uuid4()),
            run_id=str(uuid_module.uuid4()),
            state={},
            messages=list(history),
            tools=[],
            context=[],
            forwarded_props=None,
        )
        deps = AgentDeps(exec_dir=self._exec_dir, allowed_domains=self._allowed_domains)
        adapter = AGUIAdapter(agent=agent, run_input=run_input)

        full_text = ""
        tool_args_buf: dict[str, str] = {}
        tool_names: dict[str, str] = {}

        try:
            async for event in adapter.run_stream(deps=deps):
                etype = event.type

                if etype == EventType.TEXT_MESSAGE_CONTENT:
                    full_text += event.delta
                    await self._conn.session_update(
                        session_id, update_agent_message_text(event.delta)
                    )

                elif etype == EventType.TOOL_CALL_START:
                    tool_args_buf[event.tool_call_id] = ""
                    tool_names[event.tool_call_id] = event.tool_call_name

                elif etype == EventType.TOOL_CALL_ARGS:
                    tool_args_buf[event.tool_call_id] = (
                        tool_args_buf.get(event.tool_call_id, "") + event.delta
                    )

                elif etype == EventType.TOOL_CALL_END:
                    tid = event.tool_call_id
                    name = tool_names.get(tid, "execute_js")
                    raw_json = tool_args_buf.get(tid, "{}")
                    try:
                        raw_input = json.loads(raw_json)
                    except json.JSONDecodeError:
                        raw_input = {"js_code": raw_json}

                    await self._conn.session_update(
                        session_id,
                        start_tool_call(tid, name, kind="execute", status="in_progress", raw_input=raw_input),
                    )
                    await self._conn.session_update(
                        session_id,
                        update_tool_call(tid, status="completed"),
                    )

                elif etype == EventType.RUN_FINISHED:
                    break

                elif etype == EventType.RUN_ERROR:
                    logger.error("Run error: %s", event.message)
                    await self._conn.session_update(
                        session_id, update_agent_message_text(f"Error: {event.message}")
                    )
                    break

        except Exception:
            logger.exception("Error during ACP prompt for session %s", session_id)

        history.append(AssistantMessage(id=str(uuid_module.uuid4()), content=full_text))
        return PromptResponse(stop_reason="end_turn", user_message_id=message_id)
