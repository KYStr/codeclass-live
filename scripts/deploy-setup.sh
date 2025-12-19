#!/bin/bash
# CodeClass Live 部署設置腳本
# 在腾讯云 CVM (Ubuntu) 上運行此腳本

set -e

echo "🚀 CodeClass Live 部署設置開始..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查是否為 root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}請使用 root 權限運行此腳本${NC}"
  exit 1
fi

# 1. 更新系統
echo -e "${YELLOW}📦 更新系統...${NC}"
apt update && apt upgrade -y

# 2. 安裝 Node.js 20.x
echo -e "${YELLOW}📦 安裝 Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node.js 版本: $(node --version)"
echo "npm 版本: $(npm --version)"

# 3. 安裝 Python 3
echo -e "${YELLOW}📦 安裝 Python 3...${NC}"
apt install -y python3 python3-pip

# 4. 安裝 Nginx
echo -e "${YELLOW}📦 安裝 Nginx...${NC}"
apt install -y nginx

# 5. 安裝 PM2
echo -e "${YELLOW}📦 安裝 PM2...${NC}"
npm install -g pm2

# 6. 安裝 Git
echo -e "${YELLOW}📦 安裝 Git...${NC}"
apt install -y git

# 7. 創建應用目錄
echo -e "${YELLOW}📁 創建應用目錄...${NC}"
mkdir -p /var/www
cd /var/www

# 8. 檢查項目是否存在
if [ -d "codeclass-live" ]; then
  echo -e "${YELLOW}⚠️  項目目錄已存在，正在更新...${NC}"
  cd codeclass-live
  git pull
else
  echo -e "${YELLOW}📥 請手動克隆您的項目到 /var/www/codeclass-live${NC}"
  echo "   git clone <your-repo-url> /var/www/codeclass-live"
  echo "   或者使用 scp 上傳項目文件"
fi

echo ""
echo -e "${GREEN}✅ 基礎環境設置完成！${NC}"
echo ""
echo "接下來請執行以下步驟："
echo ""
echo "1. 將項目文件上傳到 /var/www/codeclass-live"
echo ""
echo "2. 設置後端："
echo "   cd /var/www/codeclass-live/server"
echo "   npm install"
echo "   nano .env  # 配置環境變數"
echo "   pm2 start index.js --name codeclass-backend"
echo ""
echo "3. 構建前端："
echo "   cd /var/www/codeclass-live"
echo "   npm install"
echo "   nano .env.local  # 配置環境變數"
echo "   npm run build"
echo ""
echo "4. 配置 Nginx（請參考 DEPLOYMENT.md）"
echo ""
echo "5. 配置 SSL："
echo "   apt install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d your-domain.com"
echo ""

