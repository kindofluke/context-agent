import { define, getSessionId } from "../../utils.ts";
import { getSession } from "../../sandbox-state.ts";

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
  async GET(ctx) {
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
        JSON.stringify({ files: {} }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

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

    try {
      const upstream = await fetch(`${BACKEND_SERVICE_URL}/files`, {
        method: "GET",
        headers: {
          "x-session-id": sessionId,
          ...authHeaders,
        },
      });

      if (!upstream.ok) {
        console.error("Backend /files returned error:", upstream.status);
        return new Response(
          JSON.stringify({ files: {} }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      const result = await upstream.json();
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to fetch files from backend:", err);
      return new Response(
        JSON.stringify({ files: {} }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
  },
});
