# immortalwrt-swanctl

A working fork of `luci-app-strongswan-swanctl` for **ImmortalWrt master**
(kernel 6.18.x, aarch64), with explicit strongSwan installation profiles.

The project is intentionally split into:

- a **UI core** package, which contains the LuCI application;
- three **mutually exclusive profile** packages (default / full / minimal),
  which pull in the correct strongSwan components.

The upstream LuCI app only depends on `strongswan-swanctl` and `swanmon`.
`strongswan-swanctl` does **not** contain the charon daemon, so a fresh install
can show the UI while having no working strongSwan service. This project fixes
that by making the user choose a profile at install time.

## Target

- Firmware: ImmortalWrt master snapshot
- Kernel: 6.18.55
- Architecture: aarch64
- Package manager: apk (OpenWrt 25.12 / ImmortalWrt snapshot)
- LuCI: ImmortalWrt master

The package is pure JS/ucode and is built as `PKGARCH=all`, but it must be
built with an SDK matching the firmware generation so that the dependency
metadata and LuCI build helpers match.

## Upstream source addresses

| Component | URL | Path |
|---|---|---|
| ImmortalWrt main | https://github.com/immortalwrt/immortalwrt | branch `master` |
| ImmortalWrt LuCI | https://github.com/immortalwrt/luci | `applications/luci-app-strongswan-swanctl` |
| ImmortalWrt packages | https://github.com/immortalwrt/packages | `net/strongswan`, `utils/swanmon` |
| OpenWrt LuCI (newer reference) | https://github.com/openwrt/luci | `applications/luci-app-strongswan-swanctl` |
| OpenWrt packages | https://github.com/openwrt/packages | `net/strongswan` |
| swanmon | https://github.com/TDT-AG/swanmon | upstream tool used by the status view |
| strongSwan | https://github.com/strongswan/strongswan | upstream daemon source |
| strongSwan downloads | https://download.strongswan.org/ | release tarballs |

Pinned commits used for the initial import are in `SOURCES.md`.

## Layout

```
immortalwrt-swanctl/
├── package/luci-app-strongswan-swanctl/   # working package (tracked)
│   ├── Makefile
│   ├── htdocs/...
│   ├── root/usr/sbin/swanctl-profile-check
│   └── po/...
├── upstream/                              # read-only source snapshots (ignored)
│   ├── luci/...
│   └── packages/...
├── docs/
├── scripts/
└── build/                                 # build output (ignored)
```

## Profiles

| Package | strongSwan base | Extra packages | Status view |
|---|---|---|---|
| `luci-app-strongswan-swanctl` | `strongswan-swanctl` only | UI core, no charon | depends on profile |
| `...-default` | `strongswan-default` | gcm, chapoly, curve25519, pkcs8, pkcs12, sha3, swanmon | structured |
| `...-full` | `strongswan-full` | swanmon | structured |
| `...-minimal` | `strongswan-minimal` | vici, attr, pem, pkcs1, pkcs8, sha2, kdf, gcm | text fallback, no swanmon |

Install **exactly one** of the three profile packages. Each profile has a
`preinst` guard that refuses to install while another profile marker exists;
the UI core is installed automatically as a dependency. Remove the current
profile before switching.

> `swanmon` depends on `davici` and `glib2` (about 3.2 MB installed on
> 24.10). The minimal profile deliberately avoids it.

## Build

Download the ImmortalWrt SDK for the target (for a generic aarch64 test build,
the `armsr/armv8` SDK works; for the router use the SDK matching its target):

```sh
# Example; replace with the SDK matching the router target and snapshot.
wget https://downloads.immortalwrt.org/snapshots/targets/armsr/armv8/immortalwrt-sdk-armsr-armv8_gcc-14.4.0_musl.Linux-x86_64.tar.zst
tar --zstd -xf immortalwrt-sdk-*.tar.zst
cd immortalwrt-sdk-*
```

Link this package into the SDK and build:

```sh
ln -s /root/DeepSeek/immortalwrt-swanctl/package/luci-app-strongswan-swanctl \
      package/luci-app-strongswan-swanctl
make defconfig
make package/luci-app-strongswan-swanctl/compile V=s -j$(nproc)
```

The core target builds all four packages in the directory. The output is
under `bin/packages/<arch>/base/` (or `luci/` depending on the feed layout).
All packages are `PKGARCH=all`; the profile meta packages still carry
target-independent metadata.

### Build helper

`scripts/build.sh` wraps the above and copies artifacts into `build/out`.

## Install (apk)

```sh
# Remove the old app package first; keep the configuration and certificates.
apk del luci-app-strongswan-swanctl 2>/dev/null || true

# Choose ONE profile. full is the requested default.
apk add --allow-untrusted /tmp/luci-app-strongswan-swanctl-full_*.apk

# Refresh LuCI/rpcd caches.
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

Verify:

```sh
/usr/sbin/swanctl-profile-check full
/etc/init.d/swanctl status
/usr/sbin/swanctl --list-conns
```

## Rollback

Keep the old `.apk` and a copy of `/etc/config/ipsec`:

```sh
cp /etc/config/ipsec /root/ipsec.bak
apk del luci-app-strongswan-swanctl-full
apk add --allow-untrusted /root/luci-app-strongswan-swanctl-old.apk
cp /root/ipsec.bak /etc/config/ipsec
/etc/init.d/swanctl restart
```

Never do this over the IPsec tunnel you are editing; use LAN or out-of-band
access.

## Status

- [x] Import ImmortalWrt source snapshot
- [x] Add profile packages and dependency checker
- [x] Add Chinese translation and profile status banner
- [x] Compile all four packages in an aarch64 SDK (build-time dependency stubs used for the SDK test)
- [ ] Port the newer LuCI views / finish the UI rewrite
- [ ] Install on the router and verify existing tunnels
