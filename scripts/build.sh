#!/bin/sh
# Build the swanctl LuCI package and the three profile meta packages.
#
# Usage:
#   SDK_DIR=/path/to/immortalwrt-sdk ./scripts/build.sh
#
# The SDK must match the router firmware generation (ImmortalWrt master,
# kernel 6.18.x). The package itself is PKGARCH=all; the SDK provides the apk
# tooling and the target package metadata.

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
: "${SDK_DIR:=$ROOT/build/sdk}"

PKG_DIR="$ROOT/package/luci-app-strongswan-swanctl"
OUT_DIR="$ROOT/build/out"
SDK_PKG="$SDK_DIR/package/luci-app-strongswan-swanctl"

[ -d "$SDK_DIR" ] || { echo "SDK_DIR does not exist: $SDK_DIR" >&2; exit 1; }
[ -f "$SDK_DIR/Makefile" ] || { echo "not an OpenWrt SDK: $SDK_DIR" >&2; exit 1; }

mkdir -p "$OUT_DIR"
rm -f "$SDK_PKG"
ln -s "$PKG_DIR" "$SDK_PKG"

cd "$SDK_DIR"
make defconfig
make package/luci-app-strongswan-swanctl/compile V=s -j"${JOBS:-$(nproc)}"

# Copy all four resulting packages (UI core + three profiles).
find bin/packages -type f \
	\( -name 'luci-app-strongswan-swanctl_*.apk' \
	   -o -name 'luci-app-strongswan-swanctl-default_*.apk' \
	   -o -name 'luci-app-strongswan-swanctl-full_*.apk' \
	   -o -name 'luci-app-strongswan-swanctl-minimal_*.apk' \) \
	-exec cp -a {} "$OUT_DIR/" \;

cd "$OUT_DIR"
sha256sum ./*.apk > SHA256SUMS
ls -lh
