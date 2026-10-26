# luci-app-strongswan-swanctl 重写与路由器部署方案

> 版本：v1.1（2026-10-26，补充 three-profile 依赖方案）  
> **实施状态（v1.2）：实际采用“UI core + 三个 profile 元包”，用 preinst 互斥，不使用双向 CONFLICTS。当前代码与构建结果以 README、docs/PROFILE-DESIGN.md、docs/BUILD-REPORT.md 为准；本文件保留为设计与风险背景。**  
> 目标：重写 LuCI 管理界面，打成可安装包，安全替换路由器上的现有版本，并保留回滚能力。  
> 原则：**不改 strongSwan/charon 本体，不重写 swanctl 配置生成器，UCI 仍是唯一配置源。**

## 1. 目标与边界

### 1.1 要做的事

- 重写 LuCI 前端：状态总览、连接管理、证书/密钥、全局设置、诊断。
- 保留现有 `/etc/config/ipsec` 数据模型，让 `/etc/init.d/swanctl` 继续把 UCI 生成到 `/var/swanctl/swanctl.conf`。
- 做一个与路由器固件版本匹配的安装包（`.ipk` 或 `.apk`），并且**安装包自己带齐可用的 strongSwan 组件**，不能只装一个 LuCI 壳。
- 提供 default/full/minimal 三个互斥 profile，安装时三选一；缺的插件由 profile 依赖补齐。
- 安装前备份，安装后做冒烟测试；失败可在 5 分钟内回滚。
- 现有连接、证书、PSK 不丢失；升级过程不无故中断已建立的隧道。

### 1.2 明确不做的事

- 不重写 IKE/IPsec 协议栈，不碰 charon、kernel-netlink、VICI。
- 不把 24.10 的旧 UCI schema 强行迁移到 25.12 的新 schema。
- 不直接替换 `/etc/init.d/swanctl`。这个脚本有 784/1649 行，和 strongSwan 版本强绑定，替换它风险远大于收益。
- 不把私钥、PSK 上传到工作站或代码仓库；备份留在路由器上并加密保存。
- v1 不做证书签发/CSR、HA、SQL、TPM、Android 客户端配置二维码。这些放到后续版本。

## 2. 现状与关键结论

### 2.1 上游项目仍在维护

- 包名：`luci-app-strongswan-swanctl`
- 代码：LuCI JS 前端 + ucode RPC 后端，依赖 `strongswan-swanctl`、`swanmon`。
- 25.12 分支和 master 已经是新 UCI schema；24.10 分支仍是旧 schema。
- 25.12.2 曾有一个“新建 Tunnel/Remote 弹窗崩溃”的已知问题（openwrt/luci #8606），master 在 2026-05 已修复，但发行版里的包可能还没带上。

### 2.2 24.10 与 25.12 不能共用一个包

| 项目 | OpenWrt 24.10 | OpenWrt 25.12 / master |
|---|---|---|
| strongSwan | 5.9.14 | 6.0.7 |
| UCI 模型 | `ipsec` / `remote` / `tunnel` | `globals` / `connection` / `child` / `local` / `remote` / `pools` / `crypto_proposal` |
| swanctl init | 约 784 行，旧模型 | 约 1649 行，新模型 |
| 上游 LuCI app | 旧版三页 | 新版多页 |

**结论：第一步必须确认路由器到底跑哪一支。** 在 24.10 上装 master 包，页面可能能开，但保存的 section 类型 init 脚本不认；反过来也一样。不能靠“兼容层”硬吃两套 schema，收益低、bug 多。

### 2.3 为什么值得重写

当前上游 app 本质上是“UCI section 数据库编辑器”：

- 新建一条连接，要先去 Proposal 页、Local/Remote 页、Child 页分别建 section，再回连接页引用；对普通用户不友好。
- 状态页依赖 `swanmon`，查询失败时整页只剩错误，没有降级视图。
- 列表页和详情页信息密度低，缺少流量、最近握手、日志入口。
- 文件选择/校验逻辑分散在多个视图里，重复代码多。
- 没有“连接向导”和“配置预览”，排错要靠 SSH 看 `/var/swanctl/swanctl.conf`。

