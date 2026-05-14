import { define, getSessionId } from "../../utils.ts";
import { clearSession, getSession } from "../../sandbox-state.ts";

// Backend service URL (set via environment variable)
const BACKEND_SERVICE_URL = Deno.env.get("BACKEND_SERVICE_URL") || "http://localhost:9101";

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
        JSON.stringify({ error: "Sandbox not ready." }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    const body = await ctx.req.text();

    // Get identity token for service-to-service authentication
    const isLocal = BACKEND_SERVICE_URL.includes("localhost") || BACKEND_SERVICE_URL.includes("127.0.0.1");
    let authHeaders: Record<string, string> = {};

    if (!isLocal) {
      const identityToken = await getIdentityToken(BACKEND_SERVICE_URL);
      if (identityToken) {
        authHeaders["Authorization"] = `Bearer ${identityToken}`;
      } else {
        console.warn("Failed to obtain identity token, request may fail on private backend");
      }
    }

    let upstream: Response;
    try {
      upstream = await fetch(`${BACKEND_SERVICE_URL}/update`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-session-id": sessionId,
          ...authHeaders,
        },
        body,
      });
    } catch (err) {
      console.error("Failed to connect to backend service:", err);
      clearSession(sessionId);
      return new Response(
        JSON.stringify({ error: "Update service unavailable." }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    const result = await upstream.json();
    return new Response(JSON.stringify(result), {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  },
});
