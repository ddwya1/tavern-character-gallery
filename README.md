# 酒馆角色馆

这是给 SillyTavern 用户用的角色卡整理工具。

它不替代酒馆，也不碰聊天模型。它做的事情很简单：把本地角色卡先摆出来，让你看封面、看设定、看开场白、看世界书和正则。确认喜欢之后，再导入到 SillyTavern。

如果你的角色卡很多，或者经常从外面下载新卡，这个工具会省不少翻文件夹的时间。

## 界面预览

PC：

![PC 封面墙](docs/images/preview-pc.jpg)

手机：

![手机封面墙](docs/images/preview-mobile.jpg)

## 能做什么

- 扫描本机常见目录，寻找 SillyTavern。
- 读取 `characters` 目录里的 PNG、WEBP、JSON 角色卡。
- 解析 PNG 角色卡里的 `chara`、`ccv3`、`data` 等文本块。
- 用封面墙展示角色卡，封面直接走图片接口，不把几百张图塞进列表接口里。
- 本地导入角色卡后，先放进待导入区，不会立刻写进酒馆。
- 详情页把内容拆开看：角色摘要、身份设定、行为与对话、提示词、开场白、世界书、正则、版本历史。
- 开场白按条目切换，世界书按条目折叠，正则会去重后再展示。
- 支持搜索、收藏、删除、另存为、导入酒馆。
- 首页有封面堆叠轮播，也可以随机抽一张已导入角色卡。
- PC 和手机浏览器都能用，Android 上也可以用 Termux 跑。

聊天记录功能目前是关掉的。详情页里会看到一个被划掉的入口，但点了不会有反应。等这个功能维护稳定后再打开。

## 快速开始

需要先安装 Node.js 20 或更新版本。

```bash
npm install
npm run build
npm run start
```

打开：

```text
http://127.0.0.1:3829
```

开发时可以用：

```bash
npm run dev
```

开发模式下前端默认在 `http://127.0.0.1:5173`，后端仍然在 `3829`。

## Docker 运行

服务器上更推荐 Docker。先改 `docker-compose.yml` 里的挂载路径：

```yaml
- /path/to/SillyTavern:/app/tavern
```

把左边换成你服务器上的 SillyTavern 目录。然后启动：

```bash
docker compose up -d --build
```

访问：

```text
http://服务器IP:3829
```

更详细的 PC、Termux、VPS 教程在 [docs/deployment.md](docs/deployment.md)。

## 项目结构

```text
.
├─ server/              后端接口，负责扫描、解析、导入文件
├─ src/                 React 前端
│  ├─ lib/              类型、接口、角色卡内容整理逻辑
│  └─ styles/           页面样式
├─ docs/                功能说明和部署教程
├─ Dockerfile
├─ docker-compose.yml
└─ package.json
```

运行后会生成 `data/cache.json`，用来记住上次选过的酒馆路径。这个文件不需要提交。

## 常用命令

```bash
npm run check     # TypeScript 检查
npm run build     # 构建前端
npm run start     # 启动生产服务
npm run dev       # 开发模式
```

## 配置

可以用环境变量改端口和监听地址：

```bash
PORT=3829
HOST=127.0.0.1
```

本机使用保持 `HOST=127.0.0.1` 就好。要让局域网手机访问，或部署到服务器上，改成 `HOST=0.0.0.0`。

Windows PowerShell：

```powershell
$env:PORT="3829"
$env:HOST="0.0.0.0"
npm run start
```

Linux / Termux：

```bash
PORT=3829 HOST=0.0.0.0 npm run start
```

## 使用前看一眼

- 第一次使用前，建议先备份重要角色卡。
- 导入同名文件时会自动改名，不会直接覆盖原文件。
- 如果没有扫描到酒馆，可以在设置里手动选择 SillyTavern 目录。
- 服务器部署时，不要把整个 SillyTavern 目录直接公开到公网。这个工具也建议放在反向代理、内网、VPN 或带访问限制的环境里。
