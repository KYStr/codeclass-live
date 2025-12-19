import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, db } from './database.js';
import { authRoutes } from './routes/auth.js';
import { studentRoutes } from './routes/students.js';
import { assignmentRoutes } from './routes/assignments.js';
import classroomRoutes from './routes/classrooms.js';
import { setupSocketHandlers } from './socket/handlers.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.IO 配置
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// 中間件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// 將 io 實例附加到 request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/classrooms', classroomRoutes);

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 初始化數據庫並啟動服務器
initDatabase();

// 設置 Socket.IO 處理器
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 CodeClass Live 後端服務運行於 http://localhost:${PORT}`);
  console.log(`📡 WebSocket 服務已啟動`);
});

