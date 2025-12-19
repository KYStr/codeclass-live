# CodeClass Live - 腾讯云部署指南

## 📋 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        腾讯云 CVM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐         ┌─────────────────┐               │
│   │   Nginx         │         │   Node.js       │               │
│   │   (反向代理)     │────────►│   後端服務       │               │
│   │   Port: 80/443  │         │   Port: 3001    │               │
│   └────────┬────────┘         └────────┬────────┘               │
│            │                           │                         │
│            │                           │                         │
│   ┌────────▼────────┐         ┌────────▼────────┐               │
│   │   前端靜態文件   │         │   SQLite        │               │
│   │   (Vite Build)  │         │   數據庫         │               │
│   └─────────────────┘         └─────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ 方案一：腾讯云 CVM 部署

### 1. 购买云服务器

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 选择「云服务器 CVM」→「新建」
3. 推荐配置：
   - 地域：离用户最近的地区
   - 实例：标准型 S5（2核4G 起）
   - 系统：Ubuntu 22.04 LTS
   - 带宽：按需选择（建议 5Mbps+）

### 2. 连接服务器

```bash
ssh root@your-server-ip
```

### 3. 安装必要软件

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# 安装 Python 3 (用于代码执行)
apt install -y python3 python3-pip

# 安装 Nginx
apt install -y nginx

# 安装 PM2 (进程管理)
npm install -g pm2

# 安装 Git
apt install -y git
```

### 4. 克隆项目

```bash
cd /var/www
git clone <your-repo-url> codeclass-live
cd codeclass-live
```

### 5. 配置后端

```bash
cd server

# 安装依赖
npm install

# 创建环境配置
cat > .env << EOF
PORT=3001
FRONTEND_URL=https://your-domain.com
EOF

# 使用 PM2 启动后端
pm2 start index.js --name codeclass-backend
pm2 save
pm2 startup
```

### 6. 构建前端

```bash
cd /var/www/codeclass-live

# 安装依赖
npm install

# 创建环境配置
cat > .env.local << EOF
GEMINI_API_KEY=your_gemini_api_key
VITE_API_URL=https://your-domain.com/api
VITE_SOCKET_URL=https://your-domain.com
EOF

# 构建
npm run build
```

### 7. 配置 Nginx

```bash
cat > /etc/nginx/sites-available/codeclass << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/codeclass-live/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# 启用站点
ln -s /etc/nginx/sites-available/codeclass /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# 测试并重启 Nginx
nginx -t
systemctl restart nginx
```

### 8. 配置 SSL (HTTPS)

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
certbot --nginx -d your-domain.com

# 自动续期
certbot renew --dry-run
```

### 9. 防火墙设置

在腾讯云控制台的「安全组」中开放以下端口：
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)

---

## ☁️ 方案二：腾讯云 CloudBase (Serverless)

### 1. 创建 CloudBase 环境

1. 登录 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 创建新环境，选择「按量计费」

### 2. 安装 CloudBase CLI

```bash
npm install -g @cloudbase/cli
tcb login
```

### 3. 初始化项目

```bash
cd codeclass-live
tcb init
```

### 4. 部署前端

```bash
# 构建
npm run build

# 部署到静态托管
tcb hosting deploy ./dist -e your-env-id
```

### 5. 部署云函数

需要将后端代码改造为云函数格式，详见 [CloudBase 云函数文档](https://docs.cloudbase.net/cloud-function/introduce)

> ⚠️ 注意：CloudBase 云函数对 WebSocket 的支持有限，建议使用 CVM 方案以获得更好的实时通信体验。

---

## 📦 方案三：Docker 部署

### Dockerfile (后端)

```dockerfile
# server/Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装 Python (用于代码执行)
RUN apk add --no-cache python3

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["node", "index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - FRONTEND_URL=http://your-domain.com
    volumes:
      - ./server/codeclass.db:/app/codeclass.db
```

### 部署命令

```bash
docker-compose up -d
```

---

## 🔧 运维命令

### PM2 常用命令

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs codeclass-backend

# 重启服务
pm2 restart codeclass-backend

# 监控
pm2 monit
```

### 数据库备份

```bash
# 备份 SQLite 数据库
cp /var/www/codeclass-live/server/codeclass.db /backup/codeclass-$(date +%Y%m%d).db

# 设置定时备份 (crontab -e)
0 2 * * * cp /var/www/codeclass-live/server/codeclass.db /backup/codeclass-$(date +\%Y\%m\%d).db
```

### 更新部署

```bash
cd /var/www/codeclass-live

# 拉取最新代码
git pull

# 更新后端
cd server
npm install
pm2 restart codeclass-backend

# 更新前端
cd ..
npm install
npm run build

# 清理 Nginx 缓存
nginx -s reload
```

---

## 🔒 安全建议

1. **修改默认密码**：部署后立即修改老师的预设密码 (admin)
2. **使用 HTTPS**：确保所有通信使用 SSL 加密
3. **防火墙**：只开放必要的端口
4. **定期备份**：设置自动备份数据库
5. **更新依赖**：定期更新 npm 包以修复安全漏洞

---

## 💰 成本估算

### 腾讯云 CVM 方案
| 资源 | 规格 | 月费用（估算）|
|------|------|---------------|
| CVM | 2核4G | ¥100-200 |
| 带宽 | 5Mbps | ¥100-150 |
| 域名 | .com | ¥55/年 |
| SSL | 免费（Let's Encrypt）| ¥0 |

**总计**：约 ¥200-350/月

### 腾讯云 CloudBase 方案
按量计费，小规模使用可能更便宜，但 WebSocket 支持有限。

---

## 📞 技术支持

- [腾讯云文档中心](https://cloud.tencent.com/document)
- [CloudBase 文档](https://docs.cloudbase.net/)
- [Node.js 文档](https://nodejs.org/docs/)

---

*最后更新：2024-12-18*

