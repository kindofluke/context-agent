// Per-user session store for Cloud Run multi-tenant service.
// Keyed by session_id cookie value; max MAX_SESSIONS active at once.
// Sessions are ephemeral and tracked for rate limiting only.

const MAX_SESSIONS = 100; // Increased capacity for Cloud Run autoscaling
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minute session timeout

interface SessionEntry {
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

export function createSession(id: string): void {
  sessions.set(id, { createdAt: Date.now() });
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