重写后的核心变化：**以“连接”为中心组织 UI，底层仍然落成标准 UCI section**，既好用又不破坏现有生态。

### 2.4 依赖现状：为什么“装完 LuCI 却没有 strongSwan”

上游当前依赖只有：

```make
LUCI_DEPENDS:=+strongswan-swanctl +swanmon
```

`strongswan-swanctl` 只提供 `swanctl` 命令、VICI 插件、`/etc/init.d/swanctl` 和 `/etc/config/ipsec`，**不包含 charon 守护进程**。所以会出现“LuCI 菜单能打开，但服务起不来/没有 strongSwan”的情况。

`strongswan-default` 和 `strongswan-minimal` 都带 `strongswan-charon`；`strongswan-full` 是更大的元包。`strongswan-minimal` 还缺 `swanctl`、`vici`、`attr`、`pem` 等，需要补。

另一个限制：**opkg/apk 不支持“安装时交互三选一”**。`Depends: a | b` 在 OpenWrt 构建和 apk 里都不可靠，虚拟包也不能保证自动选中。可行做法是“一个 UI，三个互斥的安装包”：

| 安装包 | 底层 strongSwan | 适用 |
|---|---|---|
| `luci-app-strongswan-swanctl` | `strongswan-default` + 常用补充 | 默认推荐，体积/功能平衡 |
| `luci-app-strongswan-swanctl-full` | `strongswan-full` | 需要 EAP/更多插件/最大兼容 |
| `luci-app-strongswan-swanctl-minimal` | `strongswan-minimal` + 必需补充 | 小闪存、IKEv2 基本功能 |

三个包安装同一套 UI 文件，用 `CONFLICTS` 互斥；用户安装时选一个即可。这样既满足“三选一”，又不会出现“UI 装了、守护进程没装”。

> 24.10 的官方 feed 没有构建 `strongswan-full`（Makefile 里带 `@DEVEL`），25.12 才有。24.10 要用 full，需要我们在本地 SDK 里补构建这个元包，或者改用“default + 精选 full 插件”的兼容 full。这个会在构建阶段验证，不能假设官方源一定有。

## 3. 推荐架构

```
浏览器 (LuCI JS)
   │  UCI 读写 / 薄 RPC
   ▼
rpcd + ucode (luci.swanctl)
   │
   ├── /etc/config/ipsec          ← 唯一配置源
   ├── /etc/init.d/swanctl        ← 原样保留，负责生成配置
   ├── /var/swanctl/swanctl.conf  ← 只读预览
   ├── swanctl / swanmon          ← 状态、启停、日志
   └── /etc/swanctl/*             ← 证书/私钥，受限上传
```

### 3.1 前端

- 使用 LuCI 现有 JS 框架（`form`、`uci`、`rpc`、`poll`、`ui`），不引入 React/Vue，不增加前端构建链。
- 页面按任务组织，而不是按 UCI section 类型组织：
  1. **总览**：服务状态、版本、uptime、IKE/Child SA 数、流量、最近日志。
  2. **连接**：列表 + 状态 + 启用/停用 + 启动/停止 + 详情；新建走向导。
  3. **身份与密钥**：CA/证书/私钥上传、有效期/指纹列表、PSK/EAP 密钥。
  4. **高级对象**：Proposal、Pool、Shunt、多认证轮次、多 Child。
  5. **设置**：监听接口、路由、syslog、netlink。
  6. **诊断**：配置预览、`swanctl --list-*` 输出、日志、服务重启。
- 默认“简单模式”只暴露常用字段；高级字段收在“高级”标签页，避免吓人。
- 中文翻译放 `po/zh_Hans`，同时保留英文源字符串。

### 3.2 后端

只保留一个**薄 RPC**，不把配置生成逻辑搬到 ucode：

- `status`：优先聚合 `swanmon version/stats/list-conns/list-sas`；没有 swanmon 时降级为 `swanctl --stats` 文本 + UCI 连接列表，不整页崩。
- `verify`：Apply 后检查 charon 是否在跑、配置是否能被 `swanctl --list-conns` 读取。
- `logs`：读取 `logread -e charon` 的最近 N 行（可选）。
- 连接/证书/设置的写入仍走 LuCI 原生 UCI 和 `form.FileUpload`，不自己造一套提交协议。

