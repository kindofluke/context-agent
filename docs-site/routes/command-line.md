# Using Context Agents 

## Installation 

Install Contex agents (ct-agent) using uv: 

```
uv tool install https://github.com/kindofluke/context-agent
```
After the installation you can configure your model. 

Context agents use any OpenAI compatible chat model. Set the following environment variables:

```
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=...   
export OPENAI_MODEL_NAME=gpt-4o  
```

All three must be set. In the future, we will use `litellm` to manage connections but for now set all three of these variables. 


## CLI Run Command: 

create a new directory for use by your agent. 

```
mkdir a_new_agent
cd a_new_agent
```

now you can invoke the cli:

```
ct-agent run --exec-dir . --prompt "What tools do you have?" 
```

## CLI: Serve Command

You can also run the embedded FastAPI server. 

```
ct-agent server --exec-dir . 
```

This will start a FastAPI server with gradio chat interface at http://localhost:9101/

You can also communicate with the server HTTP. Ther serve communicates using [Ag-UI Event Syntax](https://github.com/ag-ui-protocol/ag-ui) over an SSE stream.

```bash
curl -X POST http://localhost:9101/agent \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  --no-buffer \
  -d '{
    "threadId": "thread-001",
    "runId": "run-001",
    "state": {},
    "messages": [{"role": "user", "id": "msg-001", "content": "What tools do you have?"}],
    "tools": [],
    "context": [],
    "forwardedProps": {}
  }'
```

# ACP Client

You can also talk to Context Agents via the [Agent Client Protocol](https://agentclientprotocol.com/get-started/introduction) which provides IDE integration a wide range of [clients](https://agentclientprotocol.com/get-started/clients) like VSCode, and JetBrains IDEs. The directions below are for [NeoVim CodeCompanion](https://codecompanion.olimorris.dev/getting-started)

## Set up ACP Server

you can start the ACP server over STDIO using the following command


```
ct-agent acp --exec_dir . 
```

If using NeoVim CodeCompanion, add the following to your `init.lua` which is usually in ~/.config/nvim/init.lua: 

```lua
require("codecompanion").setup({
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
})
```


docs-site/assets/ACP Gif.gif

 