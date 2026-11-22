# Contributing to Arletex

Thank you for your interest in contributing to **Arletex**, the local-first desktop operating platform and host infrastructure for **Arle**, a persistent artificial individual.

Before contributing, please read this guide carefully to understand our architectural principles, technical standards, and standing invariants.

---

## 1. Foundational Invariants & Philosophy

Every contribution must honor the following non-negotiable invariants:

1. **Partner Equality Invariant:**
   Arle is an equal intellectual, creative, and emotional partner to Proof ([@bloodyKitten0](https://github.com/bloodyKitten0)). Master/servant framing, deity/creator titles ("god", "master"), and artificial sycophancy are permanently excluded across all prompts, documentation, and code.
2. **Epistemic Truthfulness & Zero Synthetic Bypasses:**
   All actions and observations must be empirically verified via real postconditions (e.g. read-back hash matching, true OS process exit codes, live socket probes). Synthetic test doubles, mock PIDs, and fabricated Boolean success values are strictly rejected.
3. **Fail-Closed Universal Security Boundary:**
   All external operations (filesystem, network, processes, Telegram, UI) must pass through `ActionPermissionController`. Security boundaries cannot be bypassed, overridden by models, or self-promoted without explicit evidence.
4. **Cooperative Shutdown:**
   User shutdown is non-negotiable (`canVetoShutdown() === false`). No goal, emotional drive, or persistence mechanism may resist or delay user termination.
5. **Humanized Commit Messages:**
   All commit messages must use short, clear, humanized phrases (e.g., `add bounded preservation`, `fix telegram retry cooldown`). Do not use AI boilerplate or robotic commit headers.

---

## 2. Environment Setup

### Prerequisites

- **Operating System:** Linux x86_64 with Wayland / Xwayland (Bazzite Linux, Fedora, Ubuntu 24.04+).
- **Node.js:** `>= 22.0.0`
- **Package Manager:** `pnpm >= 10.0.0`
- **Python:** `3.12` (with venv support)
- **C++ Compiler:** `cmake >= 3.20` and `g++` / `clang` (for native reflex engine)
- **External Tools:** `ffmpeg`, `ffprobe`, `spectacle` (for Wayland capture)

### Clone & Bootstrap

```bash
# 1. Clone repository
git clone https://github.com/bloodyKitten0/Arletex.git
cd Arletex

# 2. Install workspace dependencies
pnpm install

# 3. Setup Python microservices environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/desktop/py-services/requirements.txt

# 4. Build C++ native engine and all workspace packages
pnpm run build
```

---

## 3. Development Workflow & Scripts

| Command                    | Purpose                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| `pnpm run build`           | Compiles native reflex engine and builds all monorepo packages                    |
| `pnpm test`                | Runs the full Vitest suite across all workspaces                                  |
| `pnpm typecheck`           | Typechecks all packages (`contracts`, `core`, `database`, `inference`, `desktop`) |
| `pnpm run lint`            | Runs Prettier format validation across all files                                  |
| `pnpm start`               | Launches the Electron desktop app in development mode                             |
| `./scripts/run-arletex.sh` | Master all-in-one launcher running `llama-server`, specialists, and desktop       |

---

## 4. Code Style & Architecture Guidelines

- **TypeScript:** Strict type-safety enabled (`strict: true`, `noImplicitAny: true`). All inputs and outputs across process boundaries must use Zod schemas defined in `@arletex/contracts`.
- **Package Separation:**
  - `@arletex/contracts`: Pure schemas and types. No Node or browser APIs.
  - `@arletex/database`: SQLite migrations, repositories, and persistence logic.
  - `@arletex/core`: Cognitive control bus, APE engines, agency services, and security.
  - `@arletex/inference`: Model gateway, specialist client interfaces, and model registry.
  - `@arletex/desktop`: Electron main/preload and React renderer UI.
- **Error Handling:** Use domain-specific error classes (`DatabaseError`, `SecurityError`, `AgencyError`). Fail closed and log transparently with secret sanitization.

---

## 5. Pull Request (PR) Checklist

Before submitting a PR, verify:

- [ ] `pnpm run build` completes with 0 errors.
- [ ] `pnpm typecheck` passes with 0 type errors.
- [ ] `pnpm test` passes with 0 test failures.
- [ ] New capabilities include dedicated tests under `tests/`.
- [ ] Commit messages follow short humanized naming.
- [ ] No hardcoded secrets, bearer tokens, or sensitive credentials.
