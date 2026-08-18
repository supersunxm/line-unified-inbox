#!/usr/bin/env bash
#
# build-production-apk.sh
#
# Build the OPPO LINE OA Chat production APK with required dart-defines.
# This script ensures the APK is built with API_BASE_URL and APP_ENV
# so that the app can connect to the production backend.
#
# Usage:
#   ./scripts/build-production-apk.sh
#
# The built APK will be at:
#   android_app/build/app/outputs/flutter-apk/app-release.apk
#
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
PRODUCTION_API_URL="https://line-unified-inbox-production-544f.up.railway.app"
APP_ENV="production"
FLUTTER_DIR="$(cd "$(dirname "$0")/../android_app" && pwd)"
DOWNLOADS_DIR="$(cd "$(dirname "$0")/../frontend/public/downloads" && pwd)"

# ── Color helpers ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────
info "Working directory: ${FLUTTER_DIR}"
cd "$FLUTTER_DIR"

if ! command -v flutter &>/dev/null; then
  fail "flutter is not on PATH. Install Flutter SDK first."
fi

# ── Step 1: Clean ──────────────────────────────────────────────
info "Step 1/7: Cleaning previous build artifacts..."
flutter clean
ok "Clean complete."

# ── Step 2: Dependencies ───────────────────────────────────────
info "Step 2/7: Installing dependencies..."
flutter pub get
ok "Dependencies resolved."

# ── Step 3: Localization ───────────────────────────────────────
info "Step 3/7: Generating localization files..."
flutter gen-l10n
ok "Localization generated."

# ── Step 4: Static analysis ────────────────────────────────────
info "Step 4/7: Running static analysis..."
flutter analyze || fail "Static analysis found issues. Fix them before releasing."
ok "No analysis issues."

# ── Step 5: Tests ──────────────────────────────────────────────
info "Step 5/7: Running test suite..."
flutter test || fail "Tests failed. Fix failing tests before releasing."
ok "All tests passed."

# ── Step 6: Production build ───────────────────────────────────
info "Step 6/7: Building production APK with dart-defines..."
info "  API_BASE_URL = ${PRODUCTION_API_URL}"
info "  APP_ENV      = ${APP_ENV}"

flutter build apk --release \
  --dart-define="API_BASE_URL=${PRODUCTION_API_URL}" \
  --dart-define="APP_ENV=${APP_ENV}"

APK_PATH="${FLUTTER_DIR}/build/app/outputs/flutter-apk/app-release.apk"

if [ ! -f "$APK_PATH" ]; then
  fail "APK not found at ${APK_PATH}"
fi
ok "APK built: ${APK_PATH}"

# ── Step 7: Artifact info ─────────────────────────────────────
info "Step 7/7: Computing release artifact metadata..."

APK_SIZE_BYTES=$(stat -f '%z' "$APK_PATH" 2>/dev/null || stat -c '%s' "$APK_PATH")
APK_SIZE_MB=$(python3 -c "print(f'{${APK_SIZE_BYTES} / 1_000_000:.1f}')")
APK_SHA256=$(shasum -a 256 "$APK_PATH" | awk '{print $1}')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  PRODUCTION APK BUILD COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  APK:      ${APK_PATH}"
echo "  Size:     ${APK_SIZE_MB} MB (${APK_SIZE_BYTES} bytes)"
echo "  SHA-256:  ${APK_SHA256}"
echo "  API URL:  ${PRODUCTION_API_URL}"
echo "  APP_ENV:  ${APP_ENV}"
echo ""
echo "  Next steps:"
echo "    1. Copy APK to frontend/public/downloads/"
echo "    2. Update download page checksum and size"
echo "    3. Update backend AppRelease record"
echo "    4. Commit and push"
echo ""
echo "═══════════════════════════════════════════════════════════"
