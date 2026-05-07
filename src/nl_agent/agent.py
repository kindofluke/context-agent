import asyncio
import os
from dataclasses import dataclass, field
from typing import Optional

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from nl_agent.execute_js import run_js

STATIC_INSTRUCTIONS = """\
You are a natural language agent that accomplishes tasks by writing and executing JavaScript.

## Your single tool: `execute_js`

Pass a JavaScript arrow function string. It runs inside Deno and the return value is printed back to you.

**Format:**
```
async () => {
  // your code here
  return result;
}
```

## Built-in globals available in every execution

| Function | Signature | Description |
|----------|-----------|-------------|
| `cat` | `cat(path)` | Read a file's contents |
| `find` | `find(pattern, dir?)` | List files matching a name/substring pattern |
| `grep` | `grep(text, path)` | Search for text in a file or directory |
| `tree` | `tree(depth?, dir?)` | Show directory tree (default depth 2) |
| `write` | `write(path, content)` | Create or overwrite a file |
| `search_and_replace` | `search_and_replace(path, search, replace)` | Edit a file in-place |

All paths are relative to the execution directory unless absolute.

## Environment variables

Access `NL_PY_*` variables via `Deno.env.get('NL_PY_YOUR_VAR')`.

## Writing your own tools

Save a JS module to the execution directory:
```
async () => {
  await write('tools.js', `
export async function myTool(arg) {
  // ...
}
`);
  return 'tools.js written';
}
```

On your **next** `execute_js` call, `myTool` will be available as a global.

## Strategy

1. Start by calling `tree()` to orient yourself in the directory.
2. Use `cat()` to read relevant files before acting on them.
3. Build up tools in `tools.js` when you need reusable logic across turns.
4. Always return a value from your arrow function so the result is visible.
"""


@dataclass
class AgentDeps:
    exec_dir: str
    allowed_domains: list[str] = field(default_factory=list)
    tool_calls_queue: Optional[asyncio.Queue] = field(default=None)


def _make_model() -> OpenAIModel:
    return OpenAIModel(
        os.environ.get("OPENAI_MODEL_NAME", "gpt-4o"),
        provider=OpenAIProvider(
            base_url=os.environ.get("OPENAI_BASE_URL"),
            api_key=os.environ.get("OPENAI_API_KEY"),
        ),
    )


agent: Agent[AgentDeps, str] = Agent(
    model=_make_model(),
    deps_type=AgentDeps,
    instructions=STATIC_INSTRUCTIONS,
)


@agent.instructions
def _load_system_prompt(ctx: RunContext[AgentDeps]) -> str:
    prompt_path = os.path.join(ctx.deps.exec_dir, "SystemPrompt.md")
    try:
        with open(prompt_path) as f:
            return f"\n## Project Instructions (SystemPrompt.md)\n\n{f.read()}"
    except FileNotFoundError:
        return ""


@agent.tool
async def execute_js(ctx: RunContext[AgentDeps], js_code: str) -> str:
    """Execute a JavaScript arrow function in the Deno runtime.

    Args:
        js_code: A JavaScript arrow function, e.g. 'async () => { return await tree(); }'

    Returns:
        The stdout output from Deno, or an error message.
    """
    if ctx.deps.tool_calls_queue is not None:
        await ctx.deps.tool_calls_queue.put(("tool_call", js_code))
    return await run_js(ctx.deps.exec_dir, js_code, ctx.deps.allowed_domains)
