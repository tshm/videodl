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

Following the [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide),
the worker uses the `mweb` client and the
[bgutil provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider).
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
  --extractor-args 'youtube:player_client=mweb' -v --simulate \
  'https://www.youtube.com/watch?v=jNQXAC9IVRw'
```

Look for `PO Token Providers: bgutil:http-2.0.2` and
`Generating a gvs PO Token for mweb client`. Plugin discovery alone does not
prove token generation. PO Tokens do not bypass IP-based sign-in restrictions;
YouTube may still require cookies.

Manage the server with `docker compose logs pot-provider` or
`docker compose down`. To upgrade, change the version in both `setup-pot.sh`
and `compose.yaml`, then rerun setup.

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