**为什么不把生成器搬进 ucode：** 生成器已经存在且经过版本适配；复制一份必然和上游漂移。UI 只负责产生合法 UCI，生成器继续做它的事。

### 3.3 应用配置的流程

1. 前端做字段级校验（名称、IP/CIDR、时间后缀、引用关系、文件是否存在）。
2. 用户点“保存并应用”，LuCI 走标准 `uci commit` + reload。
3. `verify` 检查服务与配置；失败则显示具体错误和“恢复上一份配置”按钮。
4. 全局设置（syslog/netlink 等）变更时提示需要重启 charon；连接级变更优先 reload，不重启。

v1 不做“自动事务回滚”，因为 LuCI 的 UCI 提交流程和 rpcd 权限模型会让它变得复杂且容易误伤并发的配置修改。v1 用**备份 + 手动一键恢复 + 安装 watchdog** 保证可回滚；自动回滚放到 v2。

### 3.4 安装包与依赖矩阵

采用“一套 UI，三个互斥 profile”的方式。三个包都包含相同的 htdocs/root/po 文件，通过 `CONFLICTS` 保证同时只能装一个；切换 profile 时先卸载再安装，UCI 和证书不受影响。

| 包 | 运行时依赖 | 说明 |
|---|---|---|
| `luci-app-strongswan-swanctl`（default） | `+strongswan-default +swanmon +strongswan-mod-gcm +strongswan-mod-chapoly +strongswan-mod-curve25519 +strongswan-mod-pkcs8 +strongswan-mod-pkcs12 +strongswan-mod-sha3` | 默认推荐。`strongswan-default` 已带 charon、swanctl、attr、pem、x509、updown 等；补充现代 IKEv2 加密和密钥格式。 |
| `luci-app-strongswan-swanctl-full` | `+strongswan-full +swanmon` | `strongswan-full` 已包含 charon、swanctl 和大部分插件。 |
| `luci-app-strongswan-swanctl-minimal` | `+strongswan-minimal +strongswan-swanctl +strongswan-mod-vici +strongswan-mod-attr +strongswan-mod-pem +strongswan-mod-pkcs1 +strongswan-mod-pkcs8 +strongswan-mod-sha2 +strongswan-mod-kdf +strongswan-mod-gcm` | 小闪存基本盘。补上 swanctl/vici（否则没有管理通道）、attr（虚拟 IP/池）、pem/pkcs（证书/私钥）、sha2/kdf/gcm（现代 IKEv2）。**不依赖 swanmon**，避免拉入 glib2。 |

> `swanmon` 通过 `davici` 依赖 `glib2`，24.10 上安装后约 3.2 MB；对 8 MB flash 不友好。因此 minimal 不依赖 `swanmon`，状态页降级为 `swanctl --stats`/`--list-*` 文本 + UCI 连接列表；default/full 保留结构化的 `swanmon` 视图。如果 minimal 用户后续自己装 `swanmon`，UI 自动切到富状态。

补充规则：

- `strongswan-swanctl` 本身依赖 `strongswan-mod-vici`；minimal 里仍显式写出，避免依赖链被上游改动时静默失效。
- `strongswan-minimal` 不含 `xauth-generic`；如果必须支持 IKEv1 XAuth，在 minimal 上再加这个包，UI 会做能力检测并提示。
- `strongswan-default` 不含 `pkcs8/pkcs12`，但 UI 如果允许上传这些格式，就必须补；默认包已补。
- `strongswan-full` 在 25.12 官方源可用；24.10 官方源没有构建（`@DEVEL`）。24.10 的 full 方案在 SDK 中补构建元包，随应用一起提供；如果依赖解析失败，就退化为“default + 精选扩展插件”，并在 README 明确标注不是官方 full。
- 三个包都用 `PKGARCH:=all`（纯 JS/ucode 无编译产物），但必须用目标 SDK 构建，依赖版本才会和固件源对齐。
- 切换 profile 只替换 UI 和元包，**不会自动卸载旧 profile 拉进来的插件**；要真正回收空间，需在确认没有其他依赖后手动 `opkg remove` 旧插件。

