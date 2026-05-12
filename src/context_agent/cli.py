import asyncio
import os

import click


@click.group()
def cli() -> None:
    """Context Agent — natural language agent builder."""


@cli.command()
@click.option("--exec-dir", required=True, help="Path to agent execution directory")
@click.option(
    "--allowed-domains",
    default="",
    help="Comma-separated list of domains for Deno network access",
)
@click.option("--port", default=9101, show_default=True, help="Port to listen on")
@click.option("--host", default="0.0.0.0", show_default=True, help="Host to bind to")
def serve(exec_dir: str, allowed_domains: str, port: int, host: str) -> None:
    """Start the context-agent server with web UI."""
    import uvicorn

    from context_agent.serve import create_app

    exec_dir = os.path.realpath(exec_dir)
    if not os.path.isdir(exec_dir):
        raise click.BadParameter(
            f"Directory does not exist: {exec_dir}", param_hint="--exec-dir"
        )

    domains = [d.strip() for d in allowed_domains.split(",") if d.strip()]
    app = create_app(exec_dir=exec_dir, allowed_domains=domains)

    click.echo(f"Starting context-agent at http://{host}:{port}")
    click.echo(f"  exec_dir: {exec_dir}")
    uvicorn.run(app, host=host, port=port)


@cli.command()
@click.option("--exec-dir", required=True, help="Path to agent execution directory")
@click.option("--prompt", required=True, help="User prompt to run")
@click.option(
    "--allowed-domains",
    default="",
    help="Comma-separated list of domains for Deno network access",
)
def run(exec_dir: str, prompt: str, allowed_domains: str) -> None:
    """Run a single prompt through the agent and print the result."""
    from context_agent.agent import AgentDeps, agent

    exec_dir = os.path.realpath(exec_dir)
    if not os.path.isdir(exec_dir):
        raise click.BadParameter(
            f"Directory does not exist: {exec_dir}", param_hint="--exec-dir"
        )

    domains = [d.strip() for d in allowed_domains.split(",") if d.strip()]
    deps = AgentDeps(exec_dir=exec_dir, allowed_domains=domains)

    async def _run() -> str:
        result = await agent.run(prompt, deps=deps)
        return result.output

    print(asyncio.run(_run()))


@cli.command()
@click.option("--exec-dir", required=True, help="Path to agent execution directory")
@click.option(
    "--allowed-domains",
    default="",
    help="Comma-separated list of domains for Deno network access",
)
def acp(exec_dir: str, allowed_domains: str) -> None:
    """Start the ACP stdio server for IDE integration (e.g. NeoVim CodeCompanion)."""
    import asyncio

    from acp import run_agent as acp_run_agent

    from context_agent.acp_server import CtACPAgent

    exec_dir = os.path.realpath(exec_dir)
    if not os.path.isdir(exec_dir):
        raise click.BadParameter(
            f"Directory does not exist: {exec_dir}", param_hint="--exec-dir"
        )

    domains = [d.strip() for d in allowed_domains.split(",") if d.strip()]
    asyncio.run(acp_run_agent(CtACPAgent(exec_dir, domains)))


if __name__ == "__main__":
    cli()
