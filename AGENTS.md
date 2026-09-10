# Repository Guidelines

## Project Overview

`videodl` is a Bun/TypeScript background downloader. It uses Firebase Realtime Database as a `/videos` queue, runs `yt-dlp` for each pending URL, then records success (`watched=true`) or failure (`error`) back to Firebase.

## Architecture & Data Flow

- Queue ingress: `workflows/yt.yml` is an Actionsflow workflow watching a YouTube playlist and POSTing `{ url, title, mark: "actionsflow" }` to a Firebase endpoint.
- Runtime entry: `dl.sh` loads `.env.*`, updates `yt-dlp`, then runs `bun run -r '@hyperdx/node-opentelemetry/build/src/tracing' index.ts $TARGET`.
- Main worker: `index.ts` is the whole app:
  1. `processArguments()` requires a download working directory argument and builds the `yt-dlp` command prefix.
  2. `VideoDb().forEach(execDl(args))` reads Firebase `/videos`.
  3. Items without `url` or with `error` are skipped; `watched=true` items are deleted.
  4. `execDl()` sanitizes the title, runs `yt-dlp --no-progress --output <safe-title>.%(ext)s -- <url>`, then marks the row watched or stores an error.
- External state comes from environment variables: Firebase config (`apiKey`, `authDomain`, `databaseURL`, `storageBucket`), `TARGET`, `DRY_RUN`, `LIMIT`, and optional `YTDLP`.
- Keep fixes small: this is intentionally a single-file worker, not a layered service. Prefer changing the shared helper (`VideoDb`, `execDl`, `run`) over adding caller-side patches.

## Key Directories

- `index.ts` - core downloader, Firebase queue handling, subprocess execution, process exit.
- `workflows/` - Actionsflow source workflows; currently `workflows/yt.yml` queues playlist videos.
- `.github/workflows/` - CI and automation workflows for Actionsflow, dependency maintenance, and Earthly image builds.
- `.vscode/` - editor settings/legacy launch config; do not treat this as runtime source.
- Root config files - this repo is flat; there is no `src/`, `tests/`, or app subpackage tree.

## Development Commands

Use Bun and devbox from `devbox.json` (`bun@1.2.5`, `ffmpeg@7.1.1`).

```bash
bun install
bun run run          # runs: bun run index.ts .
bun run test         # runs: env DRY_RUN=true bun run index.ts .
./dl.sh              # production-style wrapper; expects TARGET and .env.*
```

Notes:

- `package.json` has no `build`, `lint`, or `start` script.
- README mentions `bun run start`, but the actual script is `bun run run`.
- CI references `./earthly --ci --push ... +build`, but no `Earthfile` is present in this checkout.

## Code Conventions & Common Patterns

- TypeScript is strict, ESNext, Bun-oriented (`tsconfig.json`: `module: "esnext"`, `moduleResolution: "nodenext"`, `types: ["bun-types"]`).
- Formatting: Prettier is installed and configured for single quotes in `package.json`; no lint config exists.
- Async pattern: Firebase work uses `async`/`await`; `run()` wraps `Bun.spawnSync()` in a `Promise` so downloader failures reject consistently.
- Error handling:
  - Per-video failures are caught inside `VideoDb.forEach()` and persisted to `/videos/{id}/error`.
  - Top-level failures are caught in `main()` and mapped to process exit code `1`.
  - Do not silently swallow errors; include enough context for the queue item/title.
- State management is Firebase-only. Avoid adding local caches or process-global state unless a measured runtime issue needs it.
- Dependency pattern: use existing dependencies (`firebase`, `sanitize-filename`, Bun APIs) before adding anything. New packages need strong justification.
- Filename handling belongs in `getSafeBasename()`; downloader command construction belongs in `execDl()`.
- Environment booleans are string-based today: any set `DRY_RUN` value is treated as enabled.

## Important Files

- `index.ts` - app entrypoint and core logic (`processArguments`, `run`, `getSafeBasename`, `execDl`, `VideoDb`, `main`).
- `dl.sh` - runtime wrapper for env loading, `yt-dlp -U`, OpenTelemetry preload, and Bun execution.
- `package.json` - Bun scripts and dependencies.
- `bun.lockb` - Bun dependency lockfile; do not replace with npm/yarn/pnpm locks unless intentionally migrating tooling.
- `devbox.json` / `devbox.lock` - pinned local toolchain.
- `tsconfig.json` - TypeScript/Bun compiler assumptions.
- `.env.default`, `.env.local`, `.envrc` - local env stack; `.envrc` loads defaults, optional local overrides, then devbox env.
- `sample.yt-dlp.conf` - example `.yt-dlp.conf` expected in the target download directory.
- `rule.json` - Firebase RTDB rules template for authenticated access to `videos`.
- `workflows/yt.yml` - YouTube playlist to queue ingestion workflow.
- `.github/workflows/ci.yml` - Earthly/GHCR build workflow.

## Runtime/Tooling Preferences

- Prefer Bun over Node/npm for app execution and dependency install in normal development.
- Prefer devbox for local shell setup because it pins Bun and ffmpeg.
- Keep `.env`, `.env.local`, `.yt-dlp.conf`, `.secrets`, and generated `dist/` artifacts out of committed changes.
- `dl.sh` reads all `.env.*` files with shell export semantics; keep env values simple and shell-safe.
- `yt-dlp` and `ffmpeg` are runtime requirements, not optional test-only tools.
- GitHub automation mixes Bun app tooling with npm-based Actionsflow maintenance workflows; do not assume npm is the app package manager.

## Testing & QA

- There is no unit-test framework, test directory, coverage config, or lint command.
- The only repo test command is a smoke run:

```bash
bun run test
```

- `bun run test` enables `DRY_RUN=true`, so it exercises the main flow without actual downloads, but still depends on runtime arguments/env and may touch Firebase config paths.
- For behavior changes, add the smallest useful check or run the narrow smoke command that covers the changed path. Do not invent a large test harness unless the code first grows enough seams to justify it.
- Before marking work complete, run available relevant checks: `bun run test` for runtime logic, plus any command you add or modify.
