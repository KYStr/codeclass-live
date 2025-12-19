import express from 'express';
import { userOperations, codeOperations, feedbackOperations, submissionOperations } from '../database.js';

export const studentRoutes = express.Router();

// 獲取所有學生（老師用）
studentRoutes.get('/', (req, res) => {
  const students = userOperations.getAllStudents();
  
  const result = students.map(student => {
    const feedbacks = feedbackOperations.getByStudent(student.id);
    const submissions = submissionOperations.getByStudent(student.id);
    
    return {
      id: student.id,
      name: student.name,
      classroomId: student.classroom_id,
      currentCode: student.current_code || '',
      currentLanguage: student.current_language || 'python',
      isOnline: !!student.is_online,
      isPasswordSet: !!student.is_password_set,
      lastActive: student.last_active,
      feedbacks: feedbacks.map(f => ({
        id: f.id,
        message: f.message,
        timestamp: f.created_at,
        isRead: !!f.is_read,
        fromTeacher: !!f.from_teacher
      })),
      submissions: submissions.map(s => ({
        id: s.id,
        assignmentId: s.assignment_id,
        code: s.code,
        language: s.language,
        timestamp: s.created_at,
        status: s.status
      }))
    };
  });
  
  res.json(result);
});

// 獲取單個學生詳情
studentRoutes.get('/:id', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  const code = codeOperations.getCode(student.id);
  const feedbacks = feedbackOperations.getByStudent(student.id);
  const submissions = submissionOperations.getByStudent(student.id);
  
  res.json({
    id: student.id,
    name: student.name,
    classroomId: student.classroom_id,
    currentCode: code?.current_code || '',
    currentLanguage: code?.current_language || 'python',
    isOnline: !!student.is_online,
    isPasswordSet: !!student.is_password_set,
    lastActive: student.last_active,
    feedbacks: feedbacks.map(f => ({
      id: f.id,
      message: f.message,
      timestamp: f.created_at,
      isRead: !!f.is_read,
      fromTeacher: !!f.from_teacher
    })),
    submissions: submissions.map(s => ({
      id: s.id,
      assignmentId: s.assignment_id,
      code: s.code,
      language: s.language,
      timestamp: s.created_at,
      status: s.status
    }))
  });
});

// 創建新學生
studentRoutes.post('/', (req, res) => {
  const { name, classroomId } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '請輸入學生姓名' });
  }
  
  // 檢查名字是否已存在
  const existing = userOperations.getByName(name.trim(), 'student');
  if (existing) {
    return res.status(400).json({ error: '該姓名已存在' });
  }
  
  const student = userOperations.createStudent(name.trim(), classroomId);
  
  // 通知所有客戶端
  req.io.emit('student:created', {
    id: student.id,
    name: student.name,
    classroomId: student.classroom_id
  });
  
  res.json({
    id: student.id,
    name: student.name,
    classroomId: student.classroom_id,
    currentCode: `# ${student.name} 的程式碼\n# 請在這裡開始編寫...\n\nprint("Hello, World!")`,
    currentLanguage: 'python',
    isOnline: false,
    isPasswordSet: false,
    feedbacks: [],
    submissions: []
  });
});

// 更新學生所屬教室
studentRoutes.put('/:id/classroom', (req, res) => {
  const { classroomId } = req.body;
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  userOperations.updateStudentClassroom(req.params.id, classroomId);
  
  // 通知所有客戶端
  req.io.emit('student:updated', {
    studentId: req.params.id,
    classroomId
  });
  
  res.json({ success: true });
});

// 刪除學生
studentRoutes.delete('/:id', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  userOperations.deleteStudent(req.params.id);
  
  // 通知所有客戶端
  req.io.emit('student:deleted', { studentId: req.params.id });
  
  res.json({ success: true });
});

// 重置學生密碼
studentRoutes.post('/:id/reset-password', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  userOperations.resetPassword(req.params.id);
  
  res.json({ success: true, message: '密碼已重置，學生下次登入時需重新設置' });
});

// 發送反饋給學生
studentRoutes.post('/:id/feedback', (req, res) => {
  const { message } = req.body;
  
  if (!message || !message.trim()) {
    return res.status(400).json({ error: '請輸入留言內容' });
  }
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  const feedback = feedbackOperations.create(req.params.id, message.trim());
  
  const formattedFeedback = {
    id: feedback.id,
    message: feedback.message,
    timestamp: feedback.created_at,
    isRead: false,
    fromTeacher: true
  };
  
  // 即時發送給學生
  req.io.to(`student:${req.params.id}`).emit('feedback:new', formattedFeedback);
  
  res.json(formattedFeedback);
});

// 更新學生代碼
studentRoutes.put('/:id/code', (req, res) => {
  const { code, language } = req.body;
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  codeOperations.updateCode(req.params.id, code, language);
  userOperations.setOnlineStatus(req.params.id, true);
  
  // 即時廣播給老師
  req.io.to('teacher').emit('student:code-update', {
    studentId: req.params.id,
    code,
    language,
    lastActive: Date.now()
  });
  
  res.json({ success: true });
});

// 提交作業
studentRoutes.post('/:id/submit', (req, res) => {
  const { assignmentId, code, language } = req.body;
  
  if (!assignmentId || !code) {
    return res.status(400).json({ error: '請提供作業 ID 和代碼' });
  }
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: '學生不存在' });
  }
  
  const submission = submissionOperations.create(
    req.params.id,
    assignmentId,
    code,
    language || 'python'
  );
  
  const formattedSubmission = {
    id: submission.id,
    assignmentId: submission.assignment_id,
    code: submission.code,
    language: submission.language,
    timestamp: submission.created_at,
    status: submission.status
  };
  
  // 通知老師有新提交
  req.io.to('teacher').emit('submission:new', {
    studentId: req.params.id,
    studentName: student.name,
    submission: formattedSubmission
  });
  
  res.json(formattedSubmission);
});

// 標記反饋為已讀
studentRoutes.post('/:id/feedback/read', (req, res) => {
  feedbackOperations.markAsRead(req.params.id);
  res.json({ success: true });
});

