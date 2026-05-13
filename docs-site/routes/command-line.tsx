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
      <div class="min-h-full bg-white text-slate-800 font-sans">
        <header class="bg-white border-b border-slate-200 py-12 px-8">
          <div class="max-w-4xl mx-auto">
            <h1 class="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              Using Context Agents
            </h1>
          </div>
        </header>

        <main class="py-12 px-8">
          <div class="max-w-4xl mx-auto space-y-6">
            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              Installation
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              Install Context agents (ct-agent) using uv:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900">uv tool install https://github.com/kindofluke/context-agent</code>
            </pre>
            <p class="text-sm leading-relaxed text-slate-700">
              After the installation you can configure your model.
            </p>
            <p class="text-sm leading-relaxed text-slate-700">
              Context agents use any OpenAI compatible chat model. Set the following environment variables:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900 leading-relaxed">{`export OPENAI_API_KEY=...
export OPENAI_BASE_URL=...
export OPENAI_MODEL_NAME=gpt-4o`}</code>
            </pre>
            <p class="text-sm leading-relaxed text-slate-700">
              All three must be set. In the future, we will use <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">litellm</code> to manage connections but for now set all three of these variables.
            </p>

            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              CLI Run Command
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              Create a new directory for use by your agent:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900 leading-relaxed">{`mkdir a_new_agent
cd a_new_agent`}</code>
            </pre>
            <p class="text-sm leading-relaxed text-slate-700">
              Now you can invoke the cli:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900">ct-agent run --exec-dir . --prompt "What tools do you have?"</code>
            </pre>

            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              CLI: Serve Command
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              You can also run the embedded FastAPI server:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900">ct-agent server --exec-dir .</code>
            </pre>
            <p class="text-sm leading-relaxed text-slate-700">
              This will start a FastAPI server with gradio chat interface at <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">http://localhost:9101/</code>
            </p>
            <p class="text-sm leading-relaxed text-slate-700">
              You can also communicate with the server over HTTP. The server communicates using{" "}
              <a href="https://github.com/ag-ui-protocol/ag-ui" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                Ag-UI Event Syntax
              </a>{" "}
              over an SSE stream.
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900 leading-relaxed">{`curl -X POST http://localhost:9101/agent \\
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
  }'`}</code>
            </pre>

            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              ACP Client
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              You can also talk to Context Agents via the{" "}
              <a href="https://agentclientprotocol.com/get-started/introduction" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                Agent Client Protocol
              </a>{" "}
              which provides IDE integration and a wide range of{" "}
              <a href="https://agentclientprotocol.com/get-started/clients" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                clients
              </a>{" "}
              like VSCode, and JetBrains IDEs. The directions below are for{" "}
              <a href="https://codecompanion.olimorris.dev/getting-started" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                NeoVim CodeCompanion
              </a>.
            </p>

            <h3 class="text-lg font-semibold text-slate-900 mt-8 mb-3">
              Set up ACP Server
            </h3>
            <p class="text-sm leading-relaxed text-slate-700">
              You can start the ACP server over STDIO using the following command:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900">ct-agent acp --exec_dir .</code>
            </pre>
            <p class="text-sm leading-relaxed text-slate-700">
              If using NeoVim CodeCompanion, add the following to your <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">init.lua</code> which is usually in <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">~/.config/nvim/init.lua</code>:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900 leading-relaxed">{`require("codecompanion").setup({
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
})`}</code>
            </pre>
          </div>
        </main>
      </div>
    </DocLayout>
  );
}
