# Profile design

## Why profiles are separate packages

The upstream package declares:

```make
LUCI_DEPENDS:=+strongswan-swanctl +swanmon
```

`strongswan-swanctl` contains the `swanctl` binary, the VICI plugin, the
`/etc/init.d/swanctl` script and `/etc/config/ipsec`, but **not** the
`charon` daemon. A fresh install can therefore open the LuCI page while the
service has no daemon.

opkg and apk have no reliable "choose one of three" dependency syntax for this
case. The repository therefore builds:

- `luci-app-strongswan-swanctl`: the UI core;
- `luci-app-strongswan-swanctl-default`: UI + `strongswan-default` + extras;
- `luci-app-strongswan-swanctl-full`: UI + `strongswan-full`;
- `luci-app-strongswan-swanctl-minimal`: UI + `strongswan-minimal` + extras.

The three profile packages carry a `preinst` guard: if another profile marker
exists, the install aborts and tells the user to remove the current profile
first. This is the real runtime protection on apk, whose package metadata does
not expose the OpenWrt `CONFLICTS` field in `apk adbdump`.

One-way `CONFLICTS` fields are kept for opkg/Kconfig users
(`full` conflicts with `default` and `minimal`; `minimal` conflicts with
`default`). Mutual conflicts were avoided because they produce a Kconfig
recursive-dependency error. Do not rely on the metadata alone: switch profiles
with `apk del` first, then install the new one.

The UI core is installed as a dependency, so only one UI copy and one set of
translation assets exists.

## Dependency rationale

### default

`strongswan-default` already includes charon, swanctl/VICI, kernel-netlink,
socket-default, x509, pem, pkcs1, attr, updown, sha2 and the other upstream
defaults. The profile adds:

| Package | Why |
|---|---|
| `swanmon` | structured status output; pulls davici/glib2 |
| `strongswan-mod-gcm` | AES-GCM, the normal modern ESP cipher |
| `strongswan-mod-chapoly` | ChaCha20-Poly1305 |
| `strongswan-mod-curve25519` | X25519 key exchange |
| `strongswan-mod-pkcs8` | PKCS#8 private keys |
| `strongswan-mod-pkcs12` | PKCS#12 bundles |
| `strongswan-mod-sha3` | SHA-3 proposals |

### full

`strongswan-full` is the upstream meta package. ImmortalWrt snapshot feeds
currently publish it for both `aarch64_cortex-a53` and `aarch64_generic`
(checked 2026-10-26). It is large; the installer should check overlay space
first. The profile adds only `swanmon`.

### minimal

`strongswan-minimal` includes charon, kernel-netlink, socket-default, aes,
gmp, hmac, mgf1, pubkey, random, sha1, updown, x509 and xcbc. It does **not**
include `swanctl`, VICI, attr, pem, pkcs1, pkcs8, sha2, kdf or gcm. The
profile adds:

| Package | Why |
|---|---|
| `strongswan-swanctl` | init script, UCI config, swanctl CLI |
| `strongswan-mod-vici` | management socket (explicit, not relying on the dependency chain) |
| `strongswan-mod-attr` | pools, virtual IPs, DNS/split attributes |
| `strongswan-mod-pem` | PEM certificates/keys |
| `strongswan-mod-pkcs1` | PKCS#1 RSA keys |
| `strongswan-mod-pkcs8` | PKCS#8 keys |
| `strongswan-mod-sha2` | SHA-2 signatures and PRFs |
| `strongswan-mod-kdf` | key derivation |
| `strongswan-mod-gcm` | AES-GCM |

It deliberately does **not** install `swanmon`, because that pulls
`davici`/`glib2` (about 3.2 MB installed on 24.10). The status view must
fall back to text output on this profile.

## Runtime check

`/usr/sbin/swanctl-profile-check [profile]` verifies the expected binaries and
plugin files. The Service page calls it and shows the result. It is
intentionally file-based so it also works before charon starts.

## Switching profiles

Remove the current profile first, then install the other:

```sh
apk del luci-app-strongswan-swanctl-full
apk add --allow-untrusted luci-app-strongswan-swanctl-default_*.apk
```

Removing a meta package does not remove the packages it pulled in. To reclaim
space, remove the old plugins manually after checking that nothing else needs
them. Keep `/etc/config/ipsec` and `/etc/swanctl` untouched.
