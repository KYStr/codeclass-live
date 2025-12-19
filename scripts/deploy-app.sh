#!/bin/bash
# CodeClass Live 應用部署腳本
# 在已設置好環境的服務器上運行

set -e

echo "🚀 部署 CodeClass Live..."

PROJECT_DIR="/var/www/codeclass-live"
cd $PROJECT_DIR

# 停止現有服務
echo "🛑 停止現有服務..."
pm2 stop codeclass-backend 2>/dev/null || true

# 更新後端
echo "📦 更新後端依賴..."
cd $PROJECT_DIR/server
npm install --production

# 啟動後端
echo "🚀 啟動後端服務..."
pm2 start index.js --name codeclass-backend || pm2 restart codeclass-backend
pm2 save

# 構建前端
echo "🔨 構建前端..."
cd $PROJECT_DIR
npm install
npm run build

# 重載 Nginx
echo "🔄 重載 Nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服務狀態："
pm2 status

echo ""
echo "🌐 請訪問您的網站確認部署成功"

