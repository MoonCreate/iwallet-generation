import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-500/20 bg-[#02130f]/90 px-4 backdrop-blur-lg">
      <nav className="page-wrap flex items-center justify-between py-3 sm:py-4">
        {/* Logo - Left */}
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100 no-underline hover:bg-emerald-500/20 transition-colors sm:px-4 sm:py-2"
          >
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#10b981,#059669)]" />
            iWallet
          </Link>
        </h2>

        {/* Navigation - Center (Desktop) */}
        <div className="hidden md:flex items-center gap-x-6">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: "nav-link is-active" }}
          >
            Home
          </Link>
          <Link
            to="/connect"
            className="nav-link"
            activeProps={{ className: "nav-link is-active" }}
          >
            Connect
          </Link>
          <Link
            to="/dashboard"
            className="nav-link"
            activeProps={{ className: "nav-link is-active" }}
          >
            Dashboard
          </Link>
        </div>

        {/* Mobile Menu Button - Left side on mobile */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="md:hidden flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100 transition hover:bg-emerald-500/20"
          aria-label="Toggle menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Wallet Buttons - Right */}
        <div className="flex items-center gap-2">
          <appkit-network-button />
          <appkit-button />
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute left-0 right-0 top-full z-40 border-b border-emerald-500/20 bg-[#02130f]/95 px-4 py-4 backdrop-blur-lg">
          <nav className="page-wrap flex flex-col gap-4">
            <Link
              to="/"
              className="nav-link"
              activeProps={{ className: "nav-link is-active" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/connect"
              className="nav-link"
              activeProps={{ className: "nav-link is-active" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Connect
            </Link>
            <Link
              to="/dashboard"
              className="nav-link"
              activeProps={{ className: "nav-link is-active" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
          </nav>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          aria-label="Close menu"
        />
      )}
    </header>
  );
}
