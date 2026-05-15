import { Link } from "@tanstack/react-router";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative py-16 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-[#010a07] to-[#000503]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <h4 className="text-emerald-100 font-bold text-lg mb-3">iWallet</h4>
            <p className="text-emerald-400/60 text-sm leading-relaxed">
              AI-Native Smart Wallet with On-Chain Policy Rules. Built on 0G Blockchain. Powered by 0G Storage.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-emerald-100 font-bold text-lg mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/dashboard" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Dashboard</Link></li>
              <li><Link to="/agent" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Agent Chat</Link></li>
              <li><Link to="/connect" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Connect & Provision</Link></li>
              <li><a href="https://chainscan.0g.ai/address/0x08a7Ea416AF2b8DD4614aa6A314ee7c96F8aA68d" target="_blank" rel="noopener" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Contract (Mainnet) ↗</a></li>
              <li><a href="https://chainscan-galileo.0g.ai/address/0xCF1f2860BA28aD3c7BCfCc29ab34c2f70D64F4ca" target="_blank" rel="noopener" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Contract (Testnet) ↗</a></li>
            </ul>
          </div>

          {/* 0G Ecosystem */}
          <div>
            <h4 className="text-emerald-100 font-bold text-lg mb-3">0G Ecosystem</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://0g.ai" target="_blank" rel="noopener" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">0G Website ↗</a></li>
              <li><a href="https://docs.0g.ai" target="_blank" rel="noopener" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">0G Docs ↗</a></li>
              <li><a href="https://storagescan.0g.ai" target="_blank" rel="noopener" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Storage Explorer ↗</a></li>
              <li><a href="https://chainscan-galileo.0g.ai" target="_blank" rel="noopener" className="text-emerald-400/60 hover:text-emerald-400 transition-colors">Testnet Explorer ↗</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-emerald-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-emerald-400/40 text-sm">
            &copy; {year} iWallet. Built for 0G Hackathon.
          </p>
          <p className="text-emerald-400/40 text-xs">
            Contracts deployed on 0G Mainnet & Galileo Testnet
          </p>
        </div>
      </div>
    </footer>
  )
}
