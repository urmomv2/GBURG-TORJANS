#!/usr/bin/env bash
# scripts/download-games.sh
# Downloads the Trojans game library during Docker build.
# Primary:  PeteZah-Games/Games-lib
# Fallback: urmomv2/Games-files
# Destination: server/data/storage/ag/

set -e

PRIMARY="https://github.com/PeteZah-Games/Games-lib/archive/refs/heads/main.zip"
FALLBACK="https://github.com/urmomv2/Games-files/archive/refs/heads/main.zip"

DEST="server/data/storage/ag"
TMP="$(mktemp -d)"
ZIP="$TMP/games.zip"

mkdir -p "$DEST"

echo "📥 Downloading game library..."

if curl -fsSL "$PRIMARY" -o "$ZIP"; then
  echo "✅ Primary source OK (PeteZah-Games/Games-lib)"
elif curl -fsSL "$FALLBACK" -o "$ZIP"; then
  echo "✅ Fallback source OK (urmomv2/Games-files)"
else
  echo "❌ Both sources failed"
  rm -rf "$TMP"
  exit 1
fi

echo "📦 Extracting archive..."
unzip -q "$ZIP" -d "$TMP"

# Locate the extracted folder (usually <repo>-main)
EXTRACTED="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d -name '*-main' | head -n 1)"

if [ -z "$EXTRACTED" ]; then
  echo "❌ Could not find extracted folder"
  rm -rf "$TMP"
  exit 1
fi

echo "📂 Copying into $DEST (existing files preserved)..."

# -n = no-clobber, so any game you already added locally stays intact
cp -rn "$EXTRACTED"/* "$DEST/" 2>/dev/null || true

# Ensure the well-known subfolders exist (games.json references these)
mkdir -p "$DEST/originals"
mkdir -p "$DEST/arsenic"
mkdir -p "$DEST/echo"

# Clean up
rm -rf "$TMP"

echo ""
echo "✅ Games installed into $DEST"
echo "   Top-level entries:"
ls "$DEST" | head -30
echo ""
echo "   Total folders: $(find "$DEST" -maxdepth 1 -type d | wc -l)"