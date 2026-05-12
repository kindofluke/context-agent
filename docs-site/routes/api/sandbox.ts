import { Sandbox } from "@deno/sandbox";
import { define } from "../../utils.ts";
import { activeSandbox, clearSandbox, setSandbox } from "../../sandbox-state.ts";

// Requires DENO_DEPLOY_TOKEN env var (Deno Sandbox auth)

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
  async POST(_ctx) {
    if (activeSandbox) {
      const stream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(sseEvent("STATUS", "Sandbox already running"));
          ctrl.enqueue(sseEvent("READY"));
          ctrl.close();
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    const stream = new ReadableStream({
      async start(ctrl) {
        const send = (type: string, msg?: string) => ctrl.enqueue(sseEvent(type, msg));

        try {
          // Collect env vars to pass into sandbox
          const envObj = Deno.env.toObject();
          const env: Record<string, string> = {};
          for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL_NAME", "OPENAI_BASE_URL"]) {
            if (envObj[key]) env[key] = envObj[key];
          }
          for (const [k, v] of Object.entries(envObj)) {
            if (k.startsWith("NL_PY_") || k.startsWith("CT_PY_")) env[k] = v;
          }

          send("STATUS", "Creating sandbox VM...");
          const sandbox = await Sandbox.create({ timeout: "30m", env });

          // Paths: sandbox.ts is at docs-site/routes/api/, project root is 3 levels up
          const projectRoot = new URL("../../../", import.meta.url).pathname;

          send("STATUS", "Uploading context-agent wheel...");
          const WHEEL = "context_agent-0.1.0-py3-none-any.whl";
          await sandbox.fs.upload(`${projectRoot}dist/${WHEEL}`, WHEEL);

          send("STATUS", "Uploading economic-advisor files...");
          const econDir = `${projectRoot}examples/economic-advisor`;
          await sandbox.sh`sudo mkdir -p /app/economic-advisor/GDPUnemployment /app/economic-advisor/ConusumerPricesCostofLiving && sudo chmod -R 777 /app`;

          for (
            const f of [
              "SystemPrompt.md",
              "fred-client.js",
              "fred-openApi.yaml",
              "GDPUnemployment/gdp-unemployment.md",
              "ConusumerPricesCostofLiving/inflation-cola.md",
            ]
          ) {
            await sandbox.fs.upload(`${econDir}/${f}`, `/app/economic-advisor/${f}`);
          }

          send("STATUS", "Installing Python, pip, and Deno...");
          await sandbox.sh`sudo apt-get update -qq && sudo apt-get install -y python3-pip unzip 2>&1`;
          await sandbox.sh`curl -fsSL https://deno.land/x/install/install.sh | sudo DENO_INSTALL=/usr/local sh`;

          send("STATUS", "Installing context-agent...");
          // Hardcoded filename — tagged template interpolation is unreliable for this
          await sandbox.sh`python3 -m pip install context_agent-0.1.0-py3-none-any.whl --break-system-packages -q`;

          send("STATUS", "Starting agent server on port 9101...");
          await sandbox.spawn("python3", {
            args: [
              "-m",
              "context_agent.cli",
              "serve",
              "--exec-dir",
              "/app/economic-advisor",
              "--allowed-domains",
              "api.stlouisfed.org",
              "--port",
              "9101",
            ],
          });

          send("STATUS", "Waiting for server to be ready...");
          let serverReady = false;
          for (let i = 0; i < 40; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            try {
              await sandbox.sh`curl -sf http://localhost:9101/openapi.json -o /dev/null`;
              serverReady = true;
              break;
            } catch { /* not ready yet */ }
          }
          if (!serverReady) throw new Error("Agent server failed to start within 60 seconds");

          send("STATUS", "Exposing HTTP endpoint...");
          const url = await sandbox.exposeHttp({ port: 9101 });
          setSandbox(url.toString(), sandbox);

          send("READY");
        } catch (err) {
          send("ERROR", err instanceof Error ? err.message : String(err));
          clearSandbox();
        } finally {
          ctrl.close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  },

  async DELETE(_ctx) {
    const { activeSandboxInstance } = await import("../../sandbox-state.ts");
    if (activeSandboxInstance) {
      try {
        await activeSandboxInstance.kill();
      } catch { /* ignore */ }
    }
    clearSandbox();
    return new Response(null, { status: 204 });
  },
});