安装时三选一：

```sh
# 默认
opkg install luci-app-strongswan-swanctl_*.ipk
# 或 full
opkg install luci-app-strongswan-swanctl-full_*.ipk
# 或 minimal
opkg install luci-app-strongswan-swanctl-minimal_*.ipk
```

25.12 把 `opkg` 换成 `apk add --allow-untrusted`，包后缀换成 `.apk`。

## 4. 功能范围

### P0（首个可安装版本必须有）

- 总览：服务状态、版本、uptime、IKE/Child SA 数、连接列表。
- 连接 CRUD：启用/停用、启动/停止、详情、删除。
- 连接向导：站点到站点、Road Warrior 服务端、客户端三种模板。
- 证书/私钥上传与列表；PSK/EAP 密钥管理。
- Proposal/Pool 的最小管理（至少能选、能建）。
- 配置预览：只读展示 `/var/swanctl/swanctl.conf`。
- 服务 start/stop/restart、日志查看。
- 中文界面、移动端可用。
- 三个互斥安装包（default/full/minimal）、依赖自检、校验和、回滚脚本、README。
- 安装后 `charon`、`swanctl` 可执行；default/full 的 `swanmon` 可执行，minimal 有降级状态页。缺插件时 UI 能明确提示缺哪个包。

### P1（第一轮迭代）

- 多 Local/Remote 认证轮次、多 Child。
- 导入/导出 UCI 片段。
- 旧配置检测与显式迁移提示（只提示，不自动改）。
- 证书有效期/指纹/用途展示。
- 连接流量趋势（不用额外数据库，前端保留最近 N 个采样点）。

### P2（后续）

- CSR/自签证书、PKCS#12 导入。
- 二维码导出、多用户权限、HA。
- 自动事务回滚。

## 5. 实施步骤

### 步骤 0：摸清路由器（约 30 分钟）

在能 SSH 到路由器的机器上执行，保存输出：

```sh
ssh root@<router> '
  . /etc/openwrt_release
  echo "=== release ==="
  echo "$DISTRIB_ID $DISTRIB_RELEASE $DISTRIB_TARGET $DISTRIB_ARCH"
  uname -m
  echo "=== package manager ==="
  command -v opkg; command -v apk
  echo "=== installed ==="
  (opkg list-installed 2>/dev/null || apk info -v 2>/dev/null) |
    grep -E "strongswan|swanmon|luci|rpcd|ucode" | sort
  echo "=== available profiles ==="
  (opkg list 2>/dev/null || apk search -x strongswan 2>/dev/null) |
    grep -E "^strongswan-(full|default|minimal)([[:space:]-]|$)" || true
  echo "=== space ==="
  df -h /overlay /tmp 2>/dev/null
  echo "=== ipsec uci ==="
  uci show ipsec
  echo "=== swanctl ==="
  /usr/sbin/swanctl --version 2>/dev/null
  /usr/sbin/swanmon version 2>/dev/null
  echo "=== service ==="
  /etc/init.d/swanctl status 2>&1
  echo "=== certs ==="
  find /etc/swanctl -maxdepth 2 -type f -printf "%p %s\n" 2>/dev/null
'
```

**退出条件：**

- 明确 OpenWrt 版本、target/subtarget、包管理器（opkg/apk）。
- 明确当前是旧 schema 还是新 schema。
- 确认 overlay 剩余空间 ≥ 10 MB。
- 确认 SSH 是 LAN 可达，不依赖待修改的 IPsec 隧道。
- 记录当前包版本和所有已装相关包。

**备份（只留在路由器，不拉私钥）：**

```sh
ssh root@<router> '
  umask 077
  ts=$(date +%Y%m%d-%H%M%S)
  cp /etc/config/ipsec /etc/config/ipsec.bak.$ts
  cp /etc/config/firewall /etc/config/firewall.bak.$ts
  tar -czf /root/swanctl-etc-$ts.tgz /etc/swanctl
  sysupgrade -b /root/sysupgrade-backup-$ts.tar.gz
  ls -lh /root/*$ts*
'
```

工作机上只保存 UCI 文本和包清单；私钥备份留在路由器 `/root`（权限 600）。

