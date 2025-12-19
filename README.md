# CodeClass Live 🎓

> 即時程式教學輔助平台 - 讓線上程式教學更高效

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)

---

## ✨ 功能特色

### 👨‍🏫 老師端
- 📺 **即時監控** - 實時查看所有學生的程式碼
- 💬 **即時反饋** - 發送留言給學生
- 📝 **作業管理** - 發布、查看提交狀況
- 👥 **學生管理** - 新增、刪除、重置密碼
- 🤖 **AI 分析** - Gemini 智能分析學生代碼
- ▶️ **代碼執行** - 直接運行學生代碼

### 👨‍🎓 學生端
- 💻 **代碼編輯器** - 語法高亮、行號顯示
- 🌐 **多語言支援** - Python、JavaScript、Java、C++
- 📬 **接收反饋** - 懸浮視窗即時通知
- 📤 **作業提交** - 一鍵繳交作業
- 💡 **AI 提示** - 獲取智能提示
- ▶️ **執行代碼** - 立即查看結果

### 🔒 安全機制
- 🔐 **密碼保護** - 老師/學生皆需密碼登入
- 🔑 **老師預設密碼** - `admin`（請部署後立即修改）
- 👤 **學生首次登入** - 自行設置密碼

---

## 🚀 快速開始

### 系統需求
- Node.js 18+
- Python 3 (用於代碼執行)
- npm 或 yarn

### 安裝步驟

```bash
# 1. 克隆專案
git clone <repository-url>
cd codeclass-live

# 2. 安裝前端依賴
npm install

# 3. 安裝後端依賴
cd server
npm install
cd ..

# 4. 設置環境變數
# 前端 (.env.local)
echo "GEMINI_API_KEY=your_gemini_api_key" > .env.local

# 後端 (server/.env)
echo "PORT=3001" > server/.env
echo "FRONTEND_URL=http://localhost:3000" >> server/.env
```

### 啟動開發服務器

```bash
# 終端 1: 啟動後端
cd server
npm run dev

# 終端 2: 啟動前端
npm run dev
```

### 訪問應用
- 前端：http://localhost:3000
- 後端 API：http://localhost:3001/api

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                     CodeClass Live                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    Socket.IO    ┌──────────────┐          │
│  │   前端 App   │ ◄─────────────► │   後端 API   │          │
│  │  React 19    │    WebSocket    │  Express     │          │
│  │  Vite 6      │                 │  Node.js     │          │
│  └──────────────┘                 └──────────────┘          │
│         │                                │                   │
│         │ REST API                       │                   │
│         └────────────────────────────────┤                   │
│                                          │                   │
│                              ┌───────────▼───────────┐      │
│                              │      SQLite DB        │      │
│                              │  • 用戶 • 代碼 • 作業  │      │
│                              └───────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 專案結構

```
codeclass-live/
├── components/           # React 組件
│   ├── CodeEditor.tsx    # 代碼編輯器
│   ├── LoginPage.tsx     # 登入頁面
│   ├── StudentDashboard.tsx
│   └── TeacherDashboard.tsx
├── services/             # 服務層
│   ├── api.ts            # REST API
│   ├── socket.ts         # WebSocket
│   └── geminiService.ts  # AI 服務
├── server/               # 後端
│   ├── index.js          # 入口
│   ├── database.js       # 資料庫
│   ├── routes/           # API 路由
│   └── socket/           # Socket 處理
├── App.tsx               # 主應用
├── types.ts              # 類型定義
└── vite.config.ts        # Vite 配置
```

---

## 🔧 API 參考

### 認證
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/auth/teacher/login` | POST | 老師登入 |
| `/api/auth/student/login` | POST | 學生登入 |
| `/api/auth/student/set-password` | POST | 設置密碼 |

### 學生
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/students` | GET | 獲取所有學生 |
| `/api/students` | POST | 創建學生 |
| `/api/students/:id` | DELETE | 刪除學生 |
| `/api/students/:id/feedback` | POST | 發送反饋 |
| `/api/students/:id/submit` | POST | 提交作業 |

### 作業
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/assignments` | GET | 獲取所有作業 |
| `/api/assignments` | POST | 創建作業 |
| `/api/assignments/:id/toggle` | POST | 開關作業 |

---

## 🌍 部署

詳細部署指南請參閱 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 快速部署（腾讯云 CVM）

```bash
# 在服务器上
git clone <repo> /var/www/codeclass-live
cd /var/www/codeclass-live

# 安装依赖
npm install
cd server && npm install && cd ..

# 构建前端
npm run build

# 使用 PM2 启动后端
pm2 start server/index.js --name codeclass-backend

# 配置 Nginx 反向代理...
```

---

## 📖 使用指南

### 老師操作流程
1. 使用密碼 `admin` 登入
2. 前往「學生管理」新增學生
3. 前往「作業管理」發布作業
4. 在「即時監控」查看學生代碼
5. 選擇學生發送反饋或 AI 分析

### 學生操作流程
1. 選擇自己的名字
2. 首次登入設置密碼
3. 查看作業說明
4. 編寫代碼並執行測試
5. 繳交作業

---

## 🔮 未來規劃

- [ ] 多班級支援
- [ ] 成績評分系統
- [ ] 代碼執行 Docker 沙箱
- [ ] 學生互評功能
- [ ] 歷史代碼版本
- [ ] 導出成績報告

---

## 📄 授權

MIT License

---

## 🙏 致謝

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Socket.IO](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [Google Gemini](https://ai.google.dev/)

---

*Made with ❤️ for educators and students*
