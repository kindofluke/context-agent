import { App, staticFiles } from "fresh";
import type { State } from "./utils.ts";
import { allSessions } from "./sandbox-state.ts";

export const app = new App<State>();

app.use(staticFiles());
app.fsRoutes();

async function shutdown() {
  for (const session of allSessions()) {
    try {
      await session.instance.kill();
    } catch { /* ignore */ }
  }
  Deno.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  Deno.addSignalListener(signal, () => { shutdown(); });
}
