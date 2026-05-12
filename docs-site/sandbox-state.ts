// Shared singleton state for the active Deno Sandbox.
// Lives at module level so all route handlers in the same process share it.

export interface SandboxInfo {
  url: string;
}

export let activeSandbox: SandboxInfo | null = null;
// deno-lint-ignore no-explicit-any
export let activeSandboxInstance: any = null;

export function setSandbox(url: string, instance: unknown) {
  activeSandbox = { url };
  activeSandboxInstance = instance;
}

export function clearSandbox() {
  activeSandbox = null;
  activeSandboxInstance = null;
}
