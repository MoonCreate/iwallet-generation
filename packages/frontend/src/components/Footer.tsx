export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative py-16 px-6">
      {/* Background gradient - starts from #010a07 and gets darker */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#010a07] to-[#000503]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#010a07]/50 to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <h4 className="text-emerald-100 font-bold text-lg mb-3">iWallet Protocol</h4>
            <p className="text-emerald-400/60 text-sm leading-relaxed">
              AI-Native Smart Wallet with Policy Rules. Built for 0G Blockchain.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-emerald-100 font-bold text-lg mb-3">Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Documentation</a></li>
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">GitHub</a></li>
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Smart Contracts</a></li>
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Bug Bounty</a></li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-emerald-100 font-bold text-lg mb-3">Community</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Twitter / X</a></li>
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Discord</a></li>
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Telegram</a></li>
              <li><a href="#" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Forum</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-emerald-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-emerald-400/40 text-sm">
            &copy; {year} iWallet Protocol. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}