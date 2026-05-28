import { define } from "../utils.ts";
import DocLayout from "../components/DocLayout.tsx";

export const handler = define.handlers({
  GET(ctx) {
    return ctx.render(<HowToUsePage />);
  },
});

const TUTORIAL_STEPS = [
  {
    number: 1,
    title: "An Empty Playground",
    description:
      'Open an empty playground by following the link to the playground. By default, we\'ve added a system prompt - let\'s go ahead and delete that. Replace the SystemPrompt.md with something like: "Go and fetch https://openlibrary.org/dev/docs/api/authors - I\'d like to use this api to understand the works of my favorite authors." Some callouts: this is barely a system prompt. We are more just pointing it to a resource. That\'s ok. Context agents build themselves in conversation with you. They create the tools they need and they feed on the context you give them. This nugget of an idea - this is the seed, let\'s make it grow.',
    gif: "/walkthrough/walk1.gif",
    gifAlt: "Setting up an empty playground with initial system prompt",
    tryPrompt: "Review system prompt and let's try some connectivity",
  },
  {
    number: 2,
    title: "Explore",
    description:
      'With this little context, your agent is hungry. When we wrote this tutorial, at this step the agent made 22 tool calls and confirmed connectivity to multiple OpenLibrary APIs. Let\'s now help the agent query a little faster by asking: "Create some tools to save that you can use to query for authors and books more effectively and update the system prompt to make for faster querying." Now we have a new file "tools.js" where the agent has written a host of JavaScript functions to access the data it needs. Now on the next invocation it has shortcuts to use.',
    gif: "/walkthrough/walk2.gif",
    gifAlt: "Agent exploring APIs and creating tools",
    tryPrompt: "Create some tools to save that you can use to query for authors and books more effectively",
  },
  {
    number: 3,
    title: "Add Even More Context",
    description:
      'We want users to be able to explore by genre. Create a skill science_fiction/top.md which has some information on the best science fiction writers of all time using the scifi community on Reddit as a reference. Likewise create a romance/top.md using the books community on Reddit. Look now - our context agent has new skills specific to a genre, but if you look at the tool calls it tried, it may be tricking us.',
    gif: "/walkthrough/walk3.gif",
    gifAlt: "Adding genre-specific context documents",
    tryPrompt: "Create genre-specific skill documents for science fiction and romance authors",
  },
  {
    number: 4,
    title: "Verify Access",
    description:
      'Do a quick follow-up: "Were you actually able to review the Reddit sites?" All of the executed code and your files are in a secure sandbox. The agent only has access to the domains we give it access to. So these calls to Reddit were denied. This is an important security feature - the agent operates within defined boundaries.',
    gif: "/walkthrough/walk4.gif",
    gifAlt: "Verifying agent's actual access to external domains",
    tryPrompt: "Were you actually able to review the Reddit sites?",
  },
  {
    number: 5,
    title: "Refine",
    description:
      'Ask the agent: "Ok, update the system prompt to summarize your capabilities with a focus on detailed subject and edition information that you get from open library." This will detail out a capabilities document and we can simply copy and paste that now as our system prompt. The agent has now documented its own capabilities!',
    gif: "/walkthrough/walk6.gif",
    gifAlt: "Refining the system prompt with agent-generated capabilities",
    tryPrompt: "Update the system prompt to summarize your capabilities",
  },
  {
    number: 6,
    title: "Read-Only Mode",
    description:
      'Now let\'s toggle on "Read-Only" in the bottom right corner. This will prevent the agent from writing new files. It\'s done enough documentation and exploration - we want it to get to work! Try this prompt: "I am interested in a collector\'s edition of William Gibson books. Tell me about his most acclaimed works." Drill into the tool calls here and you can see more about how the agent searches, how it uses (or doesn\'t use) the tools. But this workflow is essentially how we use a context agent: work with the agent to build up its own context, rewrite the system prompt and capabilities, then lock it and have it operate!',
    gif: "/walkthrough/walk7.gif",
    gifAlt: "Using read-only mode for production queries",
    tryPrompt: "I am interested in a collector's edition of William Gibson books",
  },
];

