# immortalwrt-swanctl

面向 **ImmortalWrt master（内核 6.18.x，aarch64）** 的
`luci-app-strongswan-swanctl` 重写项目。

本项目不再是原来的 UCI 表单编辑器，而是围绕 `/etc/swanctl` 配置文件工作：

- 一个 UI 核心包；
- 三个互斥的 strongSwan 安装 profile（default / full / minimal）；
- 五个 Web 页面：状态、配置文件、生成配置、编辑器、日志；
- 安装时补齐 `strongswan`、`strongswan-charon`、`strongswan-swanctl`、
  `xfrm`、`luci-proto-xfrm` 等依赖。

## 目标环境

- 固件：ImmortalWrt master snapshot
- 内核：6.18.55
- 架构：aarch64
- 包管理器：apk
- LuCI：ImmortalWrt master

包本身是 `PKGARCH=all`，但构建时仍建议使用与路由器同代的 SDK。

## 源码地址

| 组件 | 地址 | 路径 |
|---|---|---|
| ImmortalWrt 主源码 | https://github.com/immortalwrt/immortalwrt | 分支 `master` |
| ImmortalWrt LuCI | https://github.com/immortalwrt/luci | `applications/luci-app-strongswan-swanctl` |
| ImmortalWrt packages | https://github.com/immortalwrt/packages | `net/strongswan`、`utils/swanmon` |
| OpenWrt LuCI 参考 | https://github.com/openwrt/luci | `applications/luci-app-strongswan-swanctl` |
| OpenWrt packages 参考 | https://github.com/openwrt/packages | `net/strongswan` |
| swanmon 上游 | https://github.com/TDT-AG/swanmon | 状态查询工具 |
| strongSwan 上游 | https://github.com/strongswan/strongswan | 守护进程源码 |
| strongSwan 下载 | https://download.strongswan.org/ | 发布 tarball |

本次导入的固定提交记录在 [SOURCES.md](SOURCES.md)。

## 目录

```
immortalwrt-swanctl/
├── package/luci-app-strongswan-swanctl/   # 实际构建的包
│   ├── Makefile
│   ├── htdocs/...                         # 五个页面 + api.js
│   ├── root/...                           # 菜单、ACL、ucode RPC、profile 检查
│   └── po/...
├── upstream/                              # 只读上游快照（不跟踪）
├── docs/                                  # 中文设计/构建/页面文档
├── scripts/build.sh
└── build/out/                             # 构建产物（不跟踪）
```

## 五个页面

1. **IPsec Status**：服务启停/重启/重载、当前配置、版本、uptime、
   IKE SA、插件列表、连接状态。
2. **Configuration Files**：列出/启用/编辑/删除配置，上传 `.conf`，
   处理其他 `conf.d` 文件。
3. **Generate Configuration**：表单生成 `swanctl.conf` 片段，支持
   IKEv1/IKEv2、PSK/证书、流量选择器、proposal、start_action。
4. **Editor**：直接编辑 profile 文本，保存/保存并启用/从磁盘重读。
5. **Logs**：查看 `charon` 和 `swanctl` 运行日志，支持自动刷新。

原来的“状态 → strongSwan IPsec”菜单已经删除。

## 安装 profile

| 包 | strongSwan 依赖 | 说明 |
|---|---|---|
| `luci-app-strongswan-swanctl` | core：`strongswan`、`strongswan-charon`、`strongswan-swanctl`、`strongswan-mod-vici`、`xfrm`、`luci-proto-xfrm` | UI 核心，装任意 profile 时自动安装 |
| `...-default` | `strongswan-default` + gcm/chapoly/curve25519/pkcs8/pkcs12/sha3 + swanmon | 体积/功能平衡 |
| `...-full` | `strongswan-full` + swanmon | 默认安装，功能最全 |
| `...-minimal` | `strongswan-minimal` + vici/attr/pem/pkcs1/pkcs8/sha2/kdf/gcm | 小闪存，不装 swanmon |

三个 profile 有 `preinst` 互斥保护：已装一个时，装另一个会被拒绝，需要先
`apk del` 当前 profile 再装新的。

> `swanmon` 会依赖 `davici`/`glib2`（约 3.2 MB），所以 minimal 不装它。
> minimal 的状态页会降级为 `swanctl --stats` 文本。

## 构建

下载与路由器同代的 ImmortalWrt SDK（示例为 armsr/armv8，aarch64）：

```sh
wget https://downloads.immortalwrt.org/snapshots/targets/armsr/armv8/immortalwrt-sdk-armsr-armv8_gcc-14.4.0_musl.Linux-x86_64.tar.zst
tar --zstd -xf immortalwrt-sdk-*.tar.zst
cd immortalwrt-sdk-*
```

把包链接进 SDK 并编译：

```sh
ln -s /root/DeepSeek/immortalwrt-swanctl/package/luci-app-strongswan-swanctl \
      package/luci-app-strongswan-swanctl
make defconfig
make package/luci-app-strongswan-swanctl/compile V=s -j$(nproc)
```

核心目标会一次构建四个包。产物在 `bin/packages/<arch>/base/`。

构建辅助脚本：

```sh
SDK_DIR=/path/to/sdk ./scripts/build.sh
```

## 安装（full）

```sh
scp /root/DeepSeek/immortalwrt-swanctl/build/out/luci-app-strongswan-swanctl-full-1.0.0-r1.apk \
    root@<router>:/tmp/

ssh root@<router> '
  cp /etc/config/ipsec /root/ipsec.bak.$(date +%s)
  apk update
  apk del luci-app-strongswan-swanctl-full luci-app-strongswan-swanctl 2>/dev/null || true
  apk add --allow-untrusted /tmp/luci-app-strongswan-swanctl-full-1.0.0-r1.apk
  /etc/init.d/rpcd restart
  /etc/init.d/uhttpd restart
  /usr/sbin/swanctl-profile-check full
'
```

## 回滚

保留旧包和 `/etc/config/ipsec`：

```sh
cp /etc/config/ipsec /root/ipsec.bak
apk del luci-app-strongswan-swanctl-full
apk add --allow-untrusted /root/luci-app-strongswan-swanctl-old.apk
cp /root/ipsec.bak /etc/config/ipsec
/etc/init.d/swanctl restart
```

不要在正在使用的 IPsec 隧道内做重启 charon 的操作，使用 LAN 或带外管理。

## 当前状态

- [x] 导入 ImmortalWrt 源码
- [x] 四包结构 + strongswan/xfrm/luci-proto-xfrm 依赖
- [x] 五个页面和文件管理 RPC
- [x] 中文翻译资源和中文文档
- [x] aarch64 SDK 构建通过（构建期依赖使用 stub）
- [ ] 真机安装与现有隧道回归
- [ ] 更细的配置语法校验/证书管理
