# Source snapshots

Imported on 2026-10-26 for ImmortalWrt master (kernel 6.18.55, aarch64).

| Repository | URL | Branch | Commit |
|---|---|---|---|
| ImmortalWrt | https://github.com/immortalwrt/immortalwrt | `master` | `bc153b3d9851f5b2bb5ab4cd894402eaf57f53af` |
| ImmortalWrt LuCI | https://github.com/immortalwrt/luci | `master` | `05c955f0aca2f5e8de1c126b0ec9e9e677e83b3f` |
| ImmortalWrt packages | https://github.com/immortalwrt/packages | `master` | `0a5212e0b37c019df5a152553e571378ec6c5dcc` |
| swanmon | https://github.com/TDT-AG/swanmon | `master` | `c0e2e3c282937b90888e38aaf1195d089b370f40` |

## Imported paths

- LuCI app: `applications/luci-app-strongswan-swanctl`
  - https://github.com/immortalwrt/luci/tree/master/applications/luci-app-strongswan-swanctl
- strongSwan package: `net/strongswan`
  - https://github.com/immortalwrt/packages/tree/master/net/strongswan
- swanmon package: `utils/swanmon`
  - https://github.com/immortalwrt/packages/tree/master/utils/swanmon

## Related upstreams

- OpenWrt LuCI app (newer refactor, useful reference for the rewrite):
  https://github.com/openwrt/luci/tree/master/applications/luci-app-strongswan-swanctl
- OpenWrt strongSwan package:
  https://github.com/openwrt/packages/tree/master/net/strongswan
- strongSwan upstream:
  https://github.com/strongswan/strongswan
- strongSwan release tarballs:
  https://download.strongswan.org/

## Notes

ImmortalWrt master tracks OpenWrt master. Its LuCI app is older than the
OpenWrt master app (it has no separate Secrets page and an older General
page). The rewrite will keep the ImmortalWrt UCI schema and port the useful
newer pieces instead of replacing the schema.

The upstream package metadata is recorded here for reproducibility. To update
the snapshots, rerun the clone commands with the desired branch/commit and
update this file.