### 步骤 1：先构建并安装“未修改的上游包”（约 1 小时）

目的：验证 SDK、target、依赖和安装链路，避免“重写完了才发现工具链不对”。

1. 从 `downloads.openwrt.org` 下载与路由器 **同版本、同 target/subtarget** 的 SDK。
2. 在 SDK 中构建当前分支的 `luci-app-strongswan-swanctl`。
3. 先按当前依赖装一次，确认“只有 swanctl、没有 charon”的原始问题；然后手动补 `strongswan-default` 和 `swanmon`，确认页面和现有连接可用。这一步同时验证目标固件源里三个 profile 的元包是否齐全。
4. 保留这个包作为“基线包”和回滚包。

如果基线包已经解决了当前问题，先停下来评估是否还需要完整重写；如果仍不满足，再进入步骤 2。这个“先基线、后重写”的顺序能显著降低风险。

### 步骤 2：搭工程骨架与三 profile 打包（1–1.5 天）

目录建议：

```
luci-app-strongswan-swanctl/
├── Makefile
├── README.md
├── htdocs/luci-static/resources/
│   ├── view/strongswan-swanctl/
│   │   ├── overview.js
│   │   ├── connections.js
│   │   ├── credentials.js
│   │   ├── advanced.js
│   │   ├── settings.js
│   │   └── diagnostics.js
│   └── strongswan-swanctl/
│       ├── api.js
│       ├── model.js
│       └── validators.js
├── root/usr/share/luci/menu.d/
├── root/usr/share/rpcd/acl.d/
├── root/usr/share/rpcd/ucode/luci.swanctl
└── po/zh_Hans/
```

Makefile 要点：

- 在**同一个 Makefile** 里定义三个包：`luci-app-strongswan-swanctl`（default）、`...-full`、`...-minimal`。
- 三个包都安装同一套 `htdocs/`、`root/`、`po/` 文件；用公共 install 宏，避免三份代码。
- 三个包用 `CONFLICTS` 互相排斥；不要用虚拟包/OR 依赖，opkg/apk 行为不一致。
- `LUCI_DEPENDS` 按 3.4 的矩阵写，不要只写 `+strongswan-swanctl`；`strongswan-swanctl` 不包含 charon。
- 纯 JS/ucode 无编译产物时设 `LUCI_PKGARCH:=all`，但仍建议用目标 SDK 构建，确保依赖解析正确。
- 版本号要高于路由器上现有包；安装前先卸载旧包。25.12 是 apk，24.10 是 opkg，构建产物不同。
- 24.10 如果选 full，先单独构建 `strongswan-full` 元包并做依赖闭合检查；不要假设官方源里有。

### 步骤 3：实现后端与数据适配（1–1.5 天）

- 写 `luci.swanctl status`：返回 `{service, version, stats, connections, errors}`。
- 连接数据做一层归一化：UCI section + `swanmon list-conns/list-sas` 合并，前端不直接处理原始 JSON。
- 所有名称做白名单校验：`^[A-Za-z0-9_.-]{1,32}$`；禁止 shell 元字符。
- 文件路径只允许 `/etc/swanctl/{x509,x509ca,private,rsa,ecdsa,pkcs8,pkcs12}` 下的文件名，拒绝 `..`、绝对路径、软链接逃逸。
- RPC 方法全部显式列在 ACL 中，不开放通用 `exec`。
- 增加能力自检（RPC `deps` 或安装脚本）：检查 `charon`、`swanctl`、VICI、kernel-netlink、socket-default、x509/pem 是否存在；`swanmon` 只作为可选增强。缺什么在 UI 明确列出对应包名。
- 状态查询失败时返回降级数据，不让前端整页报错。

### 步骤 4：实现前端（2–3 天）

按页面推进，每完成一页就在测试环境验收：

1. **总览**：先做只读，确认数据正确。
2. **连接列表**：先做现有 section 的展示和启停，再做新增/编辑。
3. **连接向导**：三种模板，内部创建标准 UCI section；允许“只创建、不立即启动”。
4. **证书/密钥**：先做上传和列表，再做有效期/指纹。
5. **高级对象**：Proposal/Pool/Shunt，沿用现有表单能力。
6. **设置/诊断**：配置预览、日志、服务操作。

