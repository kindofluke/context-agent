import { define, getSessionId } from "../../utils.ts";
import { clearSession, getSession } from "../../sandbox-state.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const sessionId = getSessionId(ctx.req);
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "No session." }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Sandbox session expired." }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    const body = await ctx.req.text();
    let upstream: Response;
    try {
      upstream = await fetch(`${session.url}/agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
    } catch {
      clearSession(sessionId);
      return new Response(
        JSON.stringify({ error: "Sandbox session expired." }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

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
