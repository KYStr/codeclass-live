import express from 'express';
import { userOperations } from '../database.js';

export const authRoutes = express.Router();

// 老師登入
authRoutes.post('/teacher/login', (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: '請輸入密碼' });
  }
  
  const teacher = userOperations.getTeacher();
  if (!teacher) {
    return res.status(500).json({ error: '系統錯誤：找不到老師帳戶' });
  }
  
  const isValid = userOperations.verifyPassword(teacher.id, password);
  if (!isValid) {
    return res.status(401).json({ error: '密碼錯誤' });
  }
  
  // 更新在線狀態
  userOperations.setOnlineStatus(teacher.id, true);
  
  res.json({
    success: true,
    user: {
      id: teacher.id,
      name: teacher.name,
      role: 'teacher'
    }
  });
});

// 老師登出
authRoutes.post('/teacher/logout', (req, res) => {
  const teacher = userOperations.getTeacher();
  if (teacher) {
    userOperations.setOnlineStatus(teacher.id, false);
  }
  res.json({ success: true });
});

// 老師修改密碼
authRoutes.post('/teacher/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '請填寫所有欄位' });
  }
  
  if (newPassword.length < 4) {
    return res.status(400).json({ error: '新密碼至少需要 4 個字符' });
  }
  
  const teacher = userOperations.getTeacher();
  if (!userOperations.verifyPassword(teacher.id, currentPassword)) {
    return res.status(401).json({ error: '當前密碼錯誤' });
  }
  
  userOperations.setPassword(teacher.id, newPassword);
  res.json({ success: true, message: '密碼已更新' });
});

// 學生登入（檢查是否需要設置密碼）
authRoutes.post('/student/check', (req, res) => {
  const { studentId } = req.body;
  
  if (!studentId) {
    return res.status(400).json({ error: '請選擇學生' });
  }
  
  const student = userOperations.getById(studentId);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  res.json({
    studentId: student.id,
    name: student.name,
    needsPassword: !student.is_password_set
  });
});

// 學生設置密碼（首次）
authRoutes.post('/student/set-password', (req, res) => {
  const { studentId, password } = req.body;
  
  if (!studentId || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' });
  }
  
  if (password.length < 4) {
    return res.status(400).json({ error: '密碼至少需要 4 個字符' });
  }
  
  const student = userOperations.getById(studentId);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  if (student.is_password_set) {
    return res.status(400).json({ error: '密碼已設置，請使用登入功能' });
  }
  
  userOperations.setPassword(studentId, password);
  userOperations.setOnlineStatus(studentId, true);
  
  res.json({
    success: true,
    user: {
      id: student.id,
      name: student.name,
      role: 'student'
    }
  });
});

// 學生登入
authRoutes.post('/student/login', (req, res) => {
  const { studentId, password } = req.body;
  
  if (!studentId || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' });
  }
  
  const student = userOperations.getById(studentId);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  if (!student.is_password_set) {
    return res.status(400).json({ error: '請先設置密碼' });
  }
  
  const isValid = userOperations.verifyPassword(studentId, password);
  if (!isValid) {
    return res.status(401).json({ error: '密碼錯誤' });
  }
  
  userOperations.setOnlineStatus(studentId, true);
  
  res.json({
    success: true,
    user: {
      id: student.id,
      name: student.name,
      role: 'student'
    }
  });
});

// 學生登出
authRoutes.post('/student/logout', (req, res) => {
  const { studentId } = req.body;
  
  if (studentId) {
    userOperations.setOnlineStatus(studentId, false);
    // 通知老師端學生已離線
    req.io.emit('student:offline', { studentId });
  }
  
  res.json({ success: true });
});

// 獲取所有學生列表（用於登入選擇）
authRoutes.get('/students', (req, res) => {
  const students = userOperations.getAllStudents();
  res.json(students.map(s => ({
    id: s.id,
    name: s.name,
    classroomId: s.classroom_id,
    isPasswordSet: !!s.is_password_set,
    isOnline: !!s.is_online
  })));
});

