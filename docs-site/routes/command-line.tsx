import { define } from "../utils.ts";
import DocLayout from "../components/DocLayout.tsx";

export const handler = define.handlers({
  GET(ctx) {
    return ctx.render(<CommandLinePage />);
  },
});

function CommandLinePage() {
  return (
    <DocLayout currentPath="/command-line">
      <div class="doc-root">
        <header class="doc-header">
          <div class="doc-header-inner">
            <h1 class="doc-title">Using Context Agents</h1>
          </div>
        </header>

        <main class="doc-content">
          <h2>Installation</h2>
          <p>
            Install Context agents (ct-agent) using uv:
          </p>
          <pre><code>uv tool install https://github.com/kindofluke/context-agent</code></pre>
          <p>
            After the installation you can configure your model.
          </p>
          <p>
            Context agents use any OpenAI compatible chat model. Set the following environment variables:
          </p>
          <pre><code>{`export OPENAI_API_KEY=...
export OPENAI_BASE_URL=...
export OPENAI_MODEL_NAME=gpt-4o`}</code></pre>
          <p>
            All three must be set. In the future, we will use <code>litellm</code> to manage connections but for now set all three of these variables.
          </p>

          <h2>CLI Run Command</h2>
          <p>
            Create a new directory for use by your agent:
          </p>
          <pre><code>{`mkdir a_new_agent
cd a_new_agent`}</code></pre>
          <p>
            Now you can invoke the cli:
          </p>
          <pre><code>ct-agent run --exec-dir . --prompt "What tools do you have?"</code></pre>

          <h2>CLI: Serve Command</h2>
          <p>
            You can also run the embedded FastAPI server:
          </p>
          <pre><code>ct-agent server --exec-dir .</code></pre>
          <p>
            This will start a FastAPI server with gradio chat interface at <code>http://localhost:9101/</code>
          </p>
          <p>
            You can also communicate with the server over HTTP. The server communicates using{" "}
            <a href="https://github.com/ag-ui-protocol/ag-ui" target="_blank" rel="noopener noreferrer">
              Ag-UI Event Syntax
            </a>{" "}
            over an SSE stream.
          </p>
          <pre><code>{`curl -X POST http://localhost:9101/agent \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  --no-buffer \\
  -d '{
    "threadId": "thread-001",
    "runId": "run-001",
    "state": {},
    "messages": [{"role": "user", "id": "msg-001", "content": "What tools do you have?"}],
    "tools": [],
    "context": [],
    "forwardedProps": {}
  }'`}</code></pre>

          <h2>ACP Client</h2>
          <p>
            You can also talk to Context Agents via the{" "}
            <a href="https://agentclientprotocol.com/get-started/introduction" target="_blank" rel="noopener noreferrer">
              Agent Client Protocol
            </a>{" "}
            which provides IDE integration and a wide range of{" "}
            <a href="https://agentclientprotocol.com/get-started/clients" target="_blank" rel="noopener noreferrer">
              clients
            </a>{" "}
            like VSCode, and JetBrains IDEs. The directions below are for{" "}
            <a href="https://codecompanion.olimorris.dev/getting-started" target="_blank" rel="noopener noreferrer">
              NeoVim CodeCompanion
            </a>.
          </p>

          <h3>Set up ACP Server</h3>
          <p>
            You can start the ACP server over STDIO using the following command:
          </p>
          <pre><code>ct-agent acp --exec_dir .</code></pre>
          <p>
            If using NeoVim CodeCompanion, add the following to your <code>init.lua</code> which is usually in <code>~/.config/nvim/init.lua</code>:
          </p>
          <pre><code>{`require("codecompanion").setup({
  adapters = {
    acp = {
      ct_agent = function()
        return {
          name = "ct_agent",
          formatted_name = "Context Agent",
          type = "acp",
          roles = { llm = "assistant", user = "user" },
          opts = { vision = false },
          commands = {
            default = {
              "ct-agent", "acp",
              "--exec-dir", vim.fn.getcwd(),
            },
          },
          defaults = { mcpServers = {}, timeout = 30000 },
          parameters = {
            protocolVersion = "2025-03-26",
            clientCapabilities = { roots = {}, sampling = {}, experimental = {} },
            clientInfo = { name = "CodeCompanion.nvim", version = "1.0.0" },
          },
          schema = { model = { default = "ct-agent" } },
          handlers = {
            form_messages = function(self, messages, capabilities)
              local helpers = require("codecompanion.adapters.acp.helpers")
              return helpers.form_messages(self, messages, capabilities)
            end,
          },
        }
      end,
    },
  },
  interactions = {
    chat = { adapter = "ct_agent" },
  },
})`}</code></pre>
        </main>
      </div>
    </DocLayout>
  );
}
