import express from 'express';
import { assignmentOperations, submissionOperations, userOperations } from '../database.js';

export const assignmentRoutes = express.Router();

// 獲取所有作業
assignmentRoutes.get('/', (req, res) => {
  const { classroomId } = req.query;
  
  // 如果指定了教室，只獲取該教室的作業
  const assignments = classroomId 
    ? assignmentOperations.getByClassroom(classroomId)
    : assignmentOperations.getAll();
  
  const result = assignments.map(a => {
    const submissions = submissionOperations.getByAssignment(a.id);
    const totalStudents = userOperations.getStudentCountByClassroom(a.classroom_id);
    
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      classroomId: a.classroom_id,
      dueDate: a.due_date,
      isOpen: !!a.is_open,
      createdAt: a.created_at,
      submissionCount: submissions.length,
      totalStudents,
      submitters: submissions.map(s => ({
        studentId: s.student_id,
        studentName: s.student_name,
        submittedAt: s.created_at
      }))
    };
  });
  
  res.json(result);
});

// 創建作業
assignmentRoutes.post('/', (req, res) => {
  const { title, description, dueDate, classroomId } = req.body;
  
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '請輸入作業標題' });
  }
  
  const assignment = assignmentOperations.create(
    title.trim(),
    description || '',
    dueDate || null,
    classroomId || null
  );
  
  const formattedAssignment = {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    classroomId: assignment.classroom_id,
    dueDate: assignment.due_date,
    isOpen: true,
    createdAt: assignment.created_at,
    submissionCount: 0,
    totalStudents: userOperations.getStudentCountByClassroom(assignment.classroom_id),
    submitters: []
  };
  
  // 通知所有客戶端
  req.io.emit('assignment:created', formattedAssignment);
  
  res.json(formattedAssignment);
});

// 修改作業截止日期
assignmentRoutes.put('/:id/due-date', (req, res) => {
  const { dueDate } = req.body;
  const assignment = assignmentOperations.updateDueDate(req.params.id, dueDate ?? null);
  
  if (!assignment) {
    return res.status(404).json({ error: '找不到此作業' });
  }

  const submissions = submissionOperations.getByAssignment(assignment.id);
  const totalStudents = userOperations.getStudentCountByClassroom(assignment.classroom_id);

  const formattedAssignment = {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    classroomId: assignment.classroom_id,
    dueDate: assignment.due_date,
    isOpen: !!assignment.is_open,
    createdAt: assignment.created_at,
    submissionCount: submissions.length,
    totalStudents,
    submitters: submissions.map(s => ({
      studentId: s.student_id,
      studentName: s.student_name,
      submittedAt: s.created_at
    }))
  };

  req.io.emit('assignment:updated', formattedAssignment);
  res.json(formattedAssignment);
});

// 切換作業開放狀態
assignmentRoutes.post('/:id/toggle', (req, res) => {
  assignmentOperations.toggleOpen(req.params.id);
  
  // 通知所有客戶端
  req.io.emit('assignment:toggled', { assignmentId: req.params.id });
  
  res.json({ success: true });
});

// 刪除作業
assignmentRoutes.delete('/:id', (req, res) => {
  assignmentOperations.delete(req.params.id);
  
  // 通知所有客戶端
  req.io.emit('assignment:deleted', { assignmentId: req.params.id });
  
  res.json({ success: true });
});

// 獲取作業的所有提交
assignmentRoutes.get('/:id/submissions', (req, res) => {
  const submissions = submissionOperations.getByAssignment(req.params.id);
  
  res.json(submissions.map(s => ({
    id: s.id,
    studentId: s.student_id,
    studentName: s.student_name,
    code: s.code,
    language: s.language,
    timestamp: s.created_at,
    status: s.status
  })));
});

