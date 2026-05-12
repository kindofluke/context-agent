import { define } from "../utils.ts";
import Playground from "../islands/Playground.tsx";

const ECON_DIR = new URL("../../examples/economic-advisor/", import.meta.url).pathname;
const ALLOWED_EXTS = new Set([".js", ".md", ".yaml", ".yml"]);

async function loadEconFiles(): Promise<Record<string, string>> {
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
    const files = await loadEconFiles();
    // ctx.render() in Fresh 2.x expects a JSX VNode
    return ctx.render(<Playground initialFiles={files} />);
  },
});
