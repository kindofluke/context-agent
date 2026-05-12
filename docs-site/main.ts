import { App, staticFiles } from "fresh";
import type { State } from "./utils.ts";
import { activeSandboxInstance, clearSandbox } from "./sandbox-state.ts";

export const app = new App<State>();

app.use(staticFiles());
app.fsRoutes();

async function shutdown() {
  const instance = activeSandboxInstance;
  if (instance) {
    clearSandbox();
    try {
      await instance.kill();
    } catch { /* ignore */ }
  }
  Deno.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  Deno.addSignalListener(signal, () => { shutdown(); });
}
