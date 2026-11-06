#!/bin/bash
# swanctl-ng 汉化辅助脚本
#   ./scripts/i18n.sh missing   列出 htdocs 里 _('...') 但 po 没有的字符串
#   ./scripts/i18n.sh build     用 po2lmo 重新生成 zh-cn.lmo
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/package/luci-app-strongswan-swanctl"
PO="$PKG/po/zh_Hans/strongswan-swanctl.po"
LMO="$PKG/root/usr/lib/lua/luci/i18n/strongswan-swanctl.zh-cn.lmo"

case "${1:-missing}" in
missing)
	/usr/bin/env python3 - "$PKG" "$PO" <<'PY'
import re, sys, pathlib
pkg, po_path = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
po = po_path.read_text(encoding='utf-8')
have = set(re.findall(r'^msgid "(.*)"$', po, re.M))
miss = {}
for p in (pkg / 'htdocs').rglob('*.js'):
    for m in re.finditer(r"_\\(\\s*'((?:[^'\\\\]|\\\\.){2,}?)'\\s*\\)", p.read_text(encoding='utf-8', errors='replace')):
        s = m.group(1)
        if s not in have:
            miss.setdefault(s, set()).add(p.name)
for s in sorted(miss):
    print(f'{s}\t{",".join(sorted(miss[s]))}')
print(f'-- {len(miss)} missing', file=sys.stderr)
PY
	;;
build)
	PO2LMO="${PO2LMO:-$(command -v po2lmo || true)}"
	if [ -z "$PO2LMO" ] || [ ! -x "$PO2LMO" ]; then
		echo "找不到 po2lmo：可设 PO2LMO=/path/to/po2lmo，或直接用固件构建环境里的 staging_dir/host/bin/po2lmo" >&2
		exit 1
	fi
	"$PO2LMO" "$PO" "$LMO"
	echo "built: $LMO"
	;;
*)
	echo "usage: $0 [missing|build]" >&2
	exit 1
	;;
esac
