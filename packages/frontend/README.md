# iWallet Frontend

React application for the iWallet AI-native smart wallet — built with TanStack Start, Tailwind v4, and Three.js.

## Architecture

```
src/
├── routes/
│   ├── index.tsx       # Landing page (3D robot scene, hero, features, roadmap)
│   ├── dashboard.tsx   # Wallet overview, sessions, 0G agent memory
│   ├── agent.tsx       # AI agent chat (markdown, history, streaming)
│   ├── policy.tsx      # Policy configuration + session provisioning
│   ├── mcp.tsx         # MCP connection tutorials
│   └── robot.tsx       # Standalone robot demo page
├── components/
│   ├── RobotScene.tsx  # Three.js 3D robot with scroll animations
│   ├── RobotBody.tsx   # GLB model loader + animations
│   ├── Sidebar.tsx     # App navigation sidebar
│   ├── WalletButton.tsx # Custom wallet connect button (emerald theme)
│   ├── Roadmap.tsx     # Project roadmap section
│   ├── FeaturesGrid.tsx # Feature cards
│   ├── HowItWorks.tsx  # Step-by-step guide
│   ├── FinalCTA.tsx    # Call-to-action section
│   ├── Footer.tsx      # Site footer
│   └── Header.tsx      # Legacy header (unused, replaced by sidebar)
├── lib/
│   ├── contracts.ts    # ABI imports, factory address, backend URL
│   ├── policy.ts       # Policy formatting utilities
│   └── derive.ts       # Deterministic wallet derivation
├── integrations/
│   └── appkit/         # Reown AppKit (WalletConnect) config
└── styles.css          # Tailwind + custom theme variables
```

## Key Features

- **3D Landing Page** — Three.js robot with scroll-driven animations, device detection for low-end fallback
- **Agent Chat** — Streaming SSE, markdown rendering (react-markdown + remark-gfm), `<think>` tag stripping
- **Chat History** — localStorage persistence, resume previous conversations
- **0G Agent Memory** — View archived conversations from 0G Storage, download & continue
- **Policy Management** — Configure daily limits, allowed contracts, cooldowns, expiry
- **MCP Tutorials** — Connection instructions for Claude, Cursor, VS Code
- **Dark Theme** — Emerald/dark UI matching 0G branding

## Environment Variables

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_REOWN_PROJECT_ID=...      # Optional, for WalletConnect
```

## Running

```bash
# Development
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (3D scene, features, roadmap, CTA) |
| `/dashboard` | Wallet panel, sessions, 0G agent memory |
| `/agent` | AI agent chat interface |
| `/policy` | Policy rules configuration + session provisioning |
| `/mcp` | MCP endpoint & connection tutorials |

## Performance Optimizations

- **Device detection** — Low-end devices get CSS fallback instead of 3D
- **Simplified Bloom** — Reduced passes and intensity for post-processing
- **Pause offscreen** — Canvas stops rendering when not in viewport (IntersectionObserver)
- **Lazy loading** — RobotScene loaded via dynamic import
- **AdaptiveDpr** — Auto-reduces pixel ratio on low FPS
