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
  const readOnlyMode = useSignal(false);
  const showNewFileModal = useSignal(false);
  const newFilePath = useSignal<string>("");
  const newFileError = useSignal<string>("");
  const isDownloading = useSignal(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bootStartTimeRef = useRef<number>(0);

  useEffect(() => {
    bootSandbox();
    return () => {
      clearRetryTimer();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Poll for file changes when sandbox is ready
  useEffect(() => {
    if (sandboxState.value === "ready") {
      // Poll every 2 seconds
      pollTimerRef.current = setInterval(() => {
        refreshFiles();
      }, 2000);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [sandboxState.value]);

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
    bootStartTimeRef.current = Date.now();

    const MIN_BOOT_TIME_MS = 5000; // Show boot screen for at least 5 seconds

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
      let readyReceived = false;

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
              readyReceived = true;
              bootLog.value = [...bootLog.value, "Sandbox ready, loading playground..."];
            } else if (ev.type === "WAITING") {
              sandboxState.value = "waiting";
              startRetryCountdown();
              return;
            } else if (ev.type === "ERROR") {
              bootLog.value = [...bootLog.value, `ERROR: ${ev.message ?? "unknown"}`];
              sandboxState.value = "error";
              return;
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Wait for minimum boot time before transitioning to ready
      if (readyReceived) {
        // If starting with no files, initialize an empty session directory
        // This prevents template files from being copied when the user creates their first file
        if (Object.keys(initialFiles).length === 0) {
          try {
            await fetch("/api/init", { method: "POST" });
            bootLog.value = [...bootLog.value, "Empty session initialized"];
          } catch (err) {
            console.warn("Failed to initialize empty session:", err);
          }
        }

        const elapsed = Date.now() - bootStartTimeRef.current;
        const remaining = MIN_BOOT_TIME_MS - elapsed;

        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }

        sandboxState.value = "ready";
        if (!selectedFile.value) {
          const key = "SystemPrompt.md";
          if (fileContents.value[key] !== undefined) selectFile(key);
        }
      }
    } catch (err) {
      bootLog.value = [...bootLog.value, `Connection error: ${(err as Error).message}`];
      sandboxState.value = "error";
    }
  }

  // ── Refresh file list from sandbox ────────────────

  async function refreshFiles() {
    try {
      const resp = await fetch("/api/files");
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.files) {
        // Merge new files with existing ones
        const newFiles = { ...fileContents.value };
        let hasChanges = false;

        for (const [path, content] of Object.entries(data.files)) {
          // Only update if file is new or different
          if (newFiles[path] !== content) {
            newFiles[path] = content as string;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          fileContents.value = newFiles;
          // If a new file was created and no file is selected, select it
          if (!selectedFile.value && Object.keys(data.files).length > 0) {
            const firstFile = Object.keys(data.files)[0];
            selectFile(firstFile);
          }
        }
      }
    } catch {
      // Silently fail - polling will retry
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

  // ── Create new file with custom path ───────────────

  async function createNewFile() {
    const path = newFilePath.value.trim();
    if (!path) {
      newFileError.value = "Please enter a file path";
      return;
    }

    // Basic validation
    if (path.startsWith("/") || path.includes("..")) {
      newFileError.value = "Invalid path: must be relative and not contain '..'";
      return;
    }

    if (fileContents.value[path] !== undefined) {
      newFileError.value = "File already exists";
      return;
    }

    isAdding.value = true;
    newFileError.value = "";

    try {
      // Determine default content based on extension
      const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
      let content = "";
      if (ext === "md") {
        content = `# ${path.split("/").pop()?.replace(/\.md$/, "") ?? "New File"}\n\n`;
      } else if (ext === "js" || ext === "ts") {
        content = "// New file\n\n";
      }

      const resp = await fetch("/api/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.detail ?? err.error ?? "Failed to create file");
      }

      fileContents.value = { ...fileContents.value, [path]: content };
      selectFile(path);
      showNewFileModal.value = false;
      newFilePath.value = "";
    } catch (err) {
      newFileError.value = (err as Error).message;
    } finally {
      isAdding.value = false;
    }
  }

  function openNewFileModal() {
    newFilePath.value = "";
    newFileError.value = "";
    showNewFileModal.value = true;
  }

  function closeNewFileModal() {
    showNewFileModal.value = false;
    newFilePath.value = "";
    newFileError.value = "";
  }

  function handleNewFileKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      createNewFile();
    } else if (e.key === "Escape") {
      closeNewFileModal();
    }
  }

  // ── Download all files as ZIP ─────────────────────

  async function downloadAllFiles() {
    if (isDownloading.value) return;
    isDownloading.value = true;

    try {
      // Dynamic import to avoid SSR issues - only loads in browser
      const { ZipWriter, BlobWriter, TextReader } = await import("@zip-js/zip-js");

      // Create a BlobWriter to write the zip file to a blob
      const blobWriter = new BlobWriter("application/zip");
      const zipWriter = new ZipWriter(blobWriter);

      // Add all files to the ZIP
      for (const [path, content] of Object.entries(fileContents.value)) {
        await zipWriter.add(path, new TextReader(content));
      }

      // Close the writer and get the blob
      const blob = await zipWriter.close();

      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "context-agent-files.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download files:", err);
    } finally {
      isDownloading.value = false;
    }
  }

  // ── Chat ──────────────────────────────────────────

  function clearChat() {
    blocks.value = [];
    agMsgs.value = [];
    inputText.value = "";
  }

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
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (readOnlyMode.value) {
        headers["X-Read-Only"] = "true";
      }

      const resp = await fetch("/api/agent", {
        method: "POST",
        headers,
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
        <span class="app-header-subtitle">playground</span>
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

            {/* Add file controls */}
            <div class="add-file-wrap">
              {addableKeys.length > 0 && (
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
                    <option key={path} value={path}>{path}</option>
                  ))}
                </select>
              )}
              <button
                class="btn-save"
                style="width:100%;margin-top:0.5rem;font-size:0.85rem"
                onClick={openNewFileModal}
                disabled={isAdding.value}
              >
                + Create New File
              </button>
              <button
                class="btn-save"
                style="width:100%;margin-top:0.5rem;font-size:0.85rem"
                onClick={downloadAllFiles}
                disabled={isDownloading.value}
                title="Download all files as ZIP"
              >
                {isDownloading.value ? "Downloading…" : "↓ Download All"}
              </button>
            </div>
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
            <div class="pane-label" style="display:flex;justify-content:space-between;align-items:center">
              <span>Agent Chat</span>
              <button
                class="btn-save"
                style="font-size:0.8rem;padding:0.25rem 0.5rem"
                onClick={clearChat}
                title="Clear chat history"
              >
                Clear
              </button>
            </div>
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
              <div class="chat-hint" style="display:flex;justify-content:space-between;align-items:center">
                <span>Shift+Enter to send</span>
                <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;user-select:none">
                  <input
                    type="checkbox"
                    checked={readOnlyMode.value}
                    onChange={(e) => {
                      readOnlyMode.value = (e.target as HTMLInputElement).checked;
                    }}
                    style="cursor:pointer"
                  />
                  <span style="font-size:0.8rem;color:var(--text-dim)">Read-only mode</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal.value && (
        <div class="modal-overlay" onClick={closeNewFileModal}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3 style="margin:0;font-size:1rem;font-weight:600">Create New File</h3>
              <button class="modal-close" onClick={closeNewFileModal} title="Close">×</button>
            </div>
            <div class="modal-body">
              <label style="display:block;margin-bottom:0.5rem;font-size:0.9rem;color:var(--text-dim)">
                File path (e.g., "somedir/newfile.md")
              </label>
              <input
                type="text"
                class="modal-input"
                value={newFilePath.value}
                placeholder="path/to/file.md"
                onInput={(e) => {
                  newFilePath.value = (e.target as HTMLInputElement).value;
                  newFileError.value = "";
                }}
                onKeyDown={handleNewFileKeyDown}
                autoFocus
              />
              {newFileError.value && (
                <div class="modal-error">{newFileError.value}</div>
              )}
            </div>
            <div class="modal-footer">
              <button class="btn-save" onClick={closeNewFileModal} disabled={isAdding.value}>
                Cancel
              </button>
              <button
                class="btn-save"
                style="background:var(--accent);color:white"
                onClick={createNewFile}
                disabled={isAdding.value || !newFilePath.value.trim()}
              >
                {isAdding.value ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
