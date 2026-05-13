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
      <div class="min-h-full bg-white text-slate-800 font-sans">
        <header class="bg-white border-b border-slate-200 py-12 px-8">
          <div class="max-w-4xl mx-auto">
            <h1 class="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              Context Agents
            </h1>
            <p class="text-base leading-relaxed text-slate-600 max-w-2xl">
              What is a "Context Agent"?
            </p>
          </div>
        </header>

        <main class="py-12 px-8">
          <div class="max-w-4xl mx-auto space-y-6">
            <p class="text-sm leading-relaxed text-slate-700">
              "Agentic" is the buzzword of the moment. Everyone wants to tell you what an agent is and isn't. So why are we creating a new agent framework?
            </p>
            <p class="text-sm leading-relaxed text-slate-700">
              Well, it's because we want to demonstrate that agents are really just loops of context management. All the latest buzzy features like skills, plugins and MCP servers and DAGs all exist to manage the state of context from an LLM.
            </p>
            <p class="text-sm leading-relaxed text-slate-700">
              We wanted to challenge ourselves: What would happen if we removed the framework, removed the code, and just gave the agent context.
            </p>

            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              An Empty Directory
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              Our "Context Agent" starts with a directory. We make that directory a sandbox for the agent. Like any good sandbox, you can throw in items for the agent to play with. Throw in Markdown documents and the agent will hoover up that as free context so it can explore its world.
              
            </p>
            <p class="text-sm leading-relaxed text-slate-700">
              Throw in an <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">OpenAPI.yaml</code> and the agent will instantly start to probe and test for connectivity to APIs. Most of this behavior by the LLM occurs unprompted. The eagerness to test and explore has been refined into these models with reinforcement learning.
            </p>

            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              Add in Some Tools
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              In addition to the execution directory, we give the agent one tool: <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">execute_js</code>. It is through <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">execute_js</code> that the agent reads files and acts on the user prompt. This setup is inspired by{" "}
              <a href="https://blog.cloudflare.com/code-mode/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                Cloudflare's CodeMode
              </a>.
            </p>
            <p class="text-sm leading-relaxed text-slate-700">
              Rather than having the user have to write tools or connect in MCP servers with 40, 50 or 100 tools, we simplify the agent's context and tell it to just write the tools it wants all in a common context document that it can read, understand, and update over time.
            </p>

            <h3 class="text-lg font-semibold text-slate-900 mt-8 mb-3">
              Execute JS
            </h3>
            <p class="text-sm leading-relaxed text-slate-700">
              Execute JS is also a very safe sandbox for us to use. We leverage the Deno runtime for code execution which allows us to control which domains can be accessed and provide absolute security guarantee that the agent can't break out of its directory.
            </p>
            <p class="text-sm leading-relaxed text-slate-700">
              Within the deno runtime, we've given context agents simple functions so that it feels like a POSIX environment:
            </p>
            <pre class="bg-slate-100 border border-slate-200 rounded-lg p-4 my-4 overflow-x-auto">
              <code class="font-mono text-xs text-slate-900 leading-relaxed">{`globalThis.cat = cat;
globalThis.find = find;
globalThis.grep = grep;
globalThis.tree = tree;
globalThis.write = write;
globalThis.search_and_replace = search_and_replace;
globalThis.mkdir = mkdir;`}</code>
            </pre>
            <p class="text-sm leading-relaxed text-slate-700">
              With just these tools, the agent has everything it needs to dynamically create its world. Notice that this is just 
              a collection of POSIX style file system commands. The agent can read files, write files, search and replace within files, 
              and make directories. With these tools, the agent can create its own context and then use that context to respond to user prompts ot 
              take action. 
            </p>

            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              Memory and Self-Authorship
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              We find the best way to use Context Agents is to let them build themselves. That's why we've enabled two modes:
            </p>
            <ul class="my-4 pl-6 space-y-2 text-slate-700 list-disc">
              <li class="text-sm leading-relaxed">
                <strong class="font-semibold text-slate-900">Build mode:</strong> Gives the agent free reign to write instructions and author JS tools that it can continue to use.
              </li>
              <li class="text-sm leading-relaxed">
                <strong class="font-semibold text-slate-900">Execute Mode:</strong> Places limits on the <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">write</code> and <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">search_and_replace</code> tools so that the agent can write and modify everything in <code class="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-cyan-700">&lt;exec_dir&gt;/memories</code> but can't modify its own tools or system prompt. In this way, the agent focuses on using its system not continuously improving and tends to respond a little faster.
              </li>
            </ul>

            <h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 tracking-tight">
              Ready to go
            </h2>
            <p class="text-sm leading-relaxed text-slate-700">
              Head over to <a href="/getting-started" class="text-blue-600 hover:underline">Getting Started</a> or try the <a href="/playground" class="text-blue-600 hover:underline">Playground</a>
            </p>
          </div>
        </main>
      </div>
    </DocLayout>
  );
}
