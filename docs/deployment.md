# 部署教程

这份文档按实际使用场景写：电脑本地跑、手机 Termux 跑、服务器用 Docker 跑。

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

## 3. 服务器 Docker 部署

服务器上推荐用 Docker 跑。这样不用在宿主机上单独装 Node、pm2，也方便以后更新。

下面以 Ubuntu / Debian 为例。

### 安装 Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
```

如果当前用户不想每次都写 `sudo`，可以加入 docker 组：

```bash
sudo usermod -aG docker $USER
```

退出 SSH 后重新登录生效。

### 拉取项目

```bash
git clone <你的仓库地址>
cd tavern-character-gallery
```

### 挂载 SillyTavern 目录

打开 `docker-compose.yml`，把这一行左侧改成你服务器上的 SillyTavern 目录：

```yaml
- /path/to/SillyTavern:/app/tavern
```

例如你的酒馆在 `/opt/SillyTavern`：

```yaml
- /opt/SillyTavern:/app/tavern
```

容器会扫描 `/app/tavern`，也会把导入的角色卡写入这个目录下的 `characters` 文件夹。  
如果只想预览不想写入，可以把挂载改成只读：

```yaml
- /opt/SillyTavern:/app/tavern:ro
```

只读模式下不要使用导入、删除、另存这些会写文件的操作。

### 启动

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f
```

浏览器访问：

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

### Nginx 反向代理

如果要绑定域名，可以让 Nginx 反代到容器暴露的 `3829` 端口：

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

公网部署建议加访问控制，比如 Nginx Basic Auth、VPN、内网穿透鉴权，或者只绑定到内网地址。不要把整个 SillyTavern 目录直接暴露到公网。

## 4. 常见问题

### 页面能打开，但扫描不到酒馆

确认 SillyTavern 目录里有 `characters` 文件夹。  
Docker 部署时重点检查 `docker-compose.yml` 里的挂载路径，宿主机路径必须是真实存在的 SillyTavern 根目录。

### 角色卡封面不显示

先确认原文件是 PNG / WEBP，并且图片本身能打开。  
如果是 JSON 卡，JSON 本身通常没有封面图，只能显示卡内 `avatar` 或默认封面。

### 导入失败

检查后端是否有写入 `characters` 目录的权限。  
Docker 部署时，如果挂载目录属于其他用户，可能需要调整宿主机目录权限，或者先确认没有使用 `:ro` 只读挂载。

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
