# 酒馆角色馆

给 SillyTavern 用户用的本地角色卡整理工具。

它不替代酒馆本体，只负责把角色卡先摆出来、看清楚，再决定要不要导入酒馆。适合卡很多、经常下载新卡，或者想在导入前先检查设定、开场白、世界书、正则的人。

## 界面预览

PC 端：

![PC 端封面墙](docs/images/preview-pc.jpg)

手机端：

![手机端封面墙](docs/images/preview-mobile.jpg)

## 现在能做什么

- 自动扫描本机常见目录，寻找 SillyTavern。
- 读取酒馆 `characters` 目录里的 PNG / WEBP / JSON 角色卡。
- 从 PNG 角色卡的 `chara`、`ccv3`、`data` 文本块里解析角色数据。
- 用封面墙展示角色卡，保留卡图本身的视觉。
- 导入本地角色卡后，先进入“待导入”的封面墙，不直接写进酒馆。
- 角色详情页按模块拆开：角色摘要、身份设定、行为与对话、提示词、开场白、世界书、正则、版本历史。
- 开场白按条目切换，不把所有内容堆在一块。
- 世界书按条目折叠查看，关键词和正文分开。
- 正则规则去重后展示，按规则折叠查看。
- 支持把喜欢的待导入角色卡写入已连接酒馆的 `characters` 目录。
- 支持另存、删除、收藏和搜索。
- PC 和手机浏览器都能用，Termux 上也可以本地跑。

聊天记录相关功能目前故意禁用。详情页保留了一个划掉的“聊天”入口，但点不了。这个功能以后稳定了再打开。

## 项目结构

```text
.
├─ server/              # Express API，负责扫描酒馆、解析角色卡、导入文件
├─ src/                 # React 前端
│  ├─ lib/              # 类型、接口、角色卡信息整理逻辑
│  └─ styles/           # 页面样式
├─ dist/                # npm run build 后生成
├─ package.json
└─ README.md
```

运行时会生成 `data/cache.json`，里面只有上次扫描到的酒馆路径缓存。这个文件不会提交到仓库。

## 本地开发

需要 Node.js 20 或更新版本。

```bash
npm install
npm run dev
```

默认地址：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:3829`

常用命令：

```bash
npm run check    # TypeScript 检查
npm run build    # 构建前端
npm run start    # 启动后端并托管 dist
```

生产运行前先构建：

```bash
npm run build
npm run start
```

## 配置

可以通过环境变量改端口和监听地址：

```bash
PORT=3829
HOST=127.0.0.1
```

本机使用保持 `HOST=127.0.0.1` 就好。需要让局域网手机或服务器外部访问时，改成 `HOST=0.0.0.0`。

Windows PowerShell 示例：

```powershell
$env:PORT="3829"
$env:HOST="0.0.0.0"
npm run start
```

Linux / Termux 示例：

```bash
PORT=3829 HOST=0.0.0.0 npm run start
```

## 部署教程

更详细的 PC、手机 Termux、服务器 Docker 部署步骤见 [docs/deployment.md](docs/deployment.md)。

## 注意事项

- 这个项目会读取和写入 SillyTavern 的 `characters` 目录，第一次使用前建议自己备份重要角色卡。
- 导入同名文件时会自动重命名，不会直接覆盖原文件。
- 如果没有扫描到酒馆，可以在连接弹窗里刷新扫描，或者把项目放在离 SillyTavern 更近的目录再试。
- 服务器部署时不要把整个 SillyTavern 目录公开到公网。只把这个工具通过反代暴露出去，也建议加访问限制。
