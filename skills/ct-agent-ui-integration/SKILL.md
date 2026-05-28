---
name: ct-agent-ui-integration
description: Guide for building UI integrations with the ct-agent server. Use this skill when developers need to build frontends, playgrounds, or custom UIs that interact with the context-agent backend, including file management, session handling, and AG-UI streaming chat.
---

# Building ct-agent UI Integrations

This guide explains how to build a frontend UI that interfaces with the `ct-agent` server. The server provides endpoints for file management and an AG-UI compliant streaming endpoint for agent interactions.

## 1. Session Management

The `ct-agent` server can run in single-tenant or multi-tenant (session) mode. In session mode, all requests must include an `x-session-id` header to isolate file systems and agent context.

**Header Requirement:**
```http
x-session-id: <unique-session-uuid>
```

## 2. File Management Routes

The server provides two main routes for managing the agent's workspace files.

### GET `/files`
Retrieves all allowed files in the current session's workspace.

**Request:**
```http
GET /files
x-session-id: <session-id>
```

**Response:**
```json
{
  "files": {
    "SystemPrompt.md": "...",
    "src/index.js": "..."
  }
}
```

### POST `/update`
Creates or updates a file in the workspace.

**Request:**
```http
POST /update
Content-Type: application/json
x-session-id: <session-id>

{
  "path": "src/index.js",
  "content": "console.log('hello');"
}
```

**Response:**
```json
{
  "updated": "src/index.js"
}
```

## 3. Agent Invocation (AG-UI Protocol)

The agent interaction uses the AG-UI protocol over Server-Sent Events (SSE).

### POST `/agent`
Initiates an agent run.

**Request:**
```http
POST /agent
Content-Type: application/json
x-session-id: <session-id>
X-Read-Only: true  // Optional: prevents the agent from modifying files

{
  "thread_id": "<uuid>",
  "run_id": "<uuid>",
  "state": {},
  "messages": [
    {
      "role": "user",
      "content": "Update the background color to blue",
      "id": "<uuid>"
    }
  ],
  "tools": [],
  "context": [],
  "forwarded_props": null
}
```

### Handling the SSE Stream

The response is a stream of Server-Sent Events (`data: {...}\n\n`). Your UI should parse these events to update the chat interface in real-time.

**Key Event Types:**

1. **`TEXT_MESSAGE_START`**: Agent begins a text response.
   ```json
   {"type": "TEXT_MESSAGE_START", "message_id": "msg-123"}
   ```

2. **`TEXT_MESSAGE_CONTENT`**: Text chunk received. Append to the current message.
   ```json
   {"type": "TEXT_MESSAGE_CONTENT", "message_id": "msg-123", "delta": "I will update "}
   ```

3. **`TOOL_CALL_START`**: Agent starts using a tool (e.g., editing a file).
   ```json
   {"type": "TOOL_CALL_START", "tool_call_id": "call-456", "tool_call_name": "bash"}
   ```

4. **`TOOL_CALL_ARGS`**: Tool arguments chunk received.
   ```json
   {"type": "TOOL_CALL_ARGS", "tool_call_id": "call-456", "delta": "{\"command\": \"ls\"}"}
   ```

5. **`TOOL_CALL_END`**: Tool call finished. You can now parse the full arguments JSON.
   ```json
   {"type": "TOOL_CALL_END", "tool_call_id": "call-456"}
   ```

6. **`RUN_FINISHED`**: The agent run completed successfully.
   ```json
   {"type": "RUN_FINISHED"}
   ```

7. **`RUN_ERROR`**: The agent run failed.
   ```json
   {"type": "RUN_ERROR", "message": "Context length exceeded"}
   ```

## 4. UI Implementation Best Practices

1. **Polling for File Changes**: The agent can modify files during its run. Your UI should poll the `/files` endpoint (e.g., every 2 seconds) while the sandbox is active to reflect agent-driven changes in the file tree.
2. **Read-Only Mode**: Provide a toggle in the UI to send the `X-Read-Only: true` header. This is useful when users want to ask questions about the code without risking unintended modifications.
3. **Tool Call Rendering**: Render tool calls as collapsible blocks in the chat. Show a loading spinner while `TOOL_CALL_START` is active, and display the parsed arguments when `TOOL_CALL_END` is received.
