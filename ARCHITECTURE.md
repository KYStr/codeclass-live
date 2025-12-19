# CodeClass Live - 项目架构说明文档

> 本文档专供大语言模型 (LLM) 阅读，用于理解项目结构和开发规范。

## 📋 项目概述

**CodeClass Live** 是一个线上课堂辅助网页应用，旨在帮助老师实时监控学生的程式编写情况，并提供即时反馈功能。

### 核心功能
1. ✅ 学生可以在类似 IDE 的界面中编写程式码（支持语法高亮）
2. ✅ 老师可以**实时**查看所有学生的程式码（WebSocket）
3. ✅ 老师可以给学生发送即时留言/反馈
4. ✅ 支持作业发布与提交功能（含截止日期）
5. ✅ 集成 AI (Gemini) 辅助分析代码
6. ✅ 老师可以管理学生名单（新增/删除/重置密码）
7. ✅ 密码保护系统（老师预设 admin，学生首次登入设置）
8. ✅ 代码执行功能（支持 Python/JavaScript）
9. ✅ 后端 API + 数据库持久化

---

## 🏗️ 技术栈

### 前端
| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式方案 | Tailwind CSS (CDN) |
| 图标库 | Lucide React |
| 代码编辑器 | Monaco Editor (@monaco-editor/react) |
| 实时通信 | Socket.IO Client |
| AI 服务 | Google Gemini API (gemini-2.5-flash) |

### 后端
| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 18+ |
| 框架 | Express 4 |
| 实时通信 | Socket.IO 4 |
| 数据库 | SQLite (better-sqlite3) |
| 密码加密 | bcryptjs |
| 代码执行 | Node.js child_process |

---

## 📁 目录结构

```
codeclass-live/
├── index.html              # HTML 入口
├── index.tsx               # React 入口
├── App.tsx                 # 主应用组件
├── types.ts                # TypeScript 类型定义
├── vite.config.ts          # Vite 配置
├── components/
│   ├── CodeEditor.tsx      # 代码编辑器（语法高亮）
│   ├── LoginPage.tsx       # 登录页面（密码认证）
│   ├── StudentDashboard.tsx # 学生端界面
│   └── TeacherDashboard.tsx # 老师端界面
├── services/
│   ├── api.ts              # REST API 服务
│   ├── socket.ts           # WebSocket 服务
│   └── geminiService.ts    # Gemini AI 服务
├── server/                 # 后端目录
│   ├── index.js            # 服务器入口
│   ├── database.js         # 数据库操作
│   ├── routes/
│   │   ├── auth.js         # 认证路由
│   │   ├── students.js     # 学生路由
│   │   └── assignments.js  # 作业路由
│   └── socket/
│       ├── handlers.js     # Socket 事件处理
│       └── codeRunner.js   # 代码执行器
├── ARCHITECTURE.md         # 本文档
├── README.md               # 项目说明
└── DEPLOYMENT.md           # 部署指南
```

---

## 🔷 数据库结构 (SQLite)

### users 表
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
  password_hash TEXT,
  is_password_set INTEGER DEFAULT 0,
  is_online INTEGER DEFAULT 0,
  last_active INTEGER,
  created_at INTEGER
);
```

### student_code 表
```sql
CREATE TABLE student_code (
  student_id TEXT PRIMARY KEY,
  current_code TEXT DEFAULT '',
  current_language TEXT DEFAULT 'python',
  FOREIGN KEY (student_id) REFERENCES users(id)
);
```

### feedbacks 表
```sql
CREATE TABLE feedbacks (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  from_teacher INTEGER DEFAULT 1,
  created_at INTEGER
);
```

### assignments 表
```sql
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date INTEGER,
  is_open INTEGER DEFAULT 1,
  created_at INTEGER
);
```

### submissions 表
```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT DEFAULT 'submitted',
  created_at INTEGER
);
```

---

## 🌐 API 端点

### 认证 (Auth)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/students` | 获取学生列表（登录用）|
| POST | `/api/auth/teacher/login` | 老师登录 |
| POST | `/api/auth/teacher/logout` | 老师登出 |
| POST | `/api/auth/teacher/change-password` | 修改老师密码 |
| POST | `/api/auth/student/check` | 检查学生是否需设密码 |
| POST | `/api/auth/student/set-password` | 学生首次设置密码 |
| POST | `/api/auth/student/login` | 学生登录 |
| POST | `/api/auth/student/logout` | 学生登出 |

### 学生 (Students)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/students` | 获取所有学生 |
| GET | `/api/students/:id` | 获取单个学生 |
| POST | `/api/students` | 创建学生 |
| DELETE | `/api/students/:id` | 删除学生 |
| POST | `/api/students/:id/reset-password` | 重置学生密码 |
| POST | `/api/students/:id/feedback` | 发送反馈 |
| PUT | `/api/students/:id/code` | 更新代码 |
| POST | `/api/students/:id/submit` | 提交作业 |

### 作业 (Assignments)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/assignments` | 获取所有作业 |
| POST | `/api/assignments` | 创建作业 |
| POST | `/api/assignments/:id/toggle` | 开放/关闭作业 |
| DELETE | `/api/assignments/:id` | 删除作业 |

---

## 📡 WebSocket 事件

