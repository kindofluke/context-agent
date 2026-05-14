import { define, getSessionId } from "../../utils.ts";
import { clearSession, createSession, getSession, isAtCapacity } from "../../sandbox-state.ts";

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "connection": "keep-alive",
} as const;

function sseEvent(type: string, message?: string): Uint8Array {
  return new TextEncoder().encode(
    `data: ${JSON.stringify({ type, message })}\n\n`,
  );
}

export const handler = define.handlers({
  POST(ctx) {
    const sessionId = getSessionId(ctx.req);
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "No session." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (getSession(sessionId)) {
      const stream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(sseEvent("STATUS", "Session already initialized"));
          ctrl.enqueue(sseEvent("READY"));
          ctrl.close();
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    if (isAtCapacity()) {
      const stream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(sseEvent("WAITING"));
          ctrl.close();
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    // Create session in state (Cloud Run service is always running)
    createSession(sessionId);

    const stream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(sseEvent("STATUS", "Connecting to agent service..."));
        ctrl.enqueue(sseEvent("READY"));
        ctrl.close();
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  },

  DELETE(ctx) {
    const sessionId = getSessionId(ctx.req);
    if (sessionId) {
      clearSession(sessionId);
    }
    return new Response(null, { status: 204 });
  },
});
