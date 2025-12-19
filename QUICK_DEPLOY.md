# 🚀 CodeClass Live 快速部署指南

## 一、準備工作

### 1. 腾讯云 CVM 配置

1. 登錄 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 購買雲服務器 CVM：
   - **地域**：選擇離您最近的地區
   - **實例**：標準型 S5（2核4G 即可）
   - **系統**：Ubuntu 22.04 LTS
   - **帶寬**：5Mbps（按需調整）

3. 在**安全組**中開放端口：
   - 22 (SSH)
   - 80 (HTTP)
   - 443 (HTTPS)

### 2. 域名準備（可選）

- 購買域名並解析到服務器 IP
- 如無域名，可直接使用 IP 訪問

---

## 二、服務器初始化

### 連接服務器

```bash
ssh root@你的服務器IP
```

### 運行初始化腳本

```bash
# 下載並運行初始化腳本
curl -sSL https://raw.githubusercontent.com/your-repo/codeclass-live/main/scripts/deploy-setup.sh | bash

# 或者手動執行以下命令：
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs python3 python3-pip nginx git
npm install -g pm2
```

---

## 三、上傳項目文件

### 方法 1：使用 Git（推薦）

```bash
cd /var/www
git clone <你的倉庫地址> codeclass-live
```

### 方法 2：使用 SCP 直接上傳

在**本地電腦**執行：

```bash
# Windows PowerShell
scp -r C:\Users\123ik\Desktop\codeclass-live root@你的服務器IP:/var/www/
```

---

## 四、配置後端

```bash
cd /var/www/codeclass-live/server

# 安裝依賴
npm install

# 創建環境配置
cat > .env << EOF
PORT=3001
FRONTEND_URL=http://你的域名或IP
EOF

# 使用 PM2 啟動
pm2 start index.js --name codeclass-backend
pm2 save
pm2 startup
```

---

## 五、配置前端

```bash
cd /var/www/codeclass-live

# 安裝依賴
npm install

# 創建環境配置
cat > .env.local << EOF
VITE_GEMINI_API_KEY=你的Gemini_API_Key
VITE_API_URL=http://你的域名或IP/api
VITE_SOCKET_URL=http://你的域名或IP
EOF

# 構建
npm run build
```

---

## 六、配置 Nginx

```bash
# 複製配置
cp /var/www/codeclass-live/scripts/nginx-codeclass.conf /etc/nginx/sites-available/codeclass

# 編輯配置，替換域名
nano /etc/nginx/sites-available/codeclass
# 將 your-domain.com 替換為您的實際域名或 IP

# 啟用站點
ln -s /etc/nginx/sites-available/codeclass /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 測試並重啟
nginx -t
systemctl restart nginx
```

---

## 七、配置 HTTPS（有域名時）

```bash
# 安裝 Certbot
apt install -y certbot python3-certbot-nginx

# 獲取 SSL 證書
certbot --nginx -d 你的域名

# 測試自動續期
certbot renew --dry-run
```

---

## 八、驗證部署

1. 訪問 `http://你的域名或IP`
2. 測試老師登錄（密碼：admin）
3. 測試學生登錄
4. 確認即時監控功能正常

---

## 九、日常維護

### 查看服務狀態
```bash
pm2 status
pm2 logs codeclass-backend
```

### 更新代碼
```bash
cd /var/www/codeclass-live
git pull  # 或重新上傳文件

# 後端
cd server && npm install && pm2 restart codeclass-backend

# 前端
cd .. && npm install && npm run build && nginx -s reload
```

### 備份數據庫
```bash
cp /var/www/codeclass-live/server/codeclass.db ~/backup/codeclass-$(date +%Y%m%d).db
```

---

## ⚠️ 重要提醒

1. **修改密碼**：部署後請立即修改老師預設密碼
2. **HTTPS**：生產環境強烈建議使用 HTTPS
3. **防火牆**：只開放必要端口
4. **備份**：定期備份 `codeclass.db` 數據庫文件

---

## 📞 常見問題

### Q: 網站無法訪問？
- 檢查防火牆/安全組是否開放 80/443 端口
- 檢查 Nginx 是否正常運行：`systemctl status nginx`

### Q: WebSocket 連接失敗？
- 確認 Nginx 配置中的 `/socket.io` 代理正確
- 檢查後端是否正常運行：`pm2 status`

### Q: 代碼執行功能不工作？
- 確認已安裝 Python：`python3 --version`
- 檢查後端日誌：`pm2 logs codeclass-backend`

---

*祝部署順利！🎉*

