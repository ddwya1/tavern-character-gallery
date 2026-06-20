# 部署教程

这份教程尽量按新手能跟着走的方式写。先选你要用的场景：

- 只在电脑上自己用：看「PC 本地运行」。
- 想在 Android 手机上跑：看「Termux 运行」。
- 想放到 VPS 或家里小主机：看「Docker 部署」。

## PC 本地运行

适合 Windows、macOS、Linux。SillyTavern 和酒馆角色馆在同一台电脑上时，这种方式最省事。

### 第一步：安装 Node.js

安装 Node.js 20 或更新版本。

装好后打开终端，输入：

```bash
node -v
```

能看到 `v20`、`v21`、`v22` 之类的版本号就可以。

### 第二步：进入项目目录

Windows 示例：

```powershell
cd D:\your-path\tavern-character-gallery
```

macOS / Linux 示例：

```bash
cd /your-path/tavern-character-gallery
```

这里的路径换成你实际放项目的位置。

### 第三步：安装依赖

```bash
npm install
```

这一步会下载项目需要的包，第一次会慢一点。

### 第四步：启动

日常使用推荐生产模式：

```bash
npm run build
npm run start
```

然后打开：

```text
http://127.0.0.1:3829
```

如果你在改代码，用开发模式：

```bash
npm run dev
```

开发模式打开：

```text
http://127.0.0.1:5173
```

## 手机访问电脑上的服务

电脑启动时要让服务监听局域网。

Windows PowerShell：

```powershell
$env:HOST="0.0.0.0"
$env:PORT="3829"
npm run start
```

macOS / Linux：

```bash
HOST=0.0.0.0 PORT=3829 npm run start
```

然后查电脑的局域网 IP。比如电脑 IP 是 `192.168.1.23`，手机浏览器打开：

```text
http://192.168.1.23:3829
```

手机和电脑要在同一个 Wi-Fi 下。Windows 防火墙如果弹窗，允许 Node.js 访问专用网络。

## Termux 运行

适合 Android 手机。可以直接在手机上管理本机存储里的 SillyTavern。

### 第一步：安装基础环境

打开 Termux：

```bash
pkg update
pkg install nodejs git
```

### 第二步：允许访问手机存储

```bash
termux-setup-storage
```

执行后，手机存储一般在：

```text
/storage/emulated/0
```

### 第三步：下载项目

```bash
git clone <你的仓库地址>
cd tavern-character-gallery
npm install
```

### 第四步：启动

```bash
npm run build
HOST=0.0.0.0 PORT=3829 npm run start
```

手机浏览器打开：

```text
http://127.0.0.1:3829
```

如果想让同一 Wi-Fi 下的电脑访问手机上的服务，先查手机 IP：

```bash
ip addr
```

然后在电脑浏览器打开：

```text
http://手机IP:3829
```

## Docker 部署

VPS、NAS、家里小主机都建议用 Docker。这样不需要在系统里单独管理 Node.js，也方便以后更新。

下面以 Ubuntu / Debian 为例。

### 第一步：安装 Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
```

如果不想每次都写 `sudo`：

```bash
sudo usermod -aG docker $USER
```

退出 SSH，再重新登录。

### 第二步：下载项目

```bash
git clone <你的仓库地址>
cd tavern-character-gallery
```

### 第三步：改 SillyTavern 路径

打开 `docker-compose.yml`，找到这一段：

```yaml
volumes:
  - ./data:/app/data
  - /path/to/SillyTavern:/app/tavern
```

把 `/path/to/SillyTavern` 换成你服务器上的 SillyTavern 目录。

例如你的酒馆在 `/opt/SillyTavern`：

```yaml
volumes:
  - ./data:/app/data
  - /opt/SillyTavern:/app/tavern
```

容器会扫描 `/app/tavern`。导入角色卡时，会写入这个目录下的 `characters` 文件夹。

如果你只想预览，不想让它写文件，可以挂成只读：

```yaml
- /opt/SillyTavern:/app/tavern:ro
```

只读模式下不要用导入、删除、另存为这些会写文件的功能。

### 第四步：启动

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
```

看日志：

```bash
docker compose logs -f
```

浏览器打开：

```text
http://服务器IP:3829
```

### 更新

```bash
git pull
docker compose up -d --build
```

### 停止

```bash
docker compose down
```

## Nginx 反向代理

如果你要绑定域名，可以让 Nginx 转发到 `3829`。

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3829;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

改完检查配置：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

公网使用时建议加访问限制，比如 Basic Auth、VPN、内网穿透鉴权，或者只允许自己的 IP 访问。角色卡和酒馆目录都不适合裸奔。

## 常见问题

### 页面能打开，但扫描不到酒馆

先确认 SillyTavern 目录里有 `characters` 文件夹。Docker 部署时，重点检查 `docker-compose.yml` 的挂载路径，左边必须是宿主机真实存在的 SillyTavern 目录。

也可以在页面右上角打开设置，手动选择酒馆路径。

### 封面不显示

先确认原角色卡文件本身能打开。PNG / WEBP 通常会直接显示封面；JSON 卡不一定自带图片，只能显示卡里的 `avatar` 或默认封面。

如果是从酒馆扫描出来的 PNG / WEBP，但封面仍然不显示，通常是路径没选对，或者 Docker 没有挂载到真正的 SillyTavern 目录。

### 导入失败

检查后端有没有写入 `characters` 目录的权限。

Docker 部署时，确认挂载没有加 `:ro`。如果目录属于别的用户，可能还需要调整宿主机目录权限。

### 手机打不开电脑地址

确认三件事：

1. 电脑启动时用了 `HOST=0.0.0.0`。
2. 手机和电脑在同一个局域网。
3. 防火墙没有拦截 Node.js 或 `3829` 端口。

### 端口被占用

换一个端口：

```bash
PORT=3830 npm run start
```

然后打开：

```text
http://127.0.0.1:3830
```
