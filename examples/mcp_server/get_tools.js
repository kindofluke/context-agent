// generate_tools_doc.js

const MCP_SERVER_URL = "<SOME SERVER URL>/mcp";
const TOKEN = Deno.env.get("CT_PY_SOME_SERVER_TOKEN");

if (!TOKEN) {
  console.error("Error: CT_PY_SOME_SERVER_TOKEN environment variable is not set.");
  Deno.exit(1);
}

/**
 * Executes a JSON-RPC POST request that supports both JSON and SSE Stream responses.
 */
async function executeMcpRequest(method, params = undefined) {
  const payload = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method,
    ...(params && { params })
  };

  const response = await fetch(MCP_SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream", // Per documentation
      "Authorization": `Bearer ${TOKEN}`,
      "x-datarobot-api-token": TOKEN // Included just in case DataRobot requires it
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`);
  }

  const contentType = response.headers.get("content-type") || "";

  // CASE 1: Server returned standard JSON
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (data.error) throw new Error(`MCP Error: ${JSON.stringify(data.error)}`);
    return data.result;
  }

  // CASE 2: Server initiated an SSE stream
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
          // Accumulate data lines
          currentData.push(line.slice(5).trimStart());
        } else if (line === "") {
          // Empty line means end of the event
          if (currentData.length > 0) {
            const dataStr = currentData.join('\n');
            currentData = [];

            try {
              const parsed = JSON.parse(dataStr);
              // Wait for the specific response matching our request ID
              if (parsed.id === payload.id) {
                await reader.cancel(); // Close stream immediately
                if (parsed.error) throw new Error(JSON.stringify(parsed.error));
                return parsed.result;
              }
            } catch (e) {
              // Ignore non-JSON pings or notifications we don't care about
            }
          }
        }
      }
    }
    throw new Error("Stream closed before receiving the matching JSON-RPC response.");
  }

  throw new Error(`Unsupported content type returned: ${contentType}`);
}

function generateMarkdown(tools) {
  let md = "# Available MCP Tools\n\n";

  for (const tool of tools) {
    md += `## \`${tool.name}\`\n\n`;
    md += `${tool.description || "*No description provided*"}\n\n`;

    if (tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0) {
      md += "### Parameters\n\n";
      md += "| Name | Type | Description | Required |\n";
      md += "| :--- | :--- | :--- | :--- |\n";

      const props = tool.inputSchema.properties;
      const required = tool.inputSchema.required || [];

      for (const [paramName, paramDetails] of Object.entries(props)) {
        const isReq = required.includes(paramName) ? "**Yes**" : "No";
        const desc = (paramDetails.description || "-").replace(/\n/g, ' '); 
        const type = paramDetails.type || "any";
        md += `| \`${paramName}\` | \`${type}\` | ${desc} | ${isReq} |\n`;
      }
      md += "\n";
    } else {
      md += "*No parameters required.*\n\n";
    }
    md += "---\n\n";
  }

  return md;
}

async function main() {
  try {
    console.log("Fetching tools from MCP server...");
    const result = await executeMcpRequest("tools/list");
    
    if (!result || !result.tools) {
      throw new Error("Invalid response format: 'tools' array missing.");
    }
    
    console.log(`Found ${result.tools.length} tools. Generating markdown...`);
    const markdownContent = generateMarkdown(result.tools);
    
    await Deno.writeTextFile("mcp_tools.md", markdownContent);
    console.log("Successfully generated mcp_tools.md");
    
  } catch (error) {
    console.error("Failed to generate tools documentation:\n", error.message);
  }
}

main();