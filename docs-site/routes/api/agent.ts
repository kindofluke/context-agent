import { define } from "../../utils.ts";
import { activeSandbox } from "../../sandbox-state.ts";

export const handler = define.handlers({
  async POST(ctx) {
    if (!activeSandbox) {
      return new Response(
        JSON.stringify({ error: "Sandbox not ready. Boot the playground first." }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    const body = await ctx.req.text();
    const upstream = await fetch(`${activeSandbox.url}/agent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
        "connection": "keep-alive",
      },
    });
  },
});
