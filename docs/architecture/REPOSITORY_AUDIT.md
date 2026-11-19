# Repository Architecture Audit — Arletex

**Audit Date:** November 2026  
**Audited Branch:** `main`  
**Target Hardware:** ASUS ROG Ally X (AMD Ryzen Z1 Extreme, Radeon 780M RDNA3, 24GB Unified LPDDR5X, Linux/Bazzite)  
**Status:** **Fully Integrated & Hardened Production Architecture.**

---

## 1. System Structure & Monorepo Overview

The Arletex system is organized as a unified monorepo with explicit layer separation:

```
Arletex/
├── apps/
│   └── desktop/                     # Electron desktop application & backend host
│       ├── py-services/             # Python ML microservices (EmbeddingGemma, Whisper, Kokoro, RVC)
│       │   └── specialists_server.py # Portable JSON HTTP microservice (port 39282)
│       ├── src/
│       │   ├── backend/             # Node.js backend & composition root (port 39281)
│       │   │   ├── server.ts        # Hardened REST/SSE server, mounts CognitiveControlBus & APE
│       │   │   ├── deviceAgencyService.ts # Wayland/X11 desktop perception & action provider
│       │   │   ├── telegramBridgeService.ts # Inbound & outbound allowlisted Telegram bridge
│       │   │   └── telemetryService.ts # Real hardware telemetry probes for ROG Ally X
│       │   ├── main/                # Electron main process (portable paths, IPC lifecycle)
│       │   ├── preload/             # Electron preload contextBridge with typed API
│       │   └── renderer/            # React 18 frontend (APE cockpit, telemetry, memory, chat)
│       └── package.json
├── packages/
│   ├── contracts/                   # Shared TypeScript interfaces & Zod validation schemas
│   ├── core/                        # Cognitive architecture, APE engines, and security controllers
│   │   ├── src/agency/              # ActionPermissionController, ClosedLoopAgencyService, VerificationEngine
│   │   ├── src/ape/                 # 49 APE engines (affective, intellectual, curiosity, continuity)
│   │   ├── src/cognitive/           # 16-stage canonical CognitiveControlBus
│   │   ├── src/memory/              # AutobiographicalMemoryService with provenance and consolidation
│   │   └── src/persona.ts           # Arle foundational persona prompt (egalitarian partnership)
│   ├── database/                    # SQLite persistence with 60 versioned migrations
│   └── inference/                   # InferenceGateway and LlamaServerAdapter (Vulkan/llama.cpp)
├── native/                          # Native C++ reflex engine for Wayland/X11 desktop interaction
└── scripts/                         # Bootstrap, lifecycle, inference startup, and testing scripts
```

---

## 2. Hardening & Verification Status

### A. Universal Security Boundary
- **Consolidation:** `ActionPermissionController` serves as the authoritative single authorization gate.
- **Approval Tokens:** Cryptographic HMAC-SHA256 tokens bound to immutable action digests, nonces, and short-lived expiry.
- **Fail-Closed:** Missing controllers, unknown actions, emergency shutdown, or unallowlisted resources fail closed.

### B. Closed-Loop Agency & Empirical Verification
- **Concrete Providers:** Real `PlaywrightBrowserProvider` and `SafeComputerAgencyService` wired in `server.ts`.
- **Zero Fabrication:** Removed mock PIDs, synthetic screenshots, and fake page observations. All steps require genuine post-action evidence from `VerificationEngine`.

### C. Canonical Cognitive Orchestration
- **Pipeline:** 16-stage `CognitiveControlBus` handles perception, appraisal, deliberation, authorization, execution, verification, and learning.
- **Fallback Elimination:** Removed silent fallback from bus errors to legacy cycles; bus failures are explicitly logged and tracked.

### D. Psychological Integration & Equality
- **Partner Equality:** Arle and Proof are strictly equal partners in all creative, intellectual, and personal domains.
- **Longitudinal Grounding:** Replaced arbitrary score inflation with empirical evidence evaluation across memory, goals, and security audits.
