import { define } from "../utils.ts";
import DocLayout from "../components/DocLayout.tsx";

export const handler = define.handlers({
  GET(ctx) {
    return ctx.render(<GettingStartedPage />);
  },
});

const BASE = "/playground";

const STEPS = [
  {
    number: 1,
    title: "Initialize Your Agent",
    description:
      "Create an empty directory that will hold your agent, or open the agent in the playground. You can add or create a 'SystemPrompt.md' which will be used as the instructions for the agent.",
    gif: "/EmptyPlayground.gif",
    gifAlt: "Opening an empty playground",
    secondGif: "/AddingSystemPrompts.gif",
    secondGifAlt: "Adding system prompts in playground",
    tryPrompt: "What can you help me with?",
    files: "SystemPrompt.md",
  },
  {
    number: 2,
    title: "Hello World",
    description:
      "Drop in an OpenAPI spec and the agent immediately understands the shape of the API — endpoints, parameters, and response types. It can now reason about how to call the service, even before any code is written. Next, test connectivity and ask the agent to develop a JavaScript function to access monthly statistics. The agent explores the JavaScript environment, determines how to call the API, and creates its own tools file that it can continue to reference.",
    gif: "/creating-tools.gif",
    gifAlt: "Creating tools with the agent",
    tryPrompt: "Test connectivity and develop a javascript function to access monthly statistics",
    files: "SystemPrompt.md,fred-openApi.yaml",
  },
  {
    number: 3,
    title: "Adding More Context",
    description:
      "You can add more context too. You don't have to follow a special setup for skills — just add new markdown in a directory. The agent has access to the tree and it will understand whether it wants to go search out those documents or not.",
    gif: "/AddingContext.gif",
    gifAlt: "Adding context documents to the agent",
    tryPrompt: "What additional context do you have access to?",
    files:
      "SystemPrompt.md,fred-openApi.yaml,fred-client.js,ConusumerPricesCostofLiving%2Finflation-cola.md",
  },
];

function GettingStartedPage() {
  return (
    <DocLayout currentPath="/getting-started">
      <div class="min-h-full bg-white text-slate-800 font-sans">
        {/* Hero */}
        <header class="bg-white border-b border-slate-200 py-12 px-8">
          <div class="max-w-3xl mx-auto">
            <h1 class="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              Getting Started
            </h1>
            <p class="text-base leading-relaxed text-slate-600 mb-4">
              To show you the power of context agents, let's take a workable example. For household
              and corporate budgets, there are a range of micro and macro-economic factors that can
              play a part in spending.
            </p>
            <p class="text-base leading-relaxed text-slate-600 mb-6">
              What if we could get the most accurate economic statistics and use them in data
              analysis? Let's do it. For economic data we will use{" "}
              <a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                FRED
              </a>.
            </p>
            <div class="bg-blue-50 border border-blue-200 border-l-4 border-l-blue-600 rounded-md p-4">
              <p class="text-sm leading-relaxed text-slate-700">
                <strong class="font-semibold text-slate-900">FRED</strong> stands for Federal Reserve Economic Data. FRED contains
                frequently updated US macro and regional economic time series at annual, quarterly,
                monthly, weekly, and daily frequencies. FRED aggregates economic data from a variety
                of sources — most of which are US government agencies.
              </p>
            </div>
          </div>
        </header>

        {/* Steps */}
        <main class="py-12 px-8">
          <div class="max-w-4xl mx-auto space-y-16">
            {STEPS.map((step) => (
              <section key={step.number} class="grid grid-cols-1 md:grid-cols-2 gap-8 pb-12 border-b border-slate-200 last:border-b-0">
                <div class="flex flex-col gap-3">
                  <span class="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Step {step.number}
                  </span>
                  <h2 class="text-2xl font-bold text-slate-900 leading-tight">
                    {step.title}
                  </h2>
                  <p class="text-sm leading-relaxed text-slate-600">
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
                  <a
                    href={`${BASE}?files=${step.files}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-block self-start bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-md transition-colors mt-2"
                  >
                    Open in Playground →
                  </a>
                </div>
                <div class="flex flex-col gap-4">
                  <div class="w-full aspect-video bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                    <img src={step.gif} alt={step.gifAlt} class="w-full h-full object-cover" />
                  </div>
                  {step.secondGif && (
                    <div class="w-full aspect-video bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                      <img src={step.secondGif} alt={step.secondGifAlt} class="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </main>

        <footer class="text-center py-8 px-8 border-t border-slate-200">
          <p class="text-sm text-slate-600">
            Ready to build your own?{" "}
            <a href="https://github.com/anthropics/context-agent" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
              Read the docs
            </a>
          </p>
        </footer>
      </div>
    </DocLayout>
  );
}
