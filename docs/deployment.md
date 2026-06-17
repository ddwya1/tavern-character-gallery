# 部署教程

这份文档按实际使用场景写：电脑本地跑、手机 Termux 跑、VPS 跑。

## 1. PC 本地运行

适合 Windows / macOS / Linux 桌面环境。SillyTavern 和酒馆角色馆在同一台机器上时最省事。

### Windows

安装 Node.js 20 以上版本后，在项目目录执行：

```powershell
cd D:\your-path\tavern-character-gallery
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

如果只是日常使用，不需要开发热更新，可以用生产模式：

```powershell
npm install
npm run build
npm run start
```

### macOS / Linux

```bash
cd /your-path/tavern-character-gallery
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

## 2. 手机 Termux 运行

适合 Android 手机上直接管理本机或共享存储里的 SillyTavern。

先在 Termux 安装基础环境：

```bash
pkg update
pkg install nodejs git
```

克隆项目：

```bash
git clone <你的仓库地址>
cd tavern-character-gallery
npm install
```

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
HOST=0.0.0.0 PORT=3829 npm run start
```

手机浏览器打开：

```text
http://127.0.0.1:3829
```

如果想让同一局域网的电脑访问，先查手机 IP：

```bash
ip addr
```

然后在电脑浏览器打开：

```text
http://手机IP:3829
```

Termux 访问手机共享存储前，先执行：

```bash
termux-setup-storage
```

之后常见路径会在这里：

```text
/storage/emulated/0
```

## 3. VPS 部署

VPS 更适合远程整理卡库。注意：如果 SillyTavern 不在同一台服务器上，这个项目只能扫描服务器本机的目录，不能直接扫描你电脑里的酒馆。

### 安装

以 Ubuntu / Debian 为例：

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

拉代码并安装：

```bash
git clone <你的仓库地址>
cd tavern-character-gallery
npm ci
npm run build
```

启动：

```bash
HOST=0.0.0.0 PORT=3829 npm run start
```

浏览器访问：

```text
http://服务器IP:3829
```

### 用 pm2 常驻

```bash
sudo npm install -g pm2
HOST=0.0.0.0 PORT=3829 pm2 start server/index.js --name tavern-character-gallery
pm2 save
pm2 startup
```

查看状态：

```bash
pm2 status
pm2 logs tavern-character-gallery
```

### Nginx 反向代理

示例配置：

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

改完后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

公网部署建议再加一层访问控制，比如 Nginx Basic Auth、VPN、内网穿透鉴权，或者只绑定到内网地址。

## 4. 更新项目

```bash
git pull
npm install
npm run build
```

如果用 pm2：

```bash
pm2 restart tavern-character-gallery
```

## 5. 常见问题

### 页面能打开，但扫描不到酒馆

确认 SillyTavern 目录里有 `characters` 文件夹。  
如果酒馆在外接盘、云盘或奇怪目录里，自动扫描可能找不到，建议把项目放到和 SillyTavern 更近的位置运行。

### 角色卡封面不显示

先确认原文件是 PNG / WEBP，并且图片本身能打开。  
如果是 JSON 卡，JSON 本身通常没有封面图，只能显示卡内 `avatar` 或默认封面。

### 导入失败

检查后端是否有写入 `characters` 目录的权限。  
Windows 可以尝试用普通用户目录运行；Linux / VPS 注意不要把酒馆目录放到当前用户无权写入的位置。

### 手机上访问电脑服务

电脑启动时需要：

```bash
HOST=0.0.0.0 npm run start
```

然后手机访问：

```text
http://电脑局域网IP:3829
```

Windows 防火墙如果拦截 Node.js，需要允许它通过专用网络。

