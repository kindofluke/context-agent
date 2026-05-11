# nl-agent

A natural language agent builder that lets you create AI-powered applications by dropping a `SystemPrompt.md` into a directory. The agent reasons and acts by writing and executing JavaScript in a sandboxed Deno runtime — no Deno installation required, it's bundled with the package.

## Prerequisites

- Python ≥ 3.12
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/)

Deno is bundled in the wheel — no separate install needed.

## Development setup

```bash
make deno-download   # download Deno 2.6.6 for your platform (~100 MB)
make build           # builds the wheel (runs deno-download automatically if needed)
```

Install locally for development:

```bash
uv pip install -e .
```

## Usage

### Start the web UI

```bash
nl-agent serve --exec-dir ./my-agent-dir
```

Options:
- `--exec-dir` *(required)* — path to the agent's working directory
- `--allowed-domains` — comma-separated domains the agent may reach (e.g. `api.alpaca.markets`)
- `--port` — port to listen on (default: `9101`)
- `--host` — host to bind to (default: `0.0.0.0`)

Visit `http://localhost:9101` for the chat interface.

### Single-turn run

```bash
nl-agent run --exec-dir ./my-agent-dir --prompt "Summarise the latest GDP data"
```

## Agent directory conventions

| File / pattern | Purpose |
|----------------|---------|
| `SystemPrompt.md` | Loaded as the agent's system prompt each turn |
| `tools.js` | Agent-authored JS module; exports are available as globals on the next turn |
| `*.js` | Any JS file in the directory is auto-loaded as a module |
| `NL_PY_*` env vars | Passed into the Deno sandbox; access via `Deno.env.get('NL_PY_...')` |

## How it works

The agent has a single tool — `execute_js` — which runs a JavaScript arrow function inside a Deno subprocess. The sandbox has access only to the execution directory and the domains you explicitly allow. Built-in globals (`cat`, `find`, `grep`, `tree`, `write`, `search_and_replace`) let the agent read and write files without leaving JS. The agent can author its own `tools.js` to persist reusable helpers across turns.

## Makefile targets

| Target | Description |
|--------|-------------|
| `make build` | Download Deno if missing, then build the wheel |
| `make deno-download` | Download Deno binary for the current platform |
| `make clean` | Remove `dist/` and the downloaded Deno binary |
