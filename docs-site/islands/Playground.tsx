import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";

// ── Types ────────────────────────────────────────────

type SandboxState = "idle" | "booting" | "ready" | "error" | "expired" | "waiting";

type UserBlock = { kind: "user"; id: string; content: string };
type TextBlock = { kind: "text"; id: string; content: string; done: boolean };
type ToolBlock = { kind: "tool"; id: string; name: string; args: string; done: boolean };
type ChatBlock = UserBlock | TextBlock | ToolBlock;

type AgMsg = { role: "user" | "assistant"; content: string; id: string };

// ── File tree helpers ────────────────────────────────

interface TreeDir {
  name: string;
  items: string[];
}

function buildTree(paths: string[]): { roots: string[]; dirs: TreeDir[] } {
  const roots: string[] = [];
  const dirMap = new Map<string, string[]>();

  for (const p of paths) {
    const slash = p.indexOf("/");
    if (slash === -1) {
      roots.push(p);
    } else {
      const dir = p.slice(0, slash);
      const file = p.slice(slash + 1);
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push(file);
    }
  }

  const dirs: TreeDir[] = [];
  for (const [name, items] of dirMap) {
    dirs.push({ name, items: items.sort() });
  }

  return { roots: roots.sort(), dirs };
}

function fileIcon(name: string): { icon: string; cls: string } {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "js") return { icon: "JS", cls: "file-icon--js" };
  if (ext === "md") return { icon: "MD", cls: "file-icon--md" };
  if (ext === "yaml" || ext === "yml") return { icon: "YML", cls: "file-icon--yaml" };
  return { icon: "·", cls: "" };
}

function getAddLabel(path: string): string {
  if (path === "SystemPrompt.md") return "Add a System Prompt";
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "yaml" || ext === "yml") return "Add a web service";
  if (ext === "js") return "Add Tools with JS";
  return "Add more Context";
}

const RETRY_SECONDS = 15;

// ── Component ────────────────────────────────────────

interface Props {
  initialFiles: Record<string, string>;
  addableFiles?: Record<string, string>;
}

