import { define, getSessionId } from "../../utils.ts";
import { clearSession, createSession, getSession, isAtCapacity } from "../../sandbox-state.ts";

// Backend service URL (set via environment variable)
const BACKEND_SERVICE_URL = Deno.env.get("BACKEND_SERVICE_URL") || "http://localhost:9101";

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

/**
 * Fetch Cloud Run identity token from the metadata service for service-to-service auth.
 */
async function getIdentityToken(audience: string): Promise<string | null> {
  try {
    const metadataUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";
    const response = await fetch(`${metadataUrl}?audience=${encodeURIComponent(audience)}`, {
      headers: {
        "Metadata-Flavor": "Google",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch identity token:", response.status, await response.text());
      return null;
    }

    return await response.text();
  } catch (err) {
    console.error("Error fetching identity token:", err);
    return null;
  }
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
