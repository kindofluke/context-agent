import asyncio
import os
import uuid

from .deno_manager import get_deno_path

TOOLS_JS = r"""
const EXEC_DIR = "__EXEC_DIR__";

const _resolvePath = (path) =>
  path.startsWith("/") ? path : `${EXEC_DIR}/${path}`;

async function cat(path) {
  return await Deno.readTextFile(_resolvePath(path));
}

async function find(pattern, dir = EXEC_DIR) {
  const results = [];
  const _walk = async (currentDir) => {
    for await (const entry of Deno.readDir(currentDir)) {
      const fullPath = `${currentDir}/${entry.name}`;
      if (entry.isDirectory) {
        await _walk(fullPath);
      } else if (entry.isFile) {
        const rel = fullPath.replace(EXEC_DIR + "/", "");
        if (!pattern || rel.includes(pattern) || entry.name.includes(pattern)) {
          results.push(rel);
        }
      }
    }
  };
  await _walk(dir);
  return results.join("\n");
}

async function grep(text, path) {
  const lines = [];
  const _search = async (filePath) => {
    try {
      const content = await Deno.readTextFile(filePath);
      content.split("\n").forEach((line, i) => {
        if (line.includes(text)) {
          lines.push(`${filePath}:${i + 1}: ${line}`);
        }
      });
    } catch (_) { /* skip unreadable files */ }
  };

  const resolved = _resolvePath(path);
  let stat;
  try { stat = await Deno.stat(resolved); } catch (_) { return `Path not found: ${path}`; }

  if (stat.isDirectory) {
    const _walk = async (dir) => {
      for await (const entry of Deno.readDir(dir)) {
        const fp = `${dir}/${entry.name}`;
        if (entry.isDirectory) await _walk(fp);
        else await _search(fp);
      }
    };
    await _walk(resolved);
  } else {
    await _search(resolved);
  }
  return lines.join("\n") || "(no matches)";
}

async function tree(depth = 2, dir = EXEC_DIR) {
  const lines = [dir];
  const _walk = async (currentDir, currentDepth, prefix) => {
    if (currentDepth > depth) return;
    const entries = [];
    for await (const entry of Deno.readDir(currentDir)) {
      entries.push(entry);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${entry.name}`);
      if (entry.isDirectory) {
        const childPrefix = prefix + (isLast ? "    " : "│   ");
        await _walk(`${currentDir}/${entry.name}`, currentDepth + 1, childPrefix);
      }
    }
  };
  await _walk(dir, 1, "");
  return lines.join("\n");
}

async function write(path, content) {
  const fullPath = _resolvePath(path);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (dir) await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(fullPath, content);
  return `Written: ${fullPath}`;
}

async function search_and_replace(path, search, replace) {
  const fullPath = _resolvePath(path);
  const content = await Deno.readTextFile(fullPath);
  const updated = content.split(search).join(replace);
  await Deno.writeTextFile(fullPath, updated);
  const count = content.split(search).length - 1;
  return `Replaced ${count} occurrence(s) in ${fullPath}`;
}

async function mkdir(path) {
  const fullPath = _resolvePath(path);
  await Deno.mkdir(fullPath, { recursive: true });
  return `Created: ${fullPath}`;
}

globalThis.cat = cat;
globalThis.find = find;
globalThis.grep = grep;
globalThis.tree = tree;
globalThis.write = write;
globalThis.search_and_replace = search_and_replace;
globalThis.mkdir = mkdir;
"""

TOOLS_JS_READ_ONLY = r"""
const EXEC_DIR = "__EXEC_DIR__";

const _resolvePath = (path) =>
  path.startsWith("/") ? path : `${EXEC_DIR}/${path}`;

async function cat(path) {
  return await Deno.readTextFile(_resolvePath(path));
}

async function find(pattern, dir = EXEC_DIR) {
  const results = [];
  const _walk = async (currentDir) => {
    for await (const entry of Deno.readDir(currentDir)) {
      const fullPath = `${currentDir}/${entry.name}`;
      if (entry.isDirectory) {
        await _walk(fullPath);
      } else if (entry.isFile) {
        const rel = fullPath.replace(EXEC_DIR + "/", "");
        if (!pattern || rel.includes(pattern) || entry.name.includes(pattern)) {
          results.push(rel);
        }
      }
    }
  };
  await _walk(dir);
  return results.join("\n");
}

async function grep(text, path) {
  const lines = [];
  const _search = async (filePath) => {
    try {
      const content = await Deno.readTextFile(filePath);
      content.split("\n").forEach((line, i) => {
        if (line.includes(text)) {
          lines.push(`${filePath}:${i + 1}: ${line}`);
        }
      });
    } catch (_) { /* skip unreadable files */ }
  };

  const resolved = _resolvePath(path);
  let stat;
  try { stat = await Deno.stat(resolved); } catch (_) { return `Path not found: ${path}`; }

  if (stat.isDirectory) {
    const _walk = async (dir) => {
      for await (const entry of Deno.readDir(dir)) {
        const fp = `${dir}/${entry.name}`;
        if (entry.isDirectory) await _walk(fp);
        else await _search(fp);
      }
    };
    await _walk(resolved);
  } else {
    await _search(resolved);
  }
  return lines.join("\n") || "(no matches)";
}

async function tree(depth = 2, dir = EXEC_DIR) {
  const lines = [dir];
  const _walk = async (currentDir, currentDepth, prefix) => {
    if (currentDepth > depth) return;
    const entries = [];
    for await (const entry of Deno.readDir(currentDir)) {
      entries.push(entry);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${entry.name}`);
      if (entry.isDirectory) {
        const childPrefix = prefix + (isLast ? "    " : "│   ");
        await _walk(`${currentDir}/${entry.name}`, currentDepth + 1, childPrefix);
      }
    }
  };
  await _walk(dir, 1, "");
  return lines.join("\n");
}

globalThis.cat = cat;
globalThis.find = find;
globalThis.grep = grep;
globalThis.tree = tree;
"""

