import { define, getSessionId } from "../utils.ts";
import Playground from "../islands/Playground.tsx";

// Examples are copied into docs-site/examples/ by the Makefile before build
const ECON_DIR = new URL("../examples/economic-advisor/", import.meta.url).pathname;
const ALLOWED_EXTS = new Set([".js", ".md", ".yaml", ".yml"]);

async function loadAllEconFiles(): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function walk(dir: string, prefix = "") {
    for await (const entry of Deno.readDir(dir)) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        await walk(`${dir}/${entry.name}`, rel);
      } else if (entry.isFile) {
        const dot = entry.name.lastIndexOf(".");
        if (dot !== -1 && ALLOWED_EXTS.has(entry.name.slice(dot))) {
          try {
            files[rel] = await Deno.readTextFile(`${dir}/${entry.name}`);
          } catch { /* skip unreadable */ }
        }
      }
    }
  }

  await walk(ECON_DIR);
  return files;
}

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const filesParam = url.searchParams.get("files");
    const emptyParam = url.searchParams.get("empty");

    const allFiles = await loadAllEconFiles();

    let activeKeys: string[];

    // Check if user wants empty playground
    if (emptyParam === "true" || filesParam === "") {
      activeKeys = [];
    } else if (filesParam) {
      const requested = filesParam.split(",").map((f) => f.trim()).filter(Boolean);
      activeKeys = requested.filter((k) => k in allFiles);
    } else {
      // Default to SystemPrompt.md
      activeKeys = ["SystemPrompt.md"].filter((k) => k in allFiles);
    }

    const initialFiles: Record<string, string> = {};
    const addableFiles: Record<string, string> = {};

    for (const [path, content] of Object.entries(allFiles)) {
      if (activeKeys.includes(path)) {
        initialFiles[path] = content;
      } else {
        addableFiles[path] = content;
      }
    }

    const existingId = getSessionId(ctx.req);
    const sessionId = existingId ?? crypto.randomUUID();

    const renderResp = await ctx.render(<Playground initialFiles={initialFiles} addableFiles={addableFiles} />);
    const headers = new Headers(renderResp.headers);
    headers.set(
      "Set-Cookie",
      `session_id=${sessionId}; Path=/; SameSite=Lax; HttpOnly; Max-Age=7200`,
    );
    return new Response(renderResp.body, { status: renderResp.status, headers });
  },
});