UI 细节：

- 保存按钮明确区分“保存”和“保存并应用”。
- 危险操作（停止服务、删除连接、重启 charon）二次确认。
- 连接状态用颜色 + 文本，不只靠颜色。
- 列表默认按名称排序，支持搜索。
- 移动端 390px 宽度下不横向溢出。
- 所有密钥字段 `password`，列表和详情不回显明文。

### 步骤 5：测试（1–2 天）

**静态检查：**

- `node --check` 检查所有 JS 语法。
- 如 SDK 带 `ucode`，用 `ucode -c` 检查 RPC 脚本。
- `shellcheck` 检查新增的安装/回滚脚本（不改 init 脚本）。

**包构建：**

- 在目标 SDK 中从零构建三个包，确认无网络依赖、无缺失依赖。
- 记录每个包的大小、SHA256、构建命令和 SDK 版本；full 要单独记录依赖体积。
- 在测试 rootfs 里分别真装 default/full/minimal 各一次，确认 `/usr/lib/ipsec/charon`、`/usr/sbin/swanctl` 存在且可执行；default/full 还要有 `/usr/sbin/swanmon`，minimal 允许没有并验证降级视图。
- 验证 `CONFLICTS`：已装 default 时装 full 应被拒绝；卸载 default 后可装 full，配置不丢。
- 24.10 的 full 要额外验证 `strongswan-full` 元包是否成功构建、依赖是否全部可解析；不能只看 Makefile 写没写。

**OpenWrt 冒烟环境：**

- 优先用 x86_64 OpenWrt QEMU/测试根文件系统跑 uhttpd + rpcd + strongswan，验证页面、RPC、UCI 读写、服务 reload。
- 没有 QEMU 时，至少用目标路由器做“非破坏性”验证：只读页面、预览、状态查询；写入测试放到维护窗口。

**真机验收：**

- 安装后现有连接全部还在，服务 running。
- 新建一条测试连接（PSK 或证书），能保存、能 initiate、`swanctl --list-sas` 能看到 ESTABLISHED。
- 修改一个字段并 apply，配置预览同步变化。
- 输入非法值（错误 CIDR、超长名称、路径穿越）被拒绝。
- 重启路由器后配置和连接仍在。
- 卸载新包、装回旧包后，配置未被破坏。

### 步骤 6：部署（维护窗口 1–2 小时）

1. 选择流量低谷，确认 LAN SSH 可用。
2. 再备份一次，记录当前包版本。
3. 上传新包到 `/tmp`，校验 SHA256。
4. 卸载/替换旧包，安装新包，重启 rpcd/uhttpd。
5. 打开 LuCI，按验收清单逐项检查。
6. 观察 24 小时：charon 日志、隧道状态、内存/存储。

安装命令模板（opkg）。**三个 profile 只能装一个**：

```sh
# 1) 卸载旧 LuCI 包，保留 strongswan 配置和证书
ssh root@<router> 'opkg remove luci-app-strongswan-swanctl --force-depends'

# 2) 上传你选中的那个包
scp luci-app-strongswan-swanctl_*.ipk root@<router>:/tmp/

# 3) 三选一，不要同时装
ssh root@<router> '
  sha256sum /tmp/luci-app-strongswan-swanctl_*.ipk
  # default（推荐）
  opkg install /tmp/luci-app-strongswan-swanctl_*.ipk
  # 或 full
  # opkg install /tmp/luci-app-strongswan-swanctl-full_*.ipk
  # 或 minimal
  # opkg install /tmp/luci-app-strongswan-swanctl-minimal_*.ipk

  /etc/init.d/rpcd restart
  /etc/init.d/uhttpd restart
'
```

apk：

```sh
ssh root@<router> 'apk del luci-app-strongswan-swanctl 2>/dev/null || true'
scp luci-app-strongswan-swanctl_*.apk root@<router>:/tmp/
ssh root@<router> '
  sha256sum /tmp/luci-app-strongswan-swanctl_*.apk
  # 三选一
  apk add --allow-untrusted /tmp/luci-app-strongswan-swanctl_*.apk
  # apk add --allow-untrusted /tmp/luci-app-strongswan-swanctl-full_*.apk
  # apk add --allow-untrusted /tmp/luci-app-strongswan-swanctl-minimal_*.apk

  /etc/init.d/rpcd restart
  /etc/init.d/uhttpd restart
'
```

