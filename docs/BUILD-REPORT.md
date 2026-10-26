# 构建报告

日期：2026-10-27

## 构建环境

- SDK：ImmortalWrt snapshot `armsr/armv8`
  （`immortalwrt-sdk-armsr-armv8_gcc-14.4.0_musl.Linux-x86_64.tar.zst`）
- 目标包架构：`aarch64_generic`
- 目标内核：6.18.55
- 包管理器：apk
- 主机：Debian x86_64，GCC 14

路由器是 aarch64 / 内核 6.18.55，对应 ImmortalWrt master。实际路由器的
target 可能不是 armsr，但包是 `PKGARCH=all`，依赖只写包名，因此产物可跨
aarch64 target 使用。最终部署建议再用路由器同 target 的 SDK 复编一次。

## 构建命令

```sh
cd build/sdk
make package/luci-app-strongswan-swanctl/compile V=s
```

## 构建期依赖 stub

为了不在本地下载/编译整棵 strongSwan、LuCI 依赖树，SDK 里用了 22 个
**构建期 stub** 满足依赖图。它们只参与构建，不会进入安装包。

生成的 APK 元数据仍然是真实运行包名。核心包的实际依赖：

```
libc
luci-base
luci-proto-xfrm
strongswan
strongswan-charon
strongswan-mod-vici
strongswan-swanctl
xfrm
```

full profile 的实际依赖：

```
libc
luci-app-strongswan-swanctl
strongswan-full
swanmon
```

## 产物

```
build/out/luci-app-strongswan-swanctl-1.0.0-r1.apk
build/out/luci-app-strongswan-swanctl-default-1.0.0-r1.apk
build/out/luci-app-strongswan-swanctl-full-1.0.0-r1.apk
build/out/luci-app-strongswan-swanctl-minimal-1.0.0-r1.apk
build/out/SHA256SUMS
```

SHA256：

```
8ed1423bd1180d3f925eb3c2f863d56e17060466632e22fc7bc7d982cb5c94bc  luci-app-strongswan-swanctl-1.0.0-r1.apk
9fabd2993dc85e6b096ec307ba365f95ea3292e01f7d98aaf5b4fde42894dd0e  luci-app-strongswan-swanctl-default-1.0.0-r1.apk
97d3574aaf8b1d86d12749e8d854ccfe30352351859e3181e5cc06c9083791f8  luci-app-strongswan-swanctl-full-1.0.0-r1.apk
a633b239d606492a751577f473d7f637ba4eabcee930ba8cd79f04dede99a942  luci-app-strongswan-swanctl-minimal-1.0.0-r1.apk
```

APK 使用 SDK 的临时密钥签名。安装时用
`apk add --allow-untrusted`，或者用路由器自己的密钥重新签名后放进本地仓库。

## 已做检查

- 所有 JS 通过 `node --check`。
- 菜单/ACL JSON 通过 `python3 -m json.tool`。
- RPC 脚本通过 `ucode -c` 编译检查。
- `swanctl-profile-check` 通过 `sh -n`。
- `apk adbdump` 确认核心依赖包含 `strongswan`、`xfrm`、
  `luci-proto-xfrm`。
- 核心 APK 包含五个页面、`api.js`、RPC 脚本、profile 检查脚本和中文
  `.lmo`。

## 尚未完成

- 在真实路由器上安装。
- 验证服务启停、profile 切换、上传/生成/编辑/日志页面的实际浏览器行为。
- 用现有隧道做回归。
- 更严格的 swanctl 配置语法预检（当前保存后由 reload 结果反馈）。
- 用路由器同 target SDK 和签名密钥重新出包。
