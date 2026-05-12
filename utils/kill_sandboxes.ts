import { Client, Sandbox } from "@deno/sandbox";

const client = new Client();

const sandboxes = await client.sandboxes.list();

if (sandboxes.length === 0) {
  console.log("No running sandboxes found.");
  Deno.exit(0);
}

console.log(`Found ${sandboxes.length} sandbox(es). Killing…\n`);

let killed = 0;
let failed = 0;

for (const metadata of sandboxes) {
  try {
    const sandbox = await Sandbox.connect(metadata.id);
    await sandbox.kill();
    console.log(`  ✓ Killed ${metadata.id}`);
    killed++;
  } catch (err) {
    console.error(`  ✗ Failed to kill ${metadata.id}: ${err}`);
    failed++;
  }
}

console.log(`\nDone — killed: ${killed}, failed: ${failed}`);
if (failed > 0) Deno.exit(1);
