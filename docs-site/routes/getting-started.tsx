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
    title: "The System Prompt",
    description:
      "Every context agent starts with a single Markdown file — the system prompt. It describes the agent's purpose, what data it has access to, and how it should respond. No code required.",
    gif: "/static/gifs/step1-system-prompt.gif",
    gifAlt: "Loading a system prompt into the playground",
    tryPrompt: "What economic data can you access?",
    files: "SystemPrompt.md",
  },
  {
    number: 2,
    title: "Adding a Web Service",
    description:
      "Drop in an OpenAPI spec and the agent immediately understands the shape of the API — endpoints, parameters, and response types. It can now reason about how to call the service, even before any code is written.",
    gif: "/static/gifs/step2-web-service.gif",
    gifAlt: "Adding an OpenAPI spec to the agent",
    tryPrompt: "What FRED series are available for economic research?",
    files: "SystemPrompt.md,fred-openApi.yaml",
  },
  {
    number: 3,
    title: "Writing Tool Functions",
    description:
      "Pre-written JavaScript files are auto-loaded as globals the agent can call directly. Add a client library and the agent can fetch live data, transform results, and chain calls — all within a single conversation turn.",
    gif: "/static/gifs/step3-tools.gif",
    gifAlt: "Adding JavaScript tools to the agent",
    tryPrompt: "Show me GDP and unemployment trends since 2000",
    files: "SystemPrompt.md,fred-openApi.yaml,fred-client.js",
  },
  {
    number: 4,
    title: "Adding Context",
    description:
      "Markdown documents give the agent background knowledge — domain context, methodology notes, or reference data. The agent reads them as part of its working memory and can draw on them when answering questions.",
    gif: "/static/gifs/step4-context.gif",
    gifAlt: "Adding context documents to the agent",
    tryPrompt: "How has inflation affected consumer prices over the last decade?",
    files:
      "SystemPrompt.md,fred-openApi.yaml,fred-client.js,ConusumerPricesCostofLiving%2Finflation-cola.md",
  },
];

function GettingStartedPage() {
  return (
    <DocLayout currentPath="/getting-started">
      <div class="gs-root">
        {/* Hero */}
        <header class="gs-hero">
          <div class="gs-hero-inner">
            <h1 class="gs-hero-title">Build a Context Agent</h1>
            <p class="gs-hero-sub">
              A context agent is a conversational AI that reads its goals and tools from a local
              directory. Start with a single Markdown file and add capabilities one step at a time.
              Each "Open in Playground" button launches an interactive sandbox pre-loaded to that
              step.
            </p>
          </div>
        </header>

        {/* Steps */}
        <main class="gs-main">
          {STEPS.map((step) => (
            <section key={step.number} class="step-card">
              <div class="step-meta">
                <span class="step-number">Step {step.number}</span>
                <h2 class="step-title">{step.title}</h2>
                <p class="step-desc">{step.description}</p>
                <div class="step-try">
                  <span class="step-try-lbl">Try asking:</span>
                  <span class="step-try-prompt">"{step.tryPrompt}"</span>
                </div>
                <a
                  href={`${BASE}?files=${step.files}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="play-btn"
                >
                  Open in Playground →
                </a>
              </div>
              <div class="step-media">
                <div
                  class="gif-placeholder"
                  data-gif={step.gif}
                  data-gif-label={step.gif.split("/").pop()}
                >
                  <img src={step.gif} alt={step.gifAlt} class="step-gif" />
                </div>
              </div>
            </section>
          ))}
        </main>

        <footer class="gs-footer">
          <p>
            Ready to build your own?{" "}
            <a href="https://github.com/anthropics/context-agent" target="_blank" rel="noopener noreferrer">
              Read the docs
            </a>
          </p>
        </footer>
      </div>
    </DocLayout>
  );
}
