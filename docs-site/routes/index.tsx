import { define } from "../utils.ts";
import DocLayout from "../components/DocLayout.tsx";

export const handler = define.handlers({
  GET(ctx) {
    return ctx.render(<AboutPage />);
  },
});

function AboutPage() {
  return (
    <DocLayout currentPath="/">
      <div class="doc-root">
        <header class="doc-header">
          <div class="doc-header-inner">
            <h1 class="doc-title">Context Agents</h1>
            <p class="doc-subtitle">
              What is a "Context Agent"?
            </p>
          </div>
        </header>

        <main class="doc-content">
          <p>
            "Agentic" is the buzzword of the moment. Everyone wants to tell you what an agent is and isn't. So why are we creating a new agent framework?
          </p>
          <p>
            Well, it's because we want to demonstrate that agents are really just loops of context management. All the latest buzzy features like skills, plugins and MCP servers and DAGs all exist to manage the state of context from an LLM.
          </p>
          <p>
            We wanted to challenge ourselves: What would happen if we removed the framework, removed the code, and just gave the agent context.
          </p>

          <h2>An Empty Directory</h2>
          <p>
            Our "Context Agent" starts with a directory. We make that directory a sandbox for the agent. Like any good sandbox, you can throw in items for the agent to play with. Throw in Markdown documents and the agent will hoover up that as free context so it can explore its world.
          </p>
          <p>
            Throw in an <code>OpenAPI.yaml</code> and the agent will instantly start to probe and test for connectivity to APIs. Most of this behavior by the LLM occurs unprompted. The eagerness to test and explore has been refined into these models with reinforcement learning.
          </p>

          <h2>Add in Some Tools</h2>
          <p>
            In addition to the execution directory, we give the agent one tool: <code>execute_js</code>. It is through <code>execute_js</code> that the agent reads files and acts on the user prompt. This setup is inspired by{" "}
            <a href="https://blog.cloudflare.com/code-mode/" target="_blank" rel="noopener noreferrer">
              Cloudflare's CodeMode
            </a>.
          </p>
          <p>
            Rather than having the user have to write tools or connect in MCP servers with 40, 50 or 100 tools, we simplify the agent's context and tell it to just write the tools it wants all in a common context document that it can read, understand, and update over time.
          </p>

          <h3>Execute JS</h3>
          <p>
            Execute JS is also a very safe sandbox for us to use. We leverage the Deno runtime for code execution which allows us to control which domains can be accessed and provide absolute security guarantee that the agent can't break out of its directory.
          </p>
          <p>
            Within the deno runtime, we've given context agents simple functions so that it feels like a POSIX environment:
          </p>
          <pre><code>{`globalThis.cat = cat;
globalThis.find = find;
globalThis.grep = grep;
globalThis.tree = tree;
globalThis.write = write;
globalThis.search_and_replace = search_and_replace;
globalThis.mkdir = mkdir;`}</code></pre>
          <p>
            With just these tools, the agent has everything it needs to dynamically create its world.
          </p>

          <h2>Memory and Self-Authorship</h2>
          <p>
            We find the best way to use Context Agents is to let them build themselves. That's why we've enabled two modes:
          </p>
          <ul>
            <li>
              <strong>Build mode:</strong> Gives the agent free reign to write instructions and author JS tools that it can continue to use.
            </li>
            <li>
              <strong>Execute Mode:</strong> Places limits on the <code>write</code> and <code>search_and_replace</code> tools so that the agent can write and modify everything in <code>&lt;exec_dir&gt;/memories</code> but can't modify its own tools or system prompt. In this way, the agent focuses on using its system not continuously improving and tends to respond a little faster.
            </li>
          </ul>

          <h2>Ready to go</h2>
          <p>
            Head over to <a href="/getting-started">Getting Started</a> or try the <a href="/playground">Playground</a>
          </p>
        </main>
      </div>
    </DocLayout>
  );
}
