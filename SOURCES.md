# 源码快照

导入时间：2026-10-26 / 2026-10-27，对应 ImmortalWrt master（内核 6.18.55，aarch64）。

| 仓库 | 地址 | 分支 | 提交 |
|---|---|---|---|
| ImmortalWrt | https://github.com/immortalwrt/immortalwrt | `master` | `bc153b3d9851f5b2bb5ab4cd894402eaf57f53af` |
| ImmortalWrt LuCI | https://github.com/immortalwrt/luci | `master` | `05c955f0aca2f5e8de1c126b0ec9e9e677e83b3f` |
| ImmortalWrt packages | https://github.com/immortalwrt/packages | `master` | `0a5212e0b37c019df5a152553e571378ec6c5dcc` |
| swanmon | https://github.com/TDT-AG/swanmon | `master` | `c0e2e3c282937b90888e38aaf1195d089b370f40` |

## 导入路径

- LuCI 应用：`applications/luci-app-strongswan-swanctl`
  - https://github.com/immortalwrt/luci/tree/master/applications/luci-app-strongswan-swanctl
- strongSwan 包：`net/strongswan`
  - https://github.com/immortalwrt/packages/tree/master/net/strongswan
- swanmon 包：`utils/swanmon`
  - https://github.com/immortalwrt/packages/tree/master/utils/swanmon
- xfrm 包：`package/network/config/xfrm`
  - https://github.com/immortalwrt/immortalwrt/tree/master/package/network/config/xfrm
- luci-proto-xfrm：`protocols/luci-proto-xfrm`
  - https://github.com/immortalwrt/luci/tree/master/protocols/luci-proto-xfrm

## 相关上游

- OpenWrt LuCI 新版应用（改造参考）：
  https://github.com/openwrt/luci/tree/master/applications/luci-app-strongswan-swanctl
- OpenWrt strongSwan 包：
  https://github.com/openwrt/packages/tree/master/net/strongswan
- strongSwan 上游：
  https://github.com/strongswan/strongswan
- strongSwan 发布包：
  https://download.strongswan.org/

## 说明

ImmortalWrt master 跟随 OpenWrt master。它自带的应用比 OpenWrt master 旧
（没有独立的 Secrets 页面）。本项目已经不再沿用原来的 UCI 表单页面，而是
改为直接管理 `/etc/swanctl/profiles` 和 `/etc/swanctl/conf.d` 的文件管理器。

以上提交用于复现导入时的状态；更新源码时修改本文件。
