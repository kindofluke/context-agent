import { Client, Sandbox } from "@deno/sandbox";

const client = new Client();

const REGION = "ord";
const WHEEL = "context_agent-0.1.0-py3-none-any.whl";
const VOLUME_ID = "vol_ord_afn00e62naqa12trpw02";



// ── 2. Boot sandbox, install ct-agent, then dispose ───────────────────────────
// Wrapped in an async IIFE so `await using` fully disposes (stops) the sandbox
// before we snapshot the volume below.
await (async () => {
  await using sandbox = await Sandbox.create({
    region: REGION,
  });

  console.log(`\nSandbox ${sandbox.id} ready.`);

  console.log(`\nUploading ${WHEEL}…`);
  await sandbox.fs.upload(`dist/${WHEEL}`, `${WHEEL}`);

  await sandbox.sh`sudo apt-get update -qq`;
  await sandbox.sh`sudo apt-get install -y python3-pip`;

  console.log("\nInstalling ct-agent…");
  await sandbox.sh`python3 -m pip install ${WHEEL} --break-system-packages`;

  console.log("\nVerifying…");
  await sandbox.sh`python3 -m context_agent.cli --help`;
})();
// Volume data is now persisted; sandbox is fully stopped.

// ── 5. Summary ────────────────────────────────────────────────────────────────
const bar = "━".repeat(60);
const sep = "─".repeat(60);
console.log(`\n${bar}`);
console.log(`  DENO SANDBOX SNAPSHOT`);
console.log(bar);

