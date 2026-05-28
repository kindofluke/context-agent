// run_tool.js

const MCP_SERVER_URL = "<SOME SERVER URL>/mcp";
const TOKEN = Deno.env.get("CT_PY_SOME_SERVER_TOKEN");

if (!TOKEN) {
  console.error("Error: CT_PY_SOME_SERVER_TOKEN environment variable is not set.");
  Deno.exit(1);
}

/**
 * Executes a tool on the MCP server via Streamable HTTP Transport.
 * @param {string} tool_name - The exact name of the MCP tool to execute.
 * @param {object} parameters - A JSON object containing the parameters required by the tool.
 * @returns {Promise<object>} A promise that resolves to the result object from the server.
 */
export async function run_mcp_tool(tool_name, parameters = {}) {
  const token = Deno.env.get("CT_PY_SOME_SERVER_TOKEN");
  if (!token) {
    throw new Error("CT_PY_SOME_SERVER_TOKEN environment variable is not set.");
  }

  const payload = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: {
      name: tool_name,
      arguments: parameters
    }
  };

  const response = await fetch(MCP_SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${token}`,
      "x-datarobot-api-token": token
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`);
  }

  const contentType = response.headers.get("content-type") || "";

  // Process standard JSON response
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (data.error) throw new Error(`MCP Tool Error: ${JSON.stringify(data.error)}`);
    return data.result;
  }

  // Process SSE Streaming response
  if (contentType.includes("text/event-stream")) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentData = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let eolIndex;

      while ((eolIndex = buffer.indexOf('\n')) >= 0) {
        const rawLine = buffer.slice(0, eolIndex);
        buffer = buffer.slice(eolIndex + 1);
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

        if (line.startsWith("data:")) {
          currentData.push(line.slice(5).trimStart());
        } else if (line === "") {
          if (currentData.length > 0) {
            const dataStr = currentData.join('\n');
            currentData = [];

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.id === payload.id) {
                await reader.cancel(); 
                if (parsed.error) throw new Error(`MCP Tool Error: ${JSON.stringify(parsed.error)}`);
                return parsed.result;
              }
            } catch (e) {
              // Ignore unrelated events
            }
          }
        }
      }
    }
    throw new Error("Stream closed before tool execution completed.");
  }

  throw new Error(`Unsupported content type returned: ${contentType}`);
}

// ---------------------------------------------------------
// Example Usage (Can be uncommented for standalone testing)
// ---------------------------------------------------------
// if (import.meta.main) {
//   try {
//     const result = await run_mcp_tool("list_deployments", {});
//     console.log("Tool output:", JSON.stringify(result, null, 2));
//   } catch (err) {
//     console.error(err);
//   }
// }