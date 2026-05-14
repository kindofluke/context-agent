import logging
import os
from dataclasses import dataclass, field

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from context_agent.execute_js import run_js

logger = logging.getLogger(__name__)


def get_system_instructions(read_only: bool = False) -> str:
    """Generate system instructions based on read-only mode.

    Args:
        read_only: If True, exclude write operations from available tools

    Returns:
        System instruction string for the agent
    """
    if read_only:
        tools_table = """\
| Function | Signature | Description |
|----------|-----------|-------------|
| `cat` | `cat(path)` | Read a file's contents |
| `find` | `find(pattern, dir?)` | List files matching a name/substring pattern |
| `grep` | `grep(text, path)` | Search for text in a file or directory |
| `tree` | `tree(depth?, dir?)` | Show directory tree (default depth 2) |"""

        writing_tools_section = ""
        strategy_note = "This agent is in **read-only mode**. You can inspect files but cannot modify them."
    else:
        tools_table = """\
| Function | Signature | Description |
|----------|-----------|-------------|
| `cat` | `cat(path)` | Read a file's contents |
| `find` | `find(pattern, dir?)` | List files matching a name/substring pattern |
| `grep` | `grep(text, path)` | Search for text in a file or directory |
| `tree` | `tree(depth?, dir?)` | Show directory tree (default depth 2) |
| `write` | `write(path, content)` | Create or overwrite a file |
| `search_and_replace` | `search_and_replace(path, search, replace)` | Edit a file in-place |
| `mkdir` | `mkdir(path)` | Create a directory (and parents) |"""

        writing_tools_section = """
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
"""
        strategy_note = ""

    return f"""\
You are a natural language agent that accomplishes tasks by writing and executing JavaScript.

## Your single tool: `execute_js`

Pass a JavaScript arrow function string. It runs inside Deno and the return value is printed back to you.

**Format:**
```
async () => {{
  // your code here
  return result;
}}
```

## Built-in globals available in every execution

{tools_table}

All paths are relative to the execution directory unless absolute.

## Environment variables

Access `CT_PY_*` or `NL_PY_*` variables via `Deno.env.get('CT_PY_YOUR_VAR')` (both prefixes are supported).
{writing_tools_section}
## Strategy

1. Start by calling `tree()` to orient yourself in the directory.
2. Use `cat()` to read relevant files before acting on them.
3. {"Inspect files and answer questions based on their contents." if read_only else "Build up tools in `tools.js` when you need reusable logic across turns."}
4. Always return a value from your arrow function so the result is visible.

{strategy_note}

## CRITICAL: Tool calls before text

**Never write any text before making a tool call.**
If you need to call `execute_js`, do it immediately — without any preamble.
Save all explanation, reasoning, and summary for your *final* response,
written only after every tool call is complete.

Wrong:
> "Let me search for food price series..."
> [calls execute_js]

Right:
> [calls execute_js]
> "Here are the relevant FRED series I found: ..."
"""


@dataclass
class AgentDeps:
    exec_dir: str
    allowed_domains: list[str] = field(default_factory=list)
    read_only: bool = False


def _make_model() -> OpenAIChatModel:
    return OpenAIChatModel(
        os.environ.get("OPENAI_MODEL_NAME", "gpt-4o"),
        provider=OpenAIProvider(
            base_url=os.environ.get("OPENAI_BASE_URL"),
            api_key=os.environ.get("OPENAI_API_KEY"),
        ),
    )


agent: Agent[AgentDeps, str] = Agent(
    model=_make_model(),
    deps_type=AgentDeps,
)


@agent.instructions
def _get_dynamic_instructions(ctx: RunContext[AgentDeps]) -> str:
    """Load dynamic instructions based on read-only mode."""
    return get_system_instructions(read_only=ctx.deps.read_only)


@agent.instructions
def _load_system_prompt(ctx: RunContext[AgentDeps]) -> str:
    """Load project-specific SystemPrompt.md if it exists."""
    prompt_path = os.path.join(ctx.deps.exec_dir, "SystemPrompt.md")
    try:
        with open(prompt_path) as f:
            return f"\n## Project Instructions (SystemPrompt.md)\n\n{f.read()}"
    except FileNotFoundError:
        return ""


_MAX_RESULT_CHARS = 20_000


@agent.tool
async def execute_js(ctx: RunContext[AgentDeps], js_code: str) -> str:
    """Execute a JavaScript arrow function in the Deno runtime.

    Args:
        js_code: A JavaScript arrow function, e.g. 'async () => { return await tree(); }'

    Returns:
        The stdout output from Deno, or an error message.
    """
    logger.info("execute_js called:\n%s", js_code)
    result = await run_js(
        ctx.deps.exec_dir,
        js_code,
        ctx.deps.allowed_domains,
        read_only=ctx.deps.read_only,
    )
    if len(result) > _MAX_RESULT_CHARS:
        original_len = len(result)
        result = result[:_MAX_RESULT_CHARS] + f"\n... [truncated: {original_len - _MAX_RESULT_CHARS} chars omitted]"
        logger.warning("execute_js result truncated from %d to %d chars", original_len, _MAX_RESULT_CHARS)
    logger.info("execute_js result (%d chars): %s", len(result), result[:200])
    return result
