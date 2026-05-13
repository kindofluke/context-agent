import { define, getSessionId } from "../../utils.ts";
import { getSession } from "../../sandbox-state.ts";

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
        JSON.stringify({ files: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    try {
      // Use the sandbox to list files in the exec directory
      const result = await session.instance.sh`ls -A /app/economic-advisor`;
      const output = result.stdout || "";
      const files = output.trim().split("\n").filter((f: string) => f && !f.startsWith("_runner_"));

      // Read content of each file
      const fileContents: Record<string, string> = {};
      for (const file of files) {
        try {
          const contentResult = await session.instance.sh`cat /app/economic-advisor/${file}`;
          fileContents[file] = contentResult.stdout || "";
        } catch {
          // If we can't read it, skip it (might be a directory)
          try {
            // Try to list directory contents
            const dirResult = await session.instance.sh`ls -A /app/economic-advisor/${file}`;
            const dirFiles = dirResult.stdout.trim().split("\n").filter((f: string) => f);
            for (const subfile of dirFiles) {
              try {
                const subContentResult = await session.instance.sh`cat /app/economic-advisor/${file}/${subfile}`;
                fileContents[`${file}/${subfile}`] = subContentResult.stdout || "";
              } catch {
                // Skip files we can't read
              }
            }
          } catch {
            // Not a readable directory either
          }
        }
      }

      return new Response(JSON.stringify({ files: fileContents }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Failed to list files", details: (err as Error).message }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  },
});
