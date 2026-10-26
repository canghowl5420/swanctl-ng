# Build report

Date: 2026-10-26

## Environment

- SDK: ImmortalWrt snapshot `armsr/armv8`
  (`immortalwrt-sdk-armsr-armv8_gcc-14.4.0_musl.Linux-x86_64.tar.zst`)
- Target package arch: `aarch64_generic`
- Target kernel: 6.18.55
- Package manager: apk
- Host: Debian x86_64, GCC 14

The SDK was used because it matches the router generation (ImmortalWrt master,
kernel 6.18.x, aarch64). The actual router target may be a different aarch64
subtarget; the packages are `PKGARCH=all` and depend only on package names,
so the artifact is target-independent. Rebuild with the exact target SDK for
the final deployment to keep feed metadata aligned.

## Build command

```sh
cd build/sdk
make package/luci-app-strongswan-swanctl/compile V=s
```

No LuCI or strongSwan source was compiled for the package itself. To keep the
SDK build fast and deterministic without downloading the full dependency tree,
18 build-time stub packages were used to satisfy the package dependency graph.
The resulting package metadata still references the **real** runtime packages:

- core: `luci-base`, `strongswan-swanctl`
- default: `strongswan-default`, `swanmon`, gcm/chapoly/curve25519/pkcs8/pkcs12/sha3
- full: `strongswan-full`, `swanmon`
- minimal: `strongswan-minimal`, vici/attr/pem/pkcs1/pkcs8/sha2/kdf/gcm

The stubs are not installed on the router and are not part of the artifacts.

## Artifacts

```
build/out/luci-app-strongswan-swanctl-1.0.0-r1.apk
build/out/luci-app-strongswan-swanctl-default-1.0.0-r1.apk
build/out/luci-app-strongswan-swanctl-full-1.0.0-r1.apk
build/out/luci-app-strongswan-swanctl-minimal-1.0.0-r1.apk
build/out/SHA256SUMS
```

The APKs are signed by the SDK's throwaway key. Install with
`apk add --allow-untrusted`, or sign them with the router's own key for a
production repository.

## Checks performed

- All JavaScript files pass `node --check`.
- ACL and menu JSON files parse with `python3 -m json.tool`.
- `/usr/sbin/swanctl-profile-check` passes `sh -n`.
- `apk adbdump` confirms the runtime dependency lists above.
- The core APK includes the LuCI views, RPC script, profile checker and
  `strongswan-swanctl.zh-cn.lmo`.

## Not yet done

- Install on the actual router.
- Verify existing tunnels and the profile switch guard on the router.
- Rebuild with the exact router target SDK and (optionally) the router's
  package signing key.
- Full UI rewrite beyond the profile banner; the current views are still the
  ImmortalWrt baseline.