_USER_TOOLS_LOADER = r"""
// Load agent-authored .js files from exec_dir
for await (const __entry of Deno.readDir("__EXEC_DIR__")) {
  if (
    __entry.isFile &&
    __entry.name.endsWith(".js") &&
    !__entry.name.startsWith("_runner_")
  ) {
    try {
      const __mod = await import("__EXEC_DIR__/" + __entry.name);
      for (const [__k, __v] of Object.entries(__mod)) {
        globalThis[__k] = __v;
      }
    } catch (__e) {
      console.error(`Failed to load ${__entry.name}: ${__e.message}`);
    }
  }
}
"""


def _collect_credentials() -> list[tuple[str, str]]:
    """Collect all CT_PY_* and NL_PY_* environment variable values for redaction.

    Returns:
        List of (var_name, value) tuples, sorted by value length (longest first)
        to avoid partial redactions. Empty values are excluded.
    """
    credentials = []
    for key, value in os.environ.items():
        if (key.startswith("CT_PY_") or key.startswith("NL_PY_")) and value:
            credentials.append((key, value))

    # Sort by value length descending to redact longer strings first
    credentials.sort(key=lambda x: len(x[1]), reverse=True)
    return credentials


def _redact_credentials(text: str, credentials: list[tuple[str, str]]) -> str:
    """Redact credential values from text, replacing with [REDACTED:VAR_NAME].

    Args:
        text: The text to redact credentials from
        credentials: List of (var_name, value) tuples to redact

    Returns:
        Text with all credential values replaced with redaction markers
    """
    if not text or not credentials:
        return text

    redacted = text
    for var_name, value in credentials:
        if value in redacted:
            redacted = redacted.replace(value, f"[REDACTED:{var_name}]")

    return redacted


async def run_js(exec_dir: str, js_code: str, allowed_domains: list[str], read_only: bool = False) -> str:
    """Execute JavaScript code in Deno runtime.

    Args:
        exec_dir: Directory to execute in
        js_code: JavaScript arrow function to execute
        allowed_domains: List of domains for network access
        read_only: If True, exclude write operations and deny write permissions

    Returns:
        Output from execution or error message
    """
    exec_dir = os.path.realpath(exec_dir)
    runner_name = f"_runner_{uuid.uuid4().hex}.js"
    runner_path = os.path.join(exec_dir, runner_name)

    nl_py_keys = [k for k in os.environ if k.startswith("NL_PY_") or k.startswith("CT_PY_")]

    # Collect credentials for redaction to prevent leakage in outputs
    credentials = _collect_credentials()

    # Choose tool set based on read-only mode
    tools_js = TOOLS_JS_READ_ONLY if read_only else TOOLS_JS

    runner_script = (
        tools_js.replace("__EXEC_DIR__", exec_dir)
        + "\n"
        + _USER_TOOLS_LOADER.replace("__EXEC_DIR__", exec_dir)
        + "\n"
        + f"const __fn = {js_code};\n"
        + "const __result = await __fn();\n"
        + "if (__result !== undefined) {\n"
        + "  console.log(typeof __result === 'string' ? __result : JSON.stringify(__result, null, 2));\n"
        + "}\n"
    )

    try:
        with open(runner_path, "w") as f:
            f.write(runner_script)

        cmd = [get_deno_path(), "run"]
        cmd += [f"--allow-read={exec_dir}"]
        # Only add write permission if not in read-only mode
        if not read_only:
            cmd += [f"--allow-write={exec_dir}"]
        cmd += ["--deny-read=.env"]
        if allowed_domains:
            cmd += [f"--allow-net={','.join(allowed_domains)}"]
        if nl_py_keys:
            cmd += [f"--allow-env={','.join(nl_py_keys)}"]
        cmd += [runner_path]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=os.environ.copy(),
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return "Error: execution timed out after 30 seconds"

        if proc.returncode != 0:
            stderr_text = stderr.decode().strip()
            return f"Error (exit {proc.returncode}):\n{_redact_credentials(stderr_text, credentials)}"

        stdout_text = stdout.decode().strip() or "(no output)"
        return _redact_credentials(stdout_text, credentials)

    finally:
        try:
            os.unlink(runner_path)
        except OSError:
            pass
