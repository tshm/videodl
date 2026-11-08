#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"

# Keep the plugin and server on the same release.
version=2.0.2
plugin_dir="$PWD/.yt-dlp-plugins"
mkdir -p "$plugin_dir"
archive=$(mktemp)
trap 'rm -f "$archive"' EXIT
curl --fail --location --retry 3 \
  "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/$version/bgutil-ytdlp-pot-provider.zip" \
  --output "$archive"
unzip -tq "$archive"
mv -- "$archive" "$plugin_dir/bgutil-ytdlp-pot-provider.zip"
docker compose -f compose.yaml up -d
