import { define } from "../../utils.ts";
import { activeSandbox } from "../../sandbox-state.ts";

export const handler = define.handlers({
  async POST(ctx) {
    if (!activeSandbox) {
      return new Response(
        JSON.stringify({ error: "Sandbox not ready." }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    const body = await ctx.req.text();
    const upstream = await fetch(`${activeSandbox.url}/update`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    const result = await upstream.json();
    return new Response(JSON.stringify(result), {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  },
});
