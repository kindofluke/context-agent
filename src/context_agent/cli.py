import asyncio
import os

import click


@click.group()
def cli() -> None:
    """Context Agent — natural language agent builder."""


@cli.command()
@click.option(
    "--exec-dir",
    default=None,
    help="Path to agent execution directory (or sessions base dir in session-mode)",
)
@click.option(
    "--allowed-domains",
    default="",
    help="Comma-separated list of domains for Deno network access",
)
@click.option("--port", default=9101, show_default=True, help="Port to listen on")
@click.option("--host", default="0.0.0.0", show_default=True, help="Host to bind to")
@click.option(
    "--require-signatures",
    is_flag=True,
    default=False,
    help="Enable HMAC signature verification for /agent requests (deprecated)",
)
@click.option(
    "--session-mode",
    is_flag=True,
    default=False,
    help="Enable multi-tenant session mode with per-session directories",
)
@click.option(
    "--template-dir",
    default=None,
    help="Template directory to copy files from when initializing new sessions (session-mode only)",
)
def serve(
    exec_dir: str | None,
    allowed_domains: str,
    port: int,
    host: str,
    require_signatures: bool,
    session_mode: bool,
    template_dir: str | None,
) -> None:
    """Start the context-agent server with web UI."""
    import uvicorn

    from context_agent.serve import create_app

    # Validate and resolve paths
    if not session_mode:
        if not exec_dir:
            raise click.BadParameter(
                "--exec-dir is required when not using --session-mode", param_hint="--exec-dir"
            )
        exec_dir = os.path.realpath(exec_dir)
        if not os.path.isdir(exec_dir):
            raise click.BadParameter(
                f"Directory does not exist: {exec_dir}", param_hint="--exec-dir"
            )
    else:
        # In session mode, exec_dir is optional (defaults to /tmp/sessions)
        if exec_dir:
            exec_dir = os.path.realpath(exec_dir)
        if template_dir:
            template_dir = os.path.realpath(template_dir)
            if not os.path.isdir(template_dir):
                raise click.BadParameter(
                    f"Template directory does not exist: {template_dir}",
                    param_hint="--template-dir",
                )

    domains = [d.strip() for d in allowed_domains.split(",") if d.strip()]
    app = create_app(
        exec_dir=exec_dir,
        allowed_domains=domains,
        require_signatures=require_signatures,
        session_mode=session_mode,
        template_dir=template_dir,
    )

    click.echo(f"Starting context-agent at http://{host}:{port}")
    if session_mode:
        click.echo(f"  session mode: ENABLED")
        click.echo(f"  sessions base dir: {exec_dir or '/tmp/sessions'}")
        if template_dir:
            click.echo(f"  template dir: {template_dir}")
    else:
        click.echo(f"  exec_dir: {exec_dir}")
    if require_signatures:
        click.echo("  signature verification: ENABLED (deprecated)")
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