### 客户端发送
| 事件 | 数据 | 说明 |
|------|------|------|
| `teacher:join` | - | 老师加入 |
| `student:join` | `{ studentId }` | 学生加入 |
| `code:update` | `{ studentId, code, language }` | 代码更新 |
| `feedback:send` | `{ studentId, message }` | 老师发送反馈 |
| `student:feedback-reply` | `{ studentId, message }` | 学生回复反馈 |
| `code:execute` | `{ studentId, code, language }` | 执行代码 |
| `code:input` | `{ studentId, input }` | 发送标准输入 (stdin) |
| `feedback:clear` | `{ studentId }` | 清空对话 |

### 服务器发送
| 事件 | 数据 | 说明 |
|------|------|------|
| `students:sync` | `Student[]` | 同步学生列表 |
| `student:online` | `{ studentId, name }` | 学生上线 |
| `student:offline` | `{ studentId }` | 学生离线 |
| `student:code-update` | `{ studentId, code, language }` | 代码更新 |
| `feedback:new` | `Feedback` | 新反馈（发送给学生）|
| `feedback:sent` | `Feedback` | 反馈确认（发送给老师）|
| `student:feedback-reply` | `Feedback` | 学生回复（发送给老师）|
| `code:result` | `{ output, error, executionTime }` | 执行结果 |
| `code:input-required` | `{ studentId }` | 需要标准输入 |
| `submission:new` | `{ studentId, submission }` | 新提交 |
| `feedback:cleared` | `{ studentId }` | 对话已清空 |

---

## 🧩 组件说明

### LoginPage.tsx
- 角色选择（老师/学生）
- 老师密码登录
- 学生选择 + 密码登录/首次设置

### TeacherDashboard.tsx
- 即时监控：查看所有学生代码
- 作业管理：创建/删除/开关作业
- 学生管理：新增/删除/重置密码
- 发送反馈、AI 分析、执行代码

### StudentDashboard.tsx
- Monaco 代码编辑器 + 语言切换
- 作业列表 + 提交
- 反馈悬浮窗（支持回复老师）
- AI 提示、执行代码
- 交互式输入支持 (stdin)

### CodeEditor.tsx
- Monaco Editor（VS Code 编辑器核心）
- IntelliSense 自动补全
- 快捷键支持（Ctrl+/ 注释等）
- 语法高亮 + 行号显示
- 状态栏（行数/字符数）

---

## ⚙️ 环境变量

### 前端 (.env.local)
```
VITE_GEMINI_API_KEY=your_api_key
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

> **重要提示**：
> 1. Vite 要求前端环境变量必须以 `VITE_` 前缀开头才能在浏览器中访问
> 2. `.env.local` 文件必须是 **UTF-8 编码**（不能是 UTF-16）
> 3. 在 Windows PowerShell 中使用 `echo` 创建文件会产生 UTF-16 编码，请使用以下命令创建 UTF-8 文件：
>    ```powershell
>    [System.IO.File]::WriteAllText(".env.local", "VITE_GEMINI_API_KEY=your_key`n", [System.Text.Encoding]::UTF8)
>    ```

### 后端 (server/.env)
```
PORT=3001
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 启动命令

### 开发模式
```bash
# 终端 1: 启动后端
cd server
npm run dev

# 终端 2: 启动前端
npm run dev
```

### 生产模式
```bash
# 构建前端
npm run build

# 启动后端
cd server
npm start
```

---

## 📝 开发备忘

### 默认账户
- 老师密码：`admin`
- 学生首次登录需自行设置密码

### 代码执行安全
- 执行超时：10 秒
- 输出限制：10000 字符
- 支持语言：Python, JavaScript

### 已知限制
- 代码执行无沙箱（生产环境需 Docker 隔离）
- 同一浏览器老师/学生共享 Socket

---

## 🔄 更新日志

### v0.4.2 (2025-12-19) - 对话功能优化
- ✅ 修复学生发送消息时重复显示问题
- ✅ 添加清空对话功能（老师端和学生端都可使用）
- ✅ 清空对话会同步删除数据库记录

### v0.4.1 (2025-12-19) - AI 模型优化
- ✅ Gemini 模型升级为 gemini-2.5-flash（更稳定、更快）
- ✅ 修复 .env.local 文件编码问题（UTF-16 → UTF-8）

### v0.4.0 (2025-12-19) - 功能修复与增强
- ✅ 修复空白页问题（Gemini API 环境变量加载）
- ✅ 修复老师反馈重复显示问题
- ✅ 添加学生回复反馈功能
- ✅ 修复 Python input() 交互式输入
- ✅ 修复 AI 提示服务（API Key 延迟初始化）
- ✅ 升级 Monaco Editor 替代 prism-react-renderer
- ✅ 支持代码编辑器快捷键（Ctrl+/、Ctrl+D 等）
- ✅ 支持 IntelliSense 自动补全

### v0.3.0 (2025-12-18) - 后端版本
- ✅ 添加 Node.js + Express 后端
- ✅ 添加 SQLite 数据库
- ✅ 添加密码认证系统
- ✅ 添加 WebSocket 实时通信
- ✅ 添加代码执行功能
- ✅ 创建登录页面
- ✅ 更新前端 API 服务
- ✅ 添加部署文档

### v0.2.0 (2025-12-18) - 功能增强
- 添加代码语法高亮
- 添加 localStorage 持久化
- 添加学生管理功能
- 作业系统优化

### v0.1.0 - 初始版本
- 基础功能实现

---

*最后更新：2025-12-19*
