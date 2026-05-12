import { ComponentChildren } from "preact";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "About", href: "/" },
  { label: "Getting Started", href: "/getting-started" },
  { label: "CLI Documentation", href: "/command-line" },
  { label: "Playground", href: "/playground" },
];

interface DocLayoutProps {
  children: ComponentChildren;
  currentPath?: string;
}

export default function DocLayout({ children, currentPath }: DocLayoutProps) {
  return (
    <div class="doc-layout">
      <nav class="doc-nav">
        <div class="doc-nav-header">
          <h2 class="doc-nav-title">Context Agents</h2>
        </div>
        <ul class="doc-nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                class={`doc-nav-link${currentPath === item.href ? " doc-nav-link--active" : ""}`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div class="doc-nav-footer">
          <a
            href="https://github.com/kindofluke/context-agent"
            target="_blank"
            rel="noopener noreferrer"
            class="doc-nav-link doc-nav-link--external"
          >
            GitHub →
          </a>
        </div>
      </nav>
      <main class="doc-layout-main">
        {children}
      </main>
    </div>
  );
}
