import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Bot, ShieldCheck, Plug, Presentation } from "lucide-react";
import { WalletButton } from "./WalletButton";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agent", label: "Agent", icon: Bot },
  { to: "/policy", label: "Policy", icon: ShieldCheck },
  { to: "/mcp", label: "MCP", icon: Plug },
  { to: "/pitch", label: "Pitch", icon: Presentation },
] as const;

export function Sidebar() {
  const { location } = useRouterState();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-48 flex-col border-r border-emerald-500/10 bg-[#02130f] py-5 px-3">
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center gap-2 px-3">
        <span className="h-3 w-3 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
        <span className="text-sm font-bold text-emerald-100 tracking-tight">iWallet</span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "text-emerald-400/60 hover:bg-emerald-500/5 hover:text-emerald-300"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Wallet button at bottom */}
      <div className="mt-auto px-1">
        <WalletButton />
      </div>
    </aside>
  );
}
