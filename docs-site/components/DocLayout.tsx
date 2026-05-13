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
    <div class="flex h-screen overflow-hidden bg-white">
      {/* Sidebar Navigation */}
      <nav class="w-80 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-y-auto">
        {/* Header */}
        <div class="px-6 py-6 border-b border-slate-200">
          <h2 class="font-mono text-lg font-bold text-slate-800 tracking-tight">
            Context Agents
          </h2>
        </div>

        {/* Navigation Links */}
        <ul class="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  class={`block px-6 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 border-l-4 border-blue-600 pl-[1.375rem] text-slate-900 font-semibold"
                      : "border-l-4 border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div class="py-4 border-t border-slate-200">
          <a
            href="https://github.com/kindofluke/context-agent"
            target="_blank"
            rel="noopener noreferrer"
            class="block px-6 py-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            GitHub →
          </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main class="flex-1 overflow-y-auto overflow-x-hidden bg-white">
        <div class="w-4/5 mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
