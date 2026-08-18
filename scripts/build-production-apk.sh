#!/usr/bin/env bash
#
# build-production-apk.sh
#
# Build and publish the OPPO LINE OA Chat production APK with required
# compile-time dart-defines. The script fails closed if the expected
# production API URL cannot be found in the compiled Flutter AOT binary.
#
# Usage:
#   ./scripts/build-production-apk.sh
#
set -euo pipefail

PRODUCTION_API_URL="https://line-unified-inbox-production-544f.up.railway.app"
APP_ENV="production"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLUTTER_DIR="$(cd "${SCRIPT_DIR}/../android_app" && pwd)"
DOWNLOADS_DIR="$(cd "${SCRIPT_DIR}/../frontend/public/downloads" && pwd)"
RELEASE_FILENAME="oppo-line-oa-chat-v1.0.7-production.apk"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

info "Flutter project: ${FLUTTER_DIR}"
cd "$FLUTTER_DIR"

[ -f pubspec.yaml ] || fail "pubspec.yaml not found in ${FLUTTER_DIR}; refusing to build from the wrong directory."
command -v flutter >/dev/null 2>&1 || fail "flutter is not on PATH."
command -v unzip >/dev/null 2>&1 || fail "unzip is required for APK verification."
command -v strings >/dev/null 2>&1 || fail "strings is required for APK verification."

info "Step 1/9: Cleaning previous build artifacts..."
flutter clean
ok "Clean complete."

info "Step 2/9: Installing dependencies..."
flutter pub get
ok "Dependencies resolved."

info "Step 3/9: Generating localization files..."
flutter gen-l10n
ok "Localization generated."

info "Step 4/9: Running static analysis..."
flutter analyze || fail "Static analysis found issues."
ok "Static analysis passed."

info "Step 5/9: Running tests..."
flutter test || fail "Tests failed."
ok "Tests passed."

info "Step 6/9: Building release APK with production dart-defines..."
printf '  API_BASE_URL = %s\n' "$PRODUCTION_API_URL"
printf '  APP_ENV      = %s\n' "$APP_ENV"
flutter build apk --release \
  --dart-define="API_BASE_URL=${PRODUCTION_API_URL}" \
  --dart-define="APP_ENV=${APP_ENV}"

APK_PATH="${FLUTTER_DIR}/build/app/outputs/flutter-apk/app-release.apk"
[ -f "$APK_PATH" ] || fail "APK not found at ${APK_PATH}"
ok "APK built: ${APK_PATH}"

info "Step 7/9: Verifying production URL exists in compiled Flutter AOT binary..."
VERIFY_DIR="$(mktemp -d)"
trap 'rm -rf "$VERIFY_DIR"' EXIT
unzip -q "$APK_PATH" 'lib/*/libapp.so' -d "$VERIFY_DIR"

FOUND_URL=false
while IFS= read -r -d '' APP_SO; do
  # Do not use grep -q here: with pipefail it can terminate strings early and
  # turn a successful match into a SIGPIPE failure from the upstream command.
  if strings "$APP_SO" | grep -F "$PRODUCTION_API_URL" >/dev/null; then
    FOUND_URL=true
    break
  fi
done < <(find "$VERIFY_DIR" -type f -name libapp.so -print0)

[ "$FOUND_URL" = true ] || fail "Compiled APK does not contain ${PRODUCTION_API_URL}. dart-define injection cannot be verified; artifact will NOT be published."
ok "Compiled APK contains the expected production API URL."

info "Step 8/9: Publishing the exact verified APK to the download artifact..."
PUBLISHED_APK="${DOWNLOADS_DIR}/${RELEASE_FILENAME}"
cp -f "$APK_PATH" "$PUBLISHED_APK"
cmp -s "$APK_PATH" "$PUBLISHED_APK" || fail "Published APK does not match the verified build output."
ok "Published APK: ${PUBLISHED_APK}"

info "Step 9/9: Computing release artifact metadata..."
APK_SIZE_BYTES=$(stat -f '%z' "$PUBLISHED_APK" 2>/dev/null || stat -c '%s' "$PUBLISHED_APK")
APK_SIZE_MB=$(python3 -c "print(f'{${APK_SIZE_BYTES} / 1_000_000:.1f}')")
APK_SHA256=$(shasum -a 256 "$PUBLISHED_APK" | awk '{print $1}')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  VERIFIED PRODUCTION APK BUILD COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo "  APK:       ${PUBLISHED_APK}"
echo "  Size:      ${APK_SIZE_MB} MB (${APK_SIZE_BYTES} bytes)"
echo "  SHA-256:   ${APK_SHA256}"
echo "  API URL:   ${PRODUCTION_API_URL}"
echo "  APP_ENV:   ${APP_ENV}"
echo "  AOT check: PASS"
echo ""
echo "  Runtime verification:"
echo "    Install this exact APK and open Runtime diagnostics on the login screen."
echo "    Expected APP_ENV: production"
echo "    Expected API_BASE_URL: ${PRODUCTION_API_URL}"
echo "═══════════════════════════════════════════════════════════"