function HowToUsePage() {
  return (
    <DocLayout currentPath="/how-to-use">
      <div class="min-h-full bg-white text-slate-800 font-sans">
        {/* Hero */}
        <header class="bg-white border-b border-slate-200 py-12 px-8">
          <div class="max-w-3xl mx-auto">
            <h1 class="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              How to Use
            </h1>
            <p class="text-base leading-relaxed text-slate-600 mb-4">
              This is a short tutorial for using context agents. Hopefully by the end of it you
              see the fun simplicity of the framework. All of the prompts and responses in this
              tutorial were generated with qwen/qwen3.5-35b-a3b. This is a sweet spot model - not
              so small that it's very limited in understanding but not too large, so you can host
              this very efficiently on a huge range of hardware.
            </p>
            <p class="text-base leading-relaxed text-slate-600">
              The screenshots in this tutorial use our web playground.
            </p>
          </div>
        </header>

        {/* Tutorial Steps */}
        <main class="py-12 px-8">
          <div class="max-w-5xl mx-auto space-y-16">
            {TUTORIAL_STEPS.map((step) => (
              <section
                key={step.number}
                class="flex flex-col gap-6 pb-12 border-b border-slate-200 last:border-b-0"
              >
                <div class="flex flex-col gap-3">
                  <span class="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Step {step.number}
                  </span>
                  <h2 class="text-2xl font-bold text-slate-900 leading-tight">
                    {step.title}
                  </h2>
                  <p class="text-base leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                  <div class="bg-slate-50 border border-slate-200 border-l-4 border-l-green-500 rounded-md p-3 mt-2">
                    <span class="block text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Try asking:
                    </span>
                    <span class="font-mono text-sm text-slate-900">
                      "{step.tryPrompt}"
                    </span>
                  </div>
                </div>
                <div class="w-full bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  <img src={step.gif} alt={step.gifAlt} class="w-full h-auto" />
                </div>
              </section>
            ))}
          </div>
        </main>

        {/* Advanced Capabilities Section */}
        <section class="py-12 px-8 bg-slate-50 border-t border-slate-200">
          <div class="max-w-3xl mx-auto">
            <h2 class="text-3xl font-bold text-slate-900 mb-8">Advanced Capabilities</h2>

            {/* MCP Servers */}
            <div class="mb-12">
              <h3 class="text-2xl font-semibold text-slate-900 mb-4">
                What about MCP Servers?
              </h3>
              <p class="text-base leading-relaxed text-slate-600 mb-4">
                An MCP server is just a set of APIs wrapped up with their documentation and
                input/output types. Context agents can use their JavaScript frameworks to access
                MCP servers. Add these two files to your directory:
              </p>
              <div class="flex gap-4 mb-4">
                <a
                  href="https://storage.googleapis.com/public-image-assets/get_tools.js"
                  download
                  class="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm px-4 py-2 rounded-md transition-colors"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  get_tools.js
                </a>
                <a
                  href="https://storage.googleapis.com/public-image-assets/run_tool.js"
                  download
                  class="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm px-4 py-2 rounded-md transition-colors"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  run_tool.js
                </a>
              </div>
              <p class="text-base leading-relaxed text-slate-600">
                The "get_tools" script which your agent can easily run will create a markdown
                document of all the tools available and the run_tools.js provides a simple
                JavaScript interface to run those tools. It is the same as directly connecting to
                it. If you think your server updated, just ask your context agent to refresh the
                tool availability.
              </p>
            </div>

            {/* Embedding CT Agents */}
            <div>
              <h3 class="text-2xl font-semibold text-slate-900 mb-4">
                Embedding CT Agents
              </h3>
              <p class="text-base leading-relaxed text-slate-600 mb-4">
                If you have special requirements, you can embed CT Agents in a Python program.
                Install the context agent package and try something like this:
              </p>
              <div class="bg-slate-900 text-slate-100 rounded-lg p-6 overflow-x-auto">
                <pre class="text-sm font-mono leading-relaxed">
                  <code>{`import asyncio
import os
from pathlib import Path

from context_agent.agent import AgentDeps, agent

async def with_custom_tools():
    """Example where agent creates its own tools."""
    exec_dir = "/tmp/my-agent-workspace"
    Path(exec_dir).mkdir(parents=True, exist_ok=True)

    deps = AgentDeps(
        exec_dir=exec_dir,
        allowed_domains=["api.stlouisfed.org"],  # For FRED API example
    )

    # Set API key via environment (agent can access CT_PY_* vars)
    os.environ["CT_PY_FRED_API_KEY"] = "your-api-key-here"

    # First turn: agent creates a tool
    result1 = await agent.run(
        """
        Write a tools.js file with a function called fetchGDP that:
        1. Gets the CT_PY_FRED_API_KEY env var
        2. Fetches GDP data from FRED API
        3. Returns the last 5 observations
        """,
        deps=deps,
    )
    print("Tool created:", result1.output)

    # Second turn: agent uses the tool it just created
    result2 = await agent.run(
        "Use the fetchGDP function to get the latest GDP data",
        deps=deps,
        message_history=result1.new_messages(),
    )
    print("Tool result:", result2.output)`}</code>
                </pre>
              </div>
              <p class="text-base leading-relaxed text-slate-600 mt-4">
                Context agents use{" "}
                <a
                  href="https://pydantic.dev/docs/ai/overview/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:underline"
                >
                  Pydantic-AI
                </a>
                , so you can call a context agent however you would call a Pydantic-AI agent.
              </p>
            </div>
          </div>
        </section>

        <footer class="text-center py-8 px-8 border-t border-slate-200">
          <p class="text-sm text-slate-600">
            Ready to dive deeper?{" "}
            <a
              href="/playground"
              class="text-blue-600 hover:underline"
            >
              Try the playground
            </a>
            {" "}or{" "}
            <a
              href="https://github.com/kindofluke/context-agent"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 hover:underline"
            >
              explore the docs
            </a>
          </p>
        </footer>
      </div>
    </DocLayout>
  );
}
