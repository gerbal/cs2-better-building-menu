#!/usr/bin/env bash
set -euo pipefail

# This script deliberately builds and packages only the successor identity.
# It never defaults to the live game Mods directory and it refuses to write a
# folder named after upstream Find It.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD_NAME="BetterBuildingMenu"
PROJECT_DIR="$SCRIPT_DIR/BetterBuildingMenu"
UI_DIR="$PROJECT_DIR/UI"
BUILD_CONFIG="${CS2_BUILD_CONFIG:-Debug}"
DLL="$PROJECT_DIR/bin/$BUILD_CONFIG/net48/$MOD_NAME.dll"
UI_BUILD="$UI_DIR/build"
PACKAGE_DIR="$SCRIPT_DIR/artifacts/$MOD_NAME"
TEST_PROJECT="$SCRIPT_DIR/BetterBuildingMenu.Tests/BetterBuildingMenu.Tests.csproj"

DOTNET_BIN="${DOTNET:-dotnet}"

require_command() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "ERROR: required command not found: $1" >&2
        exit 1
    }
}

build_backend() {
    require_command "$DOTNET_BIN"
    echo "=== Building $MOD_NAME backend ==="
    (
        cd "$PROJECT_DIR"
        "$DOTNET_BIN" build -c "$BUILD_CONFIG" -p:SkipBuildUI=true
    )
}

build_ui() {
    require_command npm
    echo "=== Building $MOD_NAME UI ==="
    if [ ! -d "$UI_DIR/node_modules" ]; then
        (
            cd "$UI_DIR"
            npm ci --ignore-scripts
        )
    fi
    (
        cd "$UI_DIR"
        CSII_UI_OUTPUT_DIR="$UI_BUILD" npm run build
    )
}

run_tests() {
    require_command "$DOTNET_BIN"
    echo "=== Testing $MOD_NAME catalog contracts ==="
    (
        cd "$SCRIPT_DIR/BetterBuildingMenu.Tests"
        "$DOTNET_BIN" test "$TEST_PROJECT" -p:SkipBuildUI=true
    )
}

package_artifacts() {
    echo "=== Packaging $MOD_NAME ==="
    [ -f "$DLL" ] || { echo "ERROR: backend DLL missing; run '$0 backend' first." >&2; exit 1; }
    [ -f "$UI_BUILD/$MOD_NAME.mjs" ] || { echo "ERROR: UI bundle missing; run '$0 ui' first." >&2; exit 1; }
    [ -f "$UI_BUILD/$MOD_NAME.css" ] || { echo "ERROR: UI stylesheet missing; run '$0 ui' first." >&2; exit 1; }

    rm -rf "$PACKAGE_DIR"
    mkdir -p "$PACKAGE_DIR"
    cp "$DLL" "$PACKAGE_DIR/$MOD_NAME.dll"
    cp "$SCRIPT_DIR/modinfo.json" "$PACKAGE_DIR/modinfo.json"
    cp "$UI_BUILD/$MOD_NAME.mjs" "$PACKAGE_DIR/$MOD_NAME.mjs"
    cp "$UI_BUILD/$MOD_NAME.css" "$PACKAGE_DIR/$MOD_NAME.css"
    if [ -d "$UI_BUILD/images" ] || [ -d "$PROJECT_DIR/Resources/Images" ]; then
        mkdir -p "$PACKAGE_DIR/images"
        # Webpack assets and the fork's runtime-hosted icons share the same
        # betterbuildingmenu host location. Merge both sets so filter,
        # category, picker, and parking controls never resolve to placeholders.
        [ -d "$UI_BUILD/images" ] && cp -a "$UI_BUILD/images/." "$PACKAGE_DIR/images/"
        [ -d "$PROJECT_DIR/Resources/Images" ] && cp -a "$PROJECT_DIR/Resources/Images/." "$PACKAGE_DIR/images/"
    fi

    # A package containing either the upstream runtime ID or its publisher ID
    # is unsafe to deploy. Keep this check close to the artifact boundary, and
    # fail closed: grep exits 0 for a match, 1 for none and 2 (or 127, when it
    # cannot run at all) for an error, and only a clean 1 lets the package through.
    # -I skips binaries, so the DLL's bytes cannot match by accident.
    local identity_status=0
    grep -rnEI '"FindIt"|coui://findit([/"`]|$)|77240|CSII_TOOLPATH' "$PACKAGE_DIR" || identity_status=$?
    case "$identity_status" in
        0)
            echo "ERROR: package contains an upstream Find It identity." >&2
            exit 1
            ;;
        1) ;;
        *)
            echo "ERROR: the Find It identity check could not run (grep exited $identity_status)." >&2
            exit 1
            ;;
    esac

    echo "Package ready: $PACKAGE_DIR"
}

deploy_isolated() {
    package_artifacts
    : "${CSII_SUCCESSOR_MODS_DIR:?Set CSII_SUCCESSOR_MODS_DIR to an isolated Mods directory before deploy}"

    case "$(basename "$CSII_SUCCESSOR_MODS_DIR")" in
        FindIt|FindIt.disabled)
            echo "ERROR: refusing an upstream Find It Mods directory: $CSII_SUCCESSOR_MODS_DIR" >&2
            exit 1
            ;;
    esac

    local target="$CSII_SUCCESSOR_MODS_DIR/$MOD_NAME"
    if [ -e "$target" ]; then
        echo "ERROR: refusing to overwrite existing target; remove or archive it first: $target" >&2
        exit 1
    fi

    mkdir -p "$CSII_SUCCESSOR_MODS_DIR"
    cp -a "$PACKAGE_DIR" "$target"
    echo "Successor deployed to isolated target: $target"
}

action="${1:-all}"
case "$action" in
    backend) build_backend ;;
    ui) build_ui ;;
    all) build_backend; build_ui ;;
    test) run_tests ;;
    package) package_artifacts ;;
    deploy) deploy_isolated ;;
    *)
        echo "Usage: $0 [backend|ui|all|test|package|deploy]" >&2
        exit 1
        ;;
esac
