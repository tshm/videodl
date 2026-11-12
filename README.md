# videodl

A project for downloading videos from various sources using `yt-dlp`. It leverages Firebase Realtime Database to manage a queue of video URLs for background downloading.

## Prerequisites

Before you begin, ensure you have the following installed:

- Bun
- Devbox (for a consistent development environment)
- yt-dlp (2025.05.22 or newer), ffmpeg
- Docker with Compose (for automatic YouTube PO Token generation)

You will also need a Firebase project with the Realtime Database enabled.

## Setup

**Clone the repository** and navigate into the directory.

## Installation

Install Dependencies

```bash
bun install
```

Configure Environment

- Create a `.env` file in the project root.
- Add your Firebase project configuration credentials to the `.env` file. You can find these in your Firebase project settings.
- Update your Firebase Realtime Database security rules. The included `rule.json` is a good starting point, which requires user authentication for read/write access.

### YouTube PO Tokens

The worker lets yt-dlp select its current default YouTube clients rather than
forcing `mweb`. This allows yt-dlp's client selection to track YouTube changes.
The [bgutil provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider)
is available when a selected client needs PO Tokens; see the
[yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide).
Install the plugin and start its local token server once:

```bash
bash setup-pot.sh
```

This downloads the version 2.0.2 plugin into `.yt-dlp-plugins/` and starts the
matching Docker image. The unauthenticated server is published only at
`127.0.0.1:4416`; do not expose it publicly. Keep Docker running when downloading.
The worker loads the plugin for both metadata lookup and downloads, independently
of the target directory. `YTDLP` overrides must support yt-dlp plugins.

Verify with a public YouTube URL (no download or Firebase access):

```bash
yt-dlp --ignore-config --plugin-dirs "$PWD/.yt-dlp-plugins" \
  -v --simulate \
  'https://www.youtube.com/watch?v=NFw-FrYmAEw'
```

Look for `PO Token Providers: bgutil:http-2.0.2` to confirm plugin discovery.
If a selected client needs a token, also expect a `Generating a ... PO Token`
line. Default clients may not request one. Simulation verifies extraction, not
media access: even `--check-formats` can succeed before a full download gets 403.

Manage the server with `docker compose logs pot-provider` or
`docker compose down`. To upgrade, change the version in both `setup-pot.sh`
and `compose.yaml`, then rerun setup.

### YouTube HTTP 403 or unexpected sign-in errors

The worker reads `<TARGET>/.yt-dlp.conf`, not just this repository's sample
configuration. That file can still force a client after a worker code change.
To use yt-dlp's defaults, remove `youtube:player_client=...` or
`youtube:player-client=...` overrides from the target configuration.
In particular, `web_creator` requires account cookies and can cause
`Please sign in` for public videos when no cookies are supplied.

If token generation and JavaScript solving succeed but media requests return
403, do not assume the token provider is missing. Forcing `mweb` can still fail.
Verify with the actual target configuration and a full download, rather than
`--ignore-config` or the sample configuration. Keep yt-dlp up to date (`dl.sh`
runs `yt-dlp -U`).

PO Tokens and default clients cannot guarantee avoiding YouTube's IP/account
restrictions; see the [provider's warning](https://github.com/Brainicism/bgutil-ytdlp-pot-provider)
and [YouTube troubleshooting guidance](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube).
Use cookies only when needed: the latter documents account-ban risks.

After verifying an actual download succeeds, remove only the affected Firebase
`/videos/{id}/error` field to requeue that item. Rows with `error` are skipped;
restarting the worker alone does not retry them.

## Usage

To start the background downloader process:

```bash
bun run index.ts /path/to/downloads
```

## Dependencies

The project uses the following dependencies:

- TypeScript
- Devbox
- Bun

---
