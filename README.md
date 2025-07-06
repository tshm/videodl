# videodl

A project for downloading videos from various sources using `yt-dlp`. It leverages Firebase Realtime Database to manage a queue of video URLs for background downloading.

## Prerequisites

Before you begin, ensure you have the following installed:

- Bun
- Devbox (for a consistent development environment)

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

## Usage

To start the background downloader process:

```bash
bun run start # Or the appropriate script from package.json
```

## Dependencies

The project uses the following dependencies:

- TypeScript
- Devbox
- Bun

---
