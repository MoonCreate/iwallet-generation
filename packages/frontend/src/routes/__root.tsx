import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import Footer from "../components/Footer";
import { Sidebar } from "../components/Sidebar";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { AppKitProvider } from "../integrations/appkit/root-provider";

interface MyRouterContext {
  queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "iWallet — AI-Native Smart Wallet",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex h-screen w-full items-center justify-center p-4">
      <div className="island-shell w-full max-w-sm rounded-[2rem] p-8 text-center shadow-xl">
        <h1 className="display-title mb-4 text-4xl font-bold text-[var(--sea-ink)]">
          404
        </h1>
        <p className="island-kicker mb-6">Page Not Found</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
        >
          Return Home
        </a>
      </div>
    </div>
  ),
  shellComponent: RootDocument,
});


function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        <AppKitProvider>
          <LayoutShell>{children}</LayoutShell>
        </AppKitProvider>
        <Scripts />
      </body>
    </html>
  );
}

function LayoutShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const isLanding = location.pathname === "/" || location.pathname === "/robot";

  if (isLanding) {
    return (
      <>
        {children}
        <Footer />
      </>
    );
  }

  return (
    <div className="dark flex min-h-screen bg-[#02130f] text-emerald-100">
      <Sidebar />
      <main className="ml-48 flex-1">{children}</main>
    </div>
  );
}