export default function Playground({ initialFiles, addableFiles }: Props) {
  const sandboxState = useSignal<SandboxState>("idle");
  const bootLog = useSignal<string[]>([]);
  const retryCountdown = useSignal<number>(0);
  const fileContents = useSignal<Record<string, string>>({ ...initialFiles });
  const addable = useSignal<Record<string, string>>(addableFiles ?? {});
  const selectedFile = useSignal<string | null>(null);
  const editedContent = useSignal<string>("");
  const isDirty = useSignal(false);
  const isSaving = useSignal(false);
  const saveStatus = useSignal<"" | "saved" | "error">("");
  const saveMsg = useSignal<string>("");
  const isAdding = useSignal(false);
  const blocks = useSignal<ChatBlock[]>([]);
  const agMsgs = useSignal<AgMsg[]>([]);
  const inputText = useSignal<string>("");
  const isStreaming = useSignal(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bootSandbox();
    return () => { clearRetryTimer(); };
  }, []);

  // Scroll chat to bottom whenever blocks change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  function clearRetryTimer() {
    if (retryTimerRef.current !== null) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }

  function startRetryCountdown() {
    clearRetryTimer();
    retryCountdown.value = RETRY_SECONDS;
    retryTimerRef.current = setInterval(() => {
      retryCountdown.value -= 1;
      if (retryCountdown.value <= 0) {
        clearRetryTimer();
        bootSandbox();
      }
    }, 1000);
  }

  // ── Sandbox boot ──────────────────────────────────

  async function bootSandbox() {
    clearRetryTimer();
    sandboxState.value = "booting";
    bootLog.value = [];

    try {
      const resp = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: Object.keys(initialFiles) }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "STATUS") {
              bootLog.value = [...bootLog.value, ev.message ?? ""];
            } else if (ev.type === "READY") {
              sandboxState.value = "ready";
              if (!selectedFile.value) {
                const key = "SystemPrompt.md";
                if (fileContents.value[key] !== undefined) selectFile(key);
              }
            } else if (ev.type === "WAITING") {
              sandboxState.value = "waiting";
              startRetryCountdown();
            } else if (ev.type === "ERROR") {
              bootLog.value = [...bootLog.value, `ERROR: ${ev.message ?? "unknown"}`];
              sandboxState.value = "error";
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      bootLog.value = [...bootLog.value, `Connection error: ${(err as Error).message}`];
      sandboxState.value = "error";
    }
  }

  // ── File tree ─────────────────────────────────────

  function selectFile(path: string) {
    selectedFile.value = path;
    editedContent.value = fileContents.value[path] ?? "";
    isDirty.value = false;
    saveStatus.value = "";
  }

  // ── File save ─────────────────────────────────────

  async function saveFile() {
    if (!selectedFile.value || !isDirty.value || isSaving.value) return;
    isSaving.value = true;
    saveStatus.value = "";

    try {
      const resp = await fetch("/api/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: selectedFile.value, content: editedContent.value }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.detail ?? err.error ?? "Save failed");
      }
      fileContents.value = { ...fileContents.value, [selectedFile.value]: editedContent.value };
      isDirty.value = false;
      saveStatus.value = "saved";
      saveMsg.value = "saved";
      setTimeout(() => { saveStatus.value = ""; }, 2500);
    } catch (err) {
      saveStatus.value = "error";
      saveMsg.value = (err as Error).message;
    } finally {
      isSaving.value = false;
    }
  }

  // ── Add file from addable set ─────────────────────

  async function addFile(path: string) {
    if (isAdding.value || !path) return;
    const content = addable.value[path];
    if (content === undefined) return;

    isAdding.value = true;
    try {
      const resp = await fetch("/api/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.detail ?? err.error ?? "Add failed");
      }
      fileContents.value = { ...fileContents.value, [path]: content };
      const next = { ...addable.value };
      delete next[path];
      addable.value = next;
      selectFile(path);
    } catch (err) {
      console.error("Failed to add file:", err);
    } finally {
      isAdding.value = false;
    }
  }

  // ── Chat ──────────────────────────────────────────

  async function sendMessage() {
    const text = inputText.value.trim();
    if (!text || isStreaming.value) return;

    inputText.value = "";
    isStreaming.value = true;

    const userId = crypto.randomUUID();
    const newBlock: UserBlock = { kind: "user", id: userId, content: text };
    blocks.value = [...blocks.value, newBlock];

    const newAgMsg: AgMsg = { role: "user", content: text, id: userId };
    const msgs: AgMsg[] = [...agMsgs.value, newAgMsg];
    agMsgs.value = msgs;

    try {
      const resp = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread_id: crypto.randomUUID(),
          run_id: crypto.randomUUID(),
          state: {},
          messages: msgs,
          tools: [],
          context: [],
          forwarded_props: null,
        }),
      });
      if (resp.status === 503) {
        sandboxState.value = "expired";
        isStreaming.value = false;
        return;
      }
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      const textIdx: Record<string, number> = {};
      const toolIdx: Record<string, number> = {};
      const toolBuf: Record<string, string> = {};
      let cur = [...blocks.value];
      let streamFinished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }

          const t = ev.type as string;

          if (t === "TEXT_MESSAGE_START") {
            const id = ev.message_id as string;
            textIdx[id] = cur.length;
            const b: TextBlock = { kind: "text", id, content: "", done: false };
            cur = [...cur, b];
            blocks.value = cur;

          } else if (t === "TEXT_MESSAGE_CONTENT") {
            const id = ev.message_id as string;
            const idx = textIdx[id];
            if (idx !== undefined) {
              const old = cur[idx] as TextBlock;
              const updated: TextBlock = { ...old, content: old.content + (ev.delta as string) };
              cur = cur.map((b, i) => i === idx ? updated : b);
              blocks.value = cur;
            }

          } else if (t === "TOOL_CALL_START") {
            const id = ev.tool_call_id as string;
            toolIdx[id] = cur.length;
            toolBuf[id] = "";
            const b: ToolBlock = { kind: "tool", id, name: ev.tool_call_name as string, args: "", done: false };
            cur = [...cur, b];
            blocks.value = cur;

          } else if (t === "TOOL_CALL_ARGS") {
            const id = ev.tool_call_id as string;
            toolBuf[id] = (toolBuf[id] ?? "") + (ev.delta as string);

          } else if (t === "TOOL_CALL_END") {
            const id = ev.tool_call_id as string;
            const idx = toolIdx[id];
            if (idx !== undefined) {
              let args = toolBuf[id] ?? "";
              try {
                const parsed = JSON.parse(args) as Record<string, string>;
                args = parsed.js_code ?? args;
              } catch { /* keep raw */ }
              const old = cur[idx] as ToolBlock;
              cur = cur.map((b, i) => i === idx ? { ...old, args, done: true } : b);
              blocks.value = cur;
            }

          } else if (t === "RUN_FINISHED") {
            streamFinished = true;
            const assistantText = Object.keys(textIdx)
              .map((id) => {
                const idx = textIdx[id];
                return (cur[idx] as TextBlock | undefined)?.content ?? "";
              })
              .filter(Boolean)
              .join("\n");
            if (assistantText) {
              agMsgs.value = [...agMsgs.value, { role: "assistant", content: assistantText, id: crypto.randomUUID() }];
            }
            cur = cur.map((b) => b.kind === "text" ? { ...b, done: true } : b);
            blocks.value = cur;
            isStreaming.value = false;
            break;

          } else if (t === "RUN_ERROR") {
            streamFinished = true;
            const errId = crypto.randomUUID();
            const errBlock: TextBlock = { kind: "text", id: errId, content: `Error: ${ev.message ?? "unknown"}`, done: true };
            cur = [...cur, errBlock];
            blocks.value = cur;
            isStreaming.value = false;
            break;
          }
        }
      }
      if (!streamFinished) {
        sandboxState.value = "expired";
        isStreaming.value = false;
      }
    } catch {
      sandboxState.value = "expired";
      isStreaming.value = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Render ────────────────────────────────────────

  const state = sandboxState.value;
  const sortedPaths = Object.keys(fileContents.value).sort();
  const { roots, dirs } = buildTree(sortedPaths);
  const addableKeys = Object.keys(addable.value);

  return (
    <div class="app-root">
      {/* Header */}
      <header class="app-header">
        <span class="app-header-title">context-agent</span>
        <span class="app-header-sep">/</span>
        <span class="app-header-subtitle">economic advisor playground</span>
        <div class="app-header-right">
          {state === "ready" && <span class="status-dot status-dot--ready" title="Sandbox running" />}
          {(state === "booting" || state === "waiting") && <span class="status-dot status-dot--booting" title={state === "waiting" ? "Waiting for slot…" : "Booting…"} />}
          {(state === "error" || state === "expired") && <span class="status-dot status-dot--error" title={state === "expired" ? "Session expired" : "Error"} />}
          <a href="/getting-started" class="app-header-link">Getting Started →</a>
        </div>
      </header>

      {/* Boot log terminal */}
      {(state === "booting" || state === "error" || state === "idle") && (
        <div class="boot-screen">
          <div class="boot-terminal">
            <div class="boot-terminal-bar">
              <div class="boot-dots">
                <div class="boot-dot boot-dot-r" />
                <div class="boot-dot boot-dot-y" />
                <div class="boot-dot boot-dot-g" />
              </div>
              <span class="boot-terminal-title">sandbox setup</span>
            </div>
            <div class="boot-log">
              {bootLog.value.map((line, i) => {
                const isLast = i === bootLog.value.length - 1;
                const isErr = line.startsWith("ERROR:");
                let cls = "boot-line boot-line--done";
                if (isErr) cls = "boot-line boot-line--error";
                else if (isLast && state === "booting") cls = "boot-line boot-line--active";
                return (
                  <div key={i} class={cls}>
                    {isLast && state === "booting" && !isErr && (
                      <span class="boot-spinner" />
                    )}
                    {line}
                  </div>
                );
              })}
              {bootLog.value.length === 0 && state === "booting" && (
                <div class="boot-line boot-line--active">
                  <span class="boot-spinner" />
                  Connecting to Deno Sandbox…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waiting for a free slot */}
      {state === "waiting" && (
        <div class="boot-screen">
          <div class="boot-terminal">
            <div class="boot-terminal-bar">
              <div class="boot-dots">
                <div class="boot-dot boot-dot-r" />
                <div class="boot-dot boot-dot-y" />
                <div class="boot-dot boot-dot-g" />
              </div>
              <span class="boot-terminal-title">sandbox setup</span>
            </div>
            <div class="boot-log">
              <div class="boot-line boot-line--active">
                <span class="boot-spinner" />
                We have a lot of activity right now, we are waiting for a free slot.
              </div>
              <div class="boot-line boot-line--done" style="color:var(--text-dim);margin-top:0.5rem">
                Retrying in {retryCountdown.value}s…
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session expired */}
      {state === "expired" && (
        <div class="boot-screen">
          <div class="boot-terminal">
            <div class="boot-terminal-bar">
              <div class="boot-dots">
                <div class="boot-dot boot-dot-r" />
                <div class="boot-dot boot-dot-y" />
                <div class="boot-dot boot-dot-g" />
              </div>
              <span class="boot-terminal-title">session expired</span>
            </div>
            <div class="boot-log">
              <div class="boot-line boot-line--error">Sandbox timed out after 30 minutes of inactivity.</div>
              <div class="boot-line boot-line--done" style="margin-top:1rem">
                <button class="btn-save" style="font-size:0.85rem" onClick={() => globalThis.location.reload()}>
                  Refresh to start a new session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Three-pane layout */}
      {state === "ready" && (
        <div class="playground-grid">
          {/* ── Left: file tree ── */}
          <div class="pane-tree">
            <div class="pane-label">Explorer</div>
            <div class="file-tree">
              {roots.map((name) => {
                const path = name;
                const { icon, cls } = fileIcon(name);
                const active = selectedFile.value === path;
                return (
                  <div
                    key={path}
                    class={`tree-item tree-item--root${active ? " tree-item--active" : ""}`}
                    onClick={() => selectFile(path)}
                    title={name}
                  >
                    <span class={`file-icon ${cls}`}>{icon}</span>
                    {name}
                  </div>
                );
              })}
              {dirs.map(({ name, items }) => (
                <div key={name}>
                  <div class="tree-dir">
                    <span class="tree-dir-icon">▾</span>
                    {name}/
                  </div>
                  {items.map((item) => {
                    const path = `${name}/${item}`;
                    const { icon, cls } = fileIcon(item);
                    const active = selectedFile.value === path;
                    return (
                      <div
                        key={path}
                        class={`tree-item${active ? " tree-item--active" : ""}`}
                        onClick={() => selectFile(path)}
                        title={item}
                      >
                        <span class={`file-icon ${cls}`}>{icon}</span>
                        {item}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Add file dropdown */}
            {addableKeys.length > 0 && (
              <div class="add-file-wrap">
                <select
                  class="add-file-select"
                  disabled={isAdding.value}
                  value=""
                  onChange={(e) => {
                    const path = (e.target as HTMLSelectElement).value;
                    if (path) addFile(path);
                    (e.target as HTMLSelectElement).value = "";
                  }}
                >
                  <option value="">{isAdding.value ? "Adding…" : "+ Add file…"}</option>
                  {addableKeys.map((path) => (
                    <option key={path} value={path}>{getAddLabel(path)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── Middle: editor ── */}
          <div class="pane-editor">
            <div class="editor-header">
              {selectedFile.value
                ? (
                  <div class="editor-tab">
                    {selectedFile.value}
                    {isDirty.value && <span class="dirty-dot" title="Unsaved changes" />}
                  </div>
                )
                : <div class="editor-tab" style="color:var(--text-dim)">no file selected</div>}
              <div class="editor-actions">
                {saveStatus.value === "saved" && (
                  <span class="save-msg save-msg--ok">✓ saved</span>
                )}
                {saveStatus.value === "error" && (
                  <span class="save-msg save-msg--err" title={saveMsg.value}>✗ error</span>
                )}
                {isDirty.value && (
                  <button
                    class="btn-save"
                    disabled={isSaving.value}
                    onClick={saveFile}
                  >
                    {isSaving.value ? "saving…" : "Save"}
                  </button>
                )}
              </div>
            </div>
            <div class="editor-body">
              {selectedFile.value
                ? (
                  <textarea
                    class="editor-textarea"
                    value={editedContent.value}
                    onInput={(e) => {
                      editedContent.value = (e.target as HTMLTextAreaElement).value;
                      isDirty.value = true;
                      saveStatus.value = "";
                    }}
                    spellcheck={false}
                  />
                )
                : (
                  <div class="editor-placeholder">← select a file to view or edit</div>
                )}
            </div>
          </div>

          {/* ── Right: chat ── */}
          <div class="pane-chat">
            <div class="pane-label">Agent Chat</div>
            <div class="chat-messages">
              {blocks.value.map((block) => {
                if (block.kind === "user") {
                  return (
                    <div key={block.id} class="chat-user">
                      <div class="chat-lbl chat-lbl--me"># ME</div>
                      <div class="chat-user-content">{block.content}</div>
                    </div>
                  );
                }
                if (block.kind === "text") {
                  return (
                    <div key={block.id}>
                      <div class="chat-lbl chat-lbl--agent"># AGENT</div>
                      <div class="chat-text-content">{block.content}</div>
                    </div>
                  );
                }
                if (block.kind === "tool") {
                  return (
                    <details key={block.id} class="chat-tool">
                      <summary class="chat-tool-summary">
                        <span class="chat-tool-chevron">▶</span>
                        <span class="chat-tool-name">{block.name}</span>
                        {!block.done && <span class="boot-spinner" style="width:9px;height:9px;border-width:1.5px" />}
                        {block.done && <span class="chat-tool-badge">done</span>}
                      </summary>
                      {block.args && <pre class="chat-tool-code">{block.args}</pre>}
                    </details>
                  );
                }
                return null;
              })}
              {isStreaming.value && (
                <div class="chat-streaming">
                  <span class="boot-spinner" style="width:10px;height:10px;border-width:1.5px" />
                  thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div class="chat-input-wrap">
              <div class="chat-input-lbl"># ME</div>
              <textarea
                ref={textareaRef}
                class="chat-textarea"
                value={inputText.value}
                placeholder="Type a message…"
                disabled={isStreaming.value}
                rows={2}
                onInput={(e) => {
                  inputText.value = (e.target as HTMLTextAreaElement).value;
                }}
                onKeyDown={handleKeyDown}
              />
              <div class="chat-hint">Shift+Enter to send</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