安装后先确认依赖真的落地：

```sh
ssh root@<router> '
  ls -l /usr/lib/ipsec/charon /usr/sbin/swanctl
  # default/full 应存在；minimal 允许没有
  ls -l /usr/sbin/swanmon 2>/dev/null || echo "swanmon not installed (minimal fallback)"
  (opkg list-installed 2>/dev/null || apk info -v 2>/dev/null) |
    grep -E "strongswan-(charon|swanctl|default|minimal|full)|swanmon"
'
```

冒烟命令：

```sh
ssh root@<router> '
  /etc/init.d/swanctl status
  /usr/sbin/swanctl --list-conns
  /usr/sbin/swanctl --list-sas
  logread -e charon | tail -50
'
```

### 步骤 7：观察与收尾（0.5 天）

- 补 README：安装、升级、回滚、已知限制、构建方法。
- 保存构建产物、SHA256、SDK 版本、路由器版本。
- 记录“固件升级后需重新构建/安装”，避免被官方源包覆盖。
- 把本次改动整理成可复用分支；如果目标路由器是 24.10，单独维护旧 schema 分支。

## 6. 风险与回滚

| 风险 | 影响 | 对策 |
|---|---|---|
| 装错 schema（24.10 vs 25.12） | 页面能开但保存无效，或服务起不来 | 步骤 0 锁定版本；按分支构建；安装前检查 init 行数/section 类型 |
| 只装 UI、没装 charon | 菜单能开，服务起不来 | 三个 profile 都依赖完整 strongSwan；安装后强制检查 charon/swanctl（swanmon 仅 default/full） |
| minimal 缺插件 | 证书、池、GCM 等功能不可用 | 依赖矩阵补齐；UI 做能力自检并提示缺哪个包 |
| full 在 24.10 官方源不可用 | 依赖解析失败 | SDK 中补构建 full 元包；失败则用 curated full，并在 README 标注 |
| 三个 profile 被同时安装 | 文件冲突/菜单重复 | 三个包互相 `CONFLICTS`；测试“已装 default 再装 full”必须失败 |
| full 体积超出 overlay | 安装中断/空间耗尽 | 安装前估算并 `df`；空间不足改用 default/minimal |
| 配置写坏导致 VPN 中断 | 远程管理失联 | 只从 LAN 操作；备份；10 分钟 watchdog 自动恢复；保留旧包 |
| 私钥/PSK 泄露 | 严重安全事件 | 不拉私钥；备份 600；页面不回显；ACL 最小化；日志脱敏 |
| 包管理器不匹配 | 安装失败 | 先检测 opkg/apk；用对应 SDK 构建 |
| overlay 空间不足 | 安装失败/系统异常 | 安装前 `df` 检查，至少留 10 MB |
| 浏览器缓存旧 JS | 页面行为异常 | 资源带版本；安装后硬刷新；必要时清 LuCI 缓存 |
| 上游包升级覆盖 | 自定义功能丢失 | 记录版本；固件升级后重装；不盲目 `opkg upgrade` |
| swanmon 缺失/版本不兼容 | 状态页信息变少 | minimal 本来就不依赖；default/full 依赖 + 降级视图；保留 `swanctl` 文本输出兜底 |

**Watchdog 示例（安装/应用后 10 分钟内未确认则恢复配置）：**

```sh
ssh root@<router> '
  cp /etc/config/ipsec /etc/config/ipsec.rollback
  nohup sh -c "
    sleep 600
    [ -e /tmp/keep-new-config ] || {
      cp /etc/config/ipsec.rollback /etc/config/ipsec
      /etc/init.d/swanctl restart
    }
  " >/tmp/rollback.log 2>&1 &
  echo $! >/tmp/rollback.pid
'
```

确认新配置正常后：

```sh
ssh root@<router> 'touch /tmp/keep-new-config; cat /tmp/rollback.pid | xargs -r kill'
```

