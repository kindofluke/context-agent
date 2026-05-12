// Per-user session store for Deno Sandbox VMs.
// Keyed by session_id cookie value; max MAX_SESSIONS active at once.

const MAX_SESSIONS = 8;
const SESSION_TTL_MS = 30 * 60 * 1000; // matches Deno Sandbox "30m" timeout

interface SessionEntry {
  url: string;
  // deno-lint-ignore no-explicit-any
  instance: any;
  createdAt: number;
}

const sessions = new Map<string, SessionEntry>();

function sweepExpired() {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export function getSession(id: string): SessionEntry | null {
  sweepExpired();
  return sessions.get(id) ?? null;
}

export function setSession(id: string, url: string, instance: unknown): void {
  sessions.set(id, { url, instance, createdAt: Date.now() });
}

export function clearSession(id: string): void {
  sessions.delete(id);
}

export function isAtCapacity(): boolean {
  sweepExpired();
  return sessions.size >= MAX_SESSIONS;
}

export function allSessions(): IterableIterator<SessionEntry> {
  return sessions.values();
}
