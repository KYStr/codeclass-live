import express from 'express';
import { classroomOperations, userOperations, assignmentOperations, feedbackOperations, submissionOperations, formatClassroomTimer } from '../database.js';

const router = express.Router();

function emitClassroomTimerUpdate(req, classroom) {
  const payload = {
    classroomId: classroom.id,
    timer: formatClassroomTimer(classroom)
  };

  req.io.to('teacher').emit('classroom:timer-updated', payload);
  classroomOperations.getStudents(classroom.id).forEach(student => {
    req.io.to(`student:${student.id}`).emit('classroom:timer-updated', payload);
  });
}

// 獲取所有教室
router.get('/', (req, res) => {
  try {
    const classrooms = classroomOperations.getAll();
    res.json({ success: true, classrooms });
  } catch (error) {
    console.error('獲取教室列表失敗:', error);
    res.status(500).json({ success: false, error: '獲取教室列表失敗' });
  }
});

// 獲取單個教室詳情
router.get('/:id', (req, res) => {
  try {
    const classroom = classroomOperations.getById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, error: '教室不存在' });
    }
    res.json({ success: true, classroom });
  } catch (error) {
    console.error('獲取教室詳情失敗:', error);
    res.status(500).json({ success: false, error: '獲取教室詳情失敗' });
  }
});

// 創建教室
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: '請輸入教室名稱' });
    }
    const classroom = classroomOperations.create(name.trim(), description);
    res.json({ success: true, classroom });
  } catch (error) {
    console.error('創建教室失敗:', error);
    res.status(500).json({ success: false, error: '創建教室失敗' });
  }
});

// 更新教室
router.put('/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: '請輸入教室名稱' });
    }
    const classroom = classroomOperations.update(req.params.id, name.trim(), description);
    res.json({ success: true, classroom });
  } catch (error) {
    console.error('更新教室失敗:', error);
    res.status(500).json({ success: false, error: '更新教室失敗' });
  }
});

// 設定整間教室倒數
router.post('/:id/timer', (req, res) => {
  try {
    const classroom = classroomOperations.getById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, error: '教室不存在' });
    }

    const minutes = Number(req.body.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({ success: false, error: '請輸入有效的倒數分鐘數' });
    }

    const title = typeof req.body.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 40)
      : '課堂倒數';
    const updatedClassroom = classroomOperations.setTimer(req.params.id, title, minutes);

    emitClassroomTimerUpdate(req, updatedClassroom);
    res.json({
      success: true,
      classroom: updatedClassroom,
      timer: formatClassroomTimer(updatedClassroom)
    });
  } catch (error) {
    console.error('設定教室倒數失敗:', error);
    res.status(500).json({ success: false, error: '設定教室倒數失敗' });
  }
});

// 清除整間教室倒數
router.post('/:id/timer/clear', (req, res) => {
  try {
    const classroom = classroomOperations.getById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, error: '教室不存在' });
    }

    const updatedClassroom = classroomOperations.clearTimer(req.params.id);

    emitClassroomTimerUpdate(req, updatedClassroom);
    res.json({
      success: true,
      classroom: updatedClassroom,
      timer: null
    });
  } catch (error) {
    console.error('清除教室倒數失敗:', error);
    res.status(500).json({ success: false, error: '清除教室倒數失敗' });
  }
});

// 刪除教室
router.delete('/:id', (req, res) => {
  try {
    classroomOperations.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('刪除教室失敗:', error);
    res.status(500).json({ success: false, error: '刪除教室失敗' });
  }
});

// 獲取教室的學生列表
router.get('/:id/students', (req, res) => {
  try {
    const students = classroomOperations.getStudents(req.params.id);
    const classroom = classroomOperations.getById(req.params.id);
    const classroomTimer = formatClassroomTimer(classroom);
    
    // 為每個學生添加反饋和提交記錄
    const studentsWithDetails = students.map(s => {
      const feedbacks = feedbackOperations.getByStudent(s.id);
      const submissions = submissionOperations.getByStudent(s.id);
      return {
        id: s.id,
        name: s.name,
        classroomId: s.classroom_id,
        currentCode: s.current_code || '',
        currentLanguage: s.current_language || 'python',
        isOnline: !!s.is_online,
        isPasswordSet: !!s.is_password_set,
        handRaised: !!s.hand_raised,
        handRaisedAt: s.hand_raised_at || null,
        classroomTimer,
        feedbacks: feedbacks.map(f => ({
          id: f.id,
          message: f.message,
          timestamp: f.created_at,
          isRead: !!f.is_read,
          fromTeacher: !!f.from_teacher
        })),
        submissions: submissions.map(sub => ({
          id: sub.id,
          assignmentId: sub.assignment_id,
          code: sub.code,
          language: sub.language,
          status: sub.status,
          submittedAt: sub.created_at
        }))
      };
    });
    
    res.json({ success: true, students: studentsWithDetails });
  } catch (error) {
    console.error('獲取教室學生失敗:', error);
    res.status(500).json({ success: false, error: '獲取教室學生失敗' });
  }
});

// 獲取教室的作業列表
router.get('/:id/assignments', (req, res) => {
  try {
    const assignments = classroomOperations.getAssignments(req.params.id);
    
    // 為每個作業添加提交數
    const assignmentsWithSubmissions = assignments.map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      classroomId: a.classroom_id,
      dueDate: a.due_date,
      isOpen: !!a.is_open,
      createdAt: a.created_at,
      submissionCount: submissionOperations.getByAssignment(a.id).length
    }));
    
    res.json({ success: true, assignments: assignmentsWithSubmissions });
  } catch (error) {
    console.error('獲取教室作業失敗:', error);
    res.status(500).json({ success: false, error: '獲取教室作業失敗' });
  }
});

// 將學生移到教室
router.post('/:id/students/:studentId', (req, res) => {
  try {
    userOperations.updateStudentClassroom(req.params.studentId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('移動學生失敗:', error);
    res.status(500).json({ success: false, error: '移動學生失敗' });
  }
});

export default router;

