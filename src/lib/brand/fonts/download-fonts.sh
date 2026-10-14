#!/bin/sh
# metadose — Font downloader
# Run once to pull the two variable font files needed for self-hosting.
# Usage: cd fonts && sh download-fonts.sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Downloading Space Grotesk Variable..."
curl -L -o "$DIR/SpaceGrotesk-Variable.woff2" \
  "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gowFXNvNY74VHk.woff2"

echo "Downloading JetBrains Mono Variable..."
curl -L -o "$DIR/JetBrainsMono-Variable.woff2" \
  "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjOVmNov_l.woff2"

echo ""
echo "Done. Files saved to:"
echo "  $DIR/SpaceGrotesk-Variable.woff2"
echo "  $DIR/JetBrainsMono-Variable.woff2"
echo ""
echo "Next: follow the setup steps in fonts/font-face.css"
