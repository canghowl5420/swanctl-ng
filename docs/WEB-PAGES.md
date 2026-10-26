# Web 页面设计

> 需求里写的是“4 页”，但实际列出了 5 个页面（状态、配置文件、生成配置、编辑器、日志）。这里按 **5 页** 实现。

## 导航

```
VPN
└── strongSwan IPsec
    ├── IPsec Status          （第 1 页）
    ├── Configuration Files   （第 2 页）
    ├── Generate Configuration（第 3 页）
    ├── Editor                （第 4 页）
    └── Logs                  （第 5 页）
```

原来的“状态 → strongSwan IPsec”菜单项已删除。

## 文件模型

| 路径 | 用途 |
|---|---|
| `/etc/swanctl/profiles/*.conf` | 配置库，所有上传/生成/编辑的配置都放这里 |
| `/etc/swanctl/profiles/*.conf.bak` | 保存前自动备份 |
| `/etc/swanctl/conf.d/active.conf` | 当前启用的配置，由选中 profile 复制而来 |
| `/etc/swanctl/active_profile` | 记录当前 profile 名称 |
| `/etc/swanctl/conf.d.disabled/` | 点击“禁用其他 conf.d 文件”后移动到这里 |

strongSwan 默认的 `/etc/swanctl/swanctl.conf` 从 5.6.0 起包含
`include conf.d/*.conf`。安装包的 postinst 会再检查一次，缺少时补上。

## 第 1 页：IPsec Status

- 服务状态：running / stopped。
- 启动、停止、重启、重载配置。
- 当前生效的 profile。
- strongSwan 版本、uptime、IKE SA 数、半开 IKE SA 数。
- 已安装插件数量和插件名。
- 连接列表：连接名、状态、本端/对端地址、Child 名称。
- 如果 `conf.d` 里还有其他 `.conf`，显示警告并提供“禁用其他 conf.d 文件”按钮。
- 没有 `swanmon` 时降级显示 `swanctl --stats` 文本。

## 第 2 页：Configuration Files

- 列出 `/etc/swanctl/profiles` 下的配置。
- 显示大小、修改时间、是否 active。
- 操作：启用、编辑、删除（active 配置不允许删除）。
- 上传 `.conf`：
  - 浏览器读取文件文本，通过 RPC 写入设备，不经过 cgi-io。
  - 可指定 profile 名；不填则使用文件名。
  - 可选“上传后立即启用”。
  - 同名文件需要确认覆盖。
- 外部 conf.d 文件警告与隔离。

## 第 3 页：Generate Configuration

生成一个标准的 `swanctl.conf` 片段：

- profile 名、连接名、Child 名。
- IKEv1 / IKEv2。
- PSK 或证书认证。
- 本端/对端地址、Local ID、Remote ID。
- Local/Remote traffic selectors。
- IKE/ESP proposals。
- `start_action`（trap/start/none）。
- 实时预览生成的文本。
- 保存到配置库；可“保存并启用”。
- 生成的 PSK 配置写在 profile 文件里，文件权限 0600。

## 第 4 页：Editor

- 选择 profile，读取到 textarea。
- 直接编辑原始 `swanctl.conf` 文本。
- 保存、保存并启用、从磁盘重新读取。
- 切换 profile 时提示未保存修改。
- 保存前自动写 `.bak`。

## 第 5 页：Logs

- 读取 `logread -e charon` 和 `logread -e swanctl`。
- 可选 100/200/500/1000 行。
- 5 秒自动刷新开关。
- 手动刷新。
- 只读，不提供“清空日志”。

## 后端 RPC

`/usr/share/rpcd/ucode/luci.swanctl` 提供：

| 方法 | 用途 |
|---|---|
| `status` | 服务、版本、统计、连接、插件、当前 profile |
| `profiles` | 配置列表 |
| `read` | 读取一个 profile |
| `write` | 原子写入 profile，可选启用 |
| `delete` | 删除非 active profile |
| `activate` | 复制到 active.conf 并 reload |
| `service` | start/stop/restart/reload/status |
| `logs` | 读取 charon/swanctl 日志 |
| `isolate` | 把其他 conf.d 文件移到 disabled 目录 |

所有 profile 名都限制为 `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`，防止路径穿越；写入采用临时文件 + rename，权限 0600。
