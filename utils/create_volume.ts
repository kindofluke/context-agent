import { Client, Sandbox } from "@deno/sandbox";

const client = new Client();

const REGION = "ord";


// ── 1. Create a persistent bootable volume ────────────────────────────────────
// Delete any leftover volume from a previous run before creating a fresh one.
try {
  await client.volumes.delete("ct-agent-base");
  console.log("Deleted leftover volume ct-agent-base.");
} catch { /* didn't exist — that's fine */ }

const volume = await client.volumes.create({
  region: REGION,
  slug: "ct-agent-base",
  capacity: "10GiB",
  from: "builtin:debian-13",
});

console.log(`Volume created: ${volume.slug} (${volume.id})`);