> 如果 SSH 本身走 IPsec 隧道，不要在隧道内做“重启 charon”的操作；必须用 LAN 或带外管理。

## 7. 验收标准

- [ ] 现有连接、证书、PSK 全部保留，服务正常启动。
- [ ] 三个 profile 的依赖都闭合；安装后 `charon`、`swanctl` 可执行，default/full 的 `swanmon` 可执行。
- [ ] 三个 profile 互斥；已装 default 时安装 full 被拒绝，卸载后可切换且配置不丢。
- [ ] default 和 minimal 至少各完成一次“新建 IKEv2 连接并 initiate”的冒烟；full 至少能启动服务并加载全部已装插件。
- [ ] minimal 缺 `xauth-generic` 时，IKEv1 XAuth 在 UI 上被明确提示不可用，而不是静默失败。
- [ ] 总览页能显示版本、uptime、SA 数、连接状态；swanmon 失败时有降级提示。
- [ ] 连接可新建、编辑、启用/停用、启动/停止、删除。
- [ ] 向导创建的连接能被 `/etc/init.d/swanctl` 正确生成，`swanctl --list-conns` 可见。
- [ ] 非法名称、CIDR、时间、文件路径被前端/后端拒绝。
- [ ] Apply 后配置预览与 `/var/swanctl/swanctl.conf` 一致。
- [ ] 重启路由器后配置持久，隧道能重新建立。
- [ ] 页面源码、API 响应、日志中不出现明文私钥/PSK。
- [ ] 390px 移动端可用，无横向滚动。
- [ ] 回滚演练成功：恢复配置 + 装回旧包 ≤ 5 分钟。

## 8. 工期与交付物

| 阶段 | 内容 | 预估 |
|---|---|---|
| 0 | 路由器摸底、备份 | 0.5 天 |
| 1 | 基线包构建/安装 | 1 小时 |
| 2 | 工程骨架 + 三 profile 打包 + 后端 | 1.5–2 天 |
| 3 | 前端页面 | 2–3 天 |
| 4 | 测试、打包（含三种依赖组合） | 1.5–2 天 |
| 5 | 真机部署、观察 | 0.5 天 + 24h 观察 |

**交付物：**

- 源码仓库/目录（含 Makefile、README、回滚脚本）。
- 与路由器匹配的三个 profile 安装包（default/full/minimal）+ 各自 SHA256；实际部署只装一个。
- 构建日志、测试记录、验收清单。
- 旧包和配置备份位置清单。

## 9. 开工前需要你确认

1. **路由器入口**：`ssh root@<IP>` 是否可用？端口、用户名、是否已装公钥？我这边没有你的路由器连接信息，真机步骤需要你提供入口或代执行。
2. **固件版本**：OpenWrt 24.10 还是 25.12？型号/target 是什么？直接粘贴步骤 0 的输出最好。
3. **使用场景**：Road Warrior 服务端、站点到站点、还是客户端？认证用证书、PSK 还是 EAP？是否必须保留 IKEv1？
4. **默认装哪个 profile**：default、full 还是 minimal？如果选 full，24.10 需要额外构建官方未提供的 full 元包，是否接受？路由器 overlay 还剩多少空间？
5. **现网约束**：能否接受维护窗口内短暂断连？SSH 是否依赖 IPsec？现有连接必须零中断，还是可以短暂重连？
6. **重写优先级**：最想解决的是“界面难用”、“25.12 弹窗崩溃”、“功能缺失”、还是“依赖装不全”？这会决定 P0 范围。

## 10. 建议的下一步

先只做步骤 0 + 步骤 1，不写业务代码：

1. 拿到路由器版本/schema/包清单/overlay 空间。
2. 构建并安装**未修改的上游基线包**，确认“只有 swanctl、没有 charon”的原始问题，以及工具链是否正常。
3. 在 SDK 里把 default/full/minimal 三条依赖链各解析一遍，先确认 24.10 的 full 是否可构建；不可构建就当场改方案，不等到部署时才发现。
4. 根据基线结果冻结 P0 和默认 profile，再开始重写。

这样最坏情况也只是装了一个官方同源代码的包，随时可以退回；不会在版本不明的情况下直接大改。
