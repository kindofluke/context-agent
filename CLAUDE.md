# Natural Language Agent Builder

A ReACT-style agent that reads its goals and context from a local directory and can write its own tools as JavaScript. Users create a directory with a `SystemPrompt.md`, point the CLI at it, and chat — the agent uses Deno to read/write files, call APIs, and persist reusable tools as `.js` modules.

Pydantic-AI docs are available locally at `pydantic-documentation/pydantic-ai/`.

## Source layout

```
src/nl_agent/
  __init__.py     # entry point → calls cli()
  cli.py          # Click CLI: `serve` and `run` commands
  agent.py        # pydantic-ai Agent, AgentDeps, execute_js tool
  execute_js.py   # Deno subprocess runner + embedded built-in JS tools
  serve.py        # FastAPI app: POST /agent (AG-UI) + Gradio UI at /
examples/
  economic-advisor/   # example exec_dir using the FRED API
```

## CLI usage

```bash
# Interactive server (Gradio UI at http://localhost:9101)
nl-agent serve --exec-dir ./my-agent [--allowed-domains api.example.com,other.com] [--port 9101]

# Single-turn run
nl-agent run --exec-dir ./my-agent --prompt "Show me the directory tree"
```

## Creating an agent directory

Minimum: a single `SystemPrompt.md`. Optionally add `.js` files that export functions — they are auto-loaded as globals on every `execute_js` call.

```
my-agent/
  SystemPrompt.md      # loaded as agent instructions every turn
  tools.js             # (optional) agent-authored or hand-written JS tools
```

## Architecture

### Invocation

Each turn the agent receives the user prompt and message history. `AgentDeps` holds `exec_dir` and `allowed_domains`. The system prompt is assembled dynamically: static tool documentation + the contents of `SystemPrompt.md` (missing file is silently ignored).

### Single tool: `execute_js`

The agent writes a JavaScript arrow function string; the Python runtime wraps it in a Deno script and runs it as a subprocess. The tool returns stdout (or stderr with exit code on failure).

```js
// example call from the agent
async () => {
  return await tree(3);
}
```

### Deno environment

Subprocess is launched with:
- `--allow-read=<exec_dir>` — read access scoped to the exec directory
- `--allow-write=<exec_dir>` — write access scoped to the exec directory
- `--deny-read=.env` — blocks reading `.env` files
- `--allow-net=<domains>` — only when `--allowed-domains` is passed
- `--allow-env=NL_PY_*` — only the `NL_PY_` keys present in the Python process env

The runner script is written to `<exec_dir>/_runner_<uuid>.js` (within the allowed-write path) and deleted after execution. Files starting with `_runner_` are never imported as user tools.

**Environment variables:** prefix any env var with `NL_PY_` and the agent can read it via `Deno.env.get('NL_PY_YOUR_VAR')`.

### Built-in globals

Every execution gets these as globals (implemented in `execute_js.py`):

| Function | Description |
|----------|-------------|
| `cat(path)` | Read file contents |
| `find(pattern, dir?)` | Find files by name/substring |
| `grep(text, path)` | Search for text in a file or directory |
| `tree(depth?, dir?)` | Directory tree (default depth 2) |
| `write(path, content)` | Create or overwrite a file |
| `search_and_replace(path, search, replace)` | Edit a file in-place |
| `mkdir(path)` | Create a directory (and parents) |

### Self-extending tools

Any `.js` file in `exec_dir` that exports named functions has those exports injected as globals before the user's arrow function runs. The agent can write its own tool file:

```js
async () => {
  await write('tools.js', `
export async function fetchGDP() {
  const key = Deno.env.get('NL_PY_FRED_API_KEY');
  const res = await fetch(\`https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=\${key}&file_type=json\`);
  return res.json();
}
`);
  return 'tools.js written';
}
```

On the next turn `fetchGDP` is available as a global.

### Server endpoints

- `POST /agent` — AG-UI endpoint, consumed by AG-UI frontend clients
- `GET /` — Gradio chat UI for direct browser testing

## Model configuration

Set these env vars before running:

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=...   # optional, for proxies or compatible providers
export OPENAI_MODEL_NAME=gpt-4o   # default if unset
```

## User journey example (stock trader)

1. Create `stock_trader/SystemPrompt.md` describing the trading strategy
2. `export NL_PY_ALPACA_TOKEN=<your-token>`
3. `nl-agent serve --exec-dir ./stock_trader --allowed-domains paper-api.alpaca.markets`
4. Visit `http://localhost:9101`
5. Ask "Connect to Alpaca and verify the account"
6. Agent calls `tree()` to orient, writes JS to test the Alpaca API, then saves `tools.js` with trading functions
7. On subsequent turns `tools.js` functions are auto-loaded as globals

## Examples

### `examples/economic-advisor`

Uses the FRED API. Requires `NL_PY_FRED_API_KEY`. Ships with `fred-client.js` (a pre-written FRED client that becomes a global) and `fred-openApi.yaml` for the agent to reference.

```bash
export NL_PY_FRED_API_KEY=<your-key>
nl-agent serve --exec-dir examples/economic-advisor --allowed-domains api.stlouisfed.org
```

## Development

```bash
uv add <package>    # add a dependency
uv build            # verify the package builds
uv run nl-agent … # run from the local venv
```

