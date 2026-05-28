import { Client } from "@deno/sandbox";

const client = new Client();
const VOLUME_SLUG = "ct-agent-base"; 

console.log(`Attempting to mount existing volume: ${VOLUME_SLUG} as a data drive...`);

await (async () => {
  // Notice we removed 'root' and are using the 'volumes' object instead
  await using sandbox = await client.sandboxes.create({
    region: "ord",
    volumes: {
      "/data": VOLUME_SLUG 
    }
  });

  console.log(`\n✅ Sandbox ${sandbox.id} booted successfully!`);
  
  // Let's prove we can write to your console-created volume
  await sandbox.sh`echo "Hello from the Sandbox!" > /data/test.txt`;
  await sandbox.sh`cat /data/test.txt`;
})();