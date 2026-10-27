# 安装 profile 设计

## 为什么拆成多个包

上游原来的依赖是：

```make
LUCI_DEPENDS:=+strongswan-swanctl +swanmon
```

`strongswan-swanctl` 只包含 `swanctl`、VICI、`/etc/init.d/swanctl` 和
`/etc/config/ipsec`，**不包含 charon 守护进程**。因此会出现“LuCI 能打开，
但 strongSwan 服务没运行”的情况。

opkg/apk 没有可靠的“安装时三选一”依赖语法，所以本项目采用：

- `luci-app-strongswan-swanctl`：UI 核心；
- `...-default`：core + `strongswan-default` + 补充；
- `...-full`：core + `strongswan-full`；
- `...-minimal`：core + `strongswan-minimal` + 补充。

三个 profile 互斥，core 自动作为依赖安装。

## 核心依赖

UI 核心现在显式依赖：

```make
+luci-base
+strongswan
+strongswan-charon
+strongswan-swanctl
+strongswan-mod-vici
+xfrm
+luci-proto-xfrm
```

这样无论装哪个 profile，都具备：

- charon 守护进程；
- swanctl/VICI 管理通道；
- XFRM 接口的 netifd 支持；
- LuCI 的 XFRM 协议页面；
- `/etc/config/ipsec` 和 `/etc/init.d/swanctl`。

`xfrm` 会再依赖 `kmod-xfrm-interface`。

## default

`strongswan-default` 已包含 charon、swanctl/VICI、kernel-netlink、
socket-default、x509、pem、pkcs1、attr、updown、sha2 等。额外补：

| 包 | 原因 |
|---|---|
| `swanmon` | 结构化状态输出；会拉 davici/glib2 |
| `strongswan-mod-gcm` | AES-GCM |
| `strongswan-mod-chapoly` | ChaCha20-Poly1305 |
| `strongswan-mod-curve25519` | X25519 |
| `strongswan-mod-pkcs8` | PKCS#8 私钥 |
| `strongswan-mod-pkcs12` | PKCS#12 容器 |
| `strongswan-mod-sha3` | SHA-3 |

## full

`strongswan-full` 是上游完整元包，包含 EAP、PKCS#11、SQL/LDAP 等可选插件。
体积较大，安装前要确认 overlay 空间。extra 只加 `swanmon`。

ImmortalWrt snapshot 的 aarch64 feed 已确认提供 `strongswan-full`
（aarch64_cortex-a53 和 aarch64_generic）。

## minimal

`strongswan-minimal` 包含 charon、kernel-netlink、socket-default、aes、
gmp、hmac、mgf1、pubkey、random、sha1、updown、x509、xcbc，但**不包含**
swanctl、VICI、attr、pem、pkcs1、pkcs8、sha2、kdf、gcm。补：

| 包 | 原因 |
|---|---|
| `strongswan-swanctl` | init 脚本、UCI 配置、swanctl CLI |
| `strongswan-mod-vici` | 管理 socket |
| `strongswan-mod-attr` | 池、虚拟 IP、DNS/split 属性 |
| `strongswan-mod-pem` | PEM 证书/私钥 |
| `strongswan-mod-pkcs1` | PKCS#1 RSA 私钥 |
| `strongswan-mod-pkcs8` | PKCS#8 私钥 |
| `strongswan-mod-sha2` | SHA-2 |
| `strongswan-mod-kdf` | 密钥派生 |
| `strongswan-mod-gcm` | AES-GCM |

minimal 不装 `swanmon`，因为会拉入 `davici`/`glib2`（24.10 上约 3.2 MB）。
minimal 的状态页降级为 `swanctl --stats` 文本。

## 互斥方式

三个 profile 有 `preinst` 保护：安装时如果发现
`/etc/swanctl.profile` 属于另一个 profile，直接退出并提示先卸载当前 profile。

不使用 `CONFLICTS`。原因：

- apk 的包元数据不展示 OpenWrt 的 `CONFLICTS` 字段，实际保护只能靠 `preinst`；
- 单向 `CONFLICTS` 会让 Kconfig 把 `full` 挂到 `default` 下面，menuconfig
  里看起来像“default 的子菜单”，不方便选择；
- 双向 `CONFLICTS` 还会触发 Kconfig recursive dependency。

因此三个 profile 在 menuconfig 里是平级条目，安装时由 `preinst` 拒绝第二个
profile。

## 切换 profile

先卸载当前 profile，再装新的：

```sh
apk del luci-app-strongswan-swanctl-full
apk add --allow-untrusted luci-app-strongswan-swanctl-default_*.apk
```

卸载元包不会自动删除它拉进来的插件；要回收空间，需要确认没有其他依赖后手动
`apk del` 旧插件。`/etc/config/ipsec` 和 `/etc/swanctl` 不要删除。
