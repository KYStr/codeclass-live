import { userOperations, codeOperations, feedbackOperations } from '../database.js';
import { executeCode } from './codeRunner.js';

// 活躍連接追蹤
const activeConnections = new Map();

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`📡 新連接: ${socket.id}`);

    // 老師加入
    socket.on('teacher:join', () => {
      socket.join('teacher');
      console.log(`👨‍🏫 老師已連接: ${socket.id}`);
      
      // 發送當前所有學生狀態
      const students = userOperations.getAllStudents();
      socket.emit('students:sync', students.map(s => ({
        id: s.id,
        name: s.name,
        currentCode: s.current_code || '',
        currentLanguage: s.current_language || 'python',
        isOnline: !!s.is_online,
        handRaised: !!s.hand_raised,
        handRaisedAt: s.hand_raised_at || null
      })));
    });

    // 學生加入
    socket.on('student:join', ({ studentId }) => {
      if (!studentId) return;
      
      socket.join(`student:${studentId}`);
      activeConnections.set(socket.id, studentId);
      
      // 更新在線狀態
      userOperations.setOnlineStatus(studentId, true);
      
      const student = userOperations.getById(studentId);
      if (student?.classroom_id) {
        socket.join(`classroom:${student.classroom_id}`);
      }
      console.log(`👨‍🎓 學生已連接: ${student?.name} (${socket.id})`);
      
      // 通知老師
      io.to('teacher').emit('student:online', {
        studentId,
        name: student?.name
      });
      
      // 發送未讀反饋
      const feedbacks = feedbackOperations.getByStudent(studentId);
      const unread = feedbacks.filter(f => !f.is_read);
      if (unread.length > 0) {
        socket.emit('feedback:unread', unread.map(f => ({
          id: f.id,
          message: f.message,
          timestamp: f.created_at,
          isRead: false,
          fromTeacher: !!f.from_teacher
        })));
      }
    });

    // 學生代碼更新（即時同步）
    socket.on('code:update', ({ studentId, code, language }) => {
      if (!studentId) return;
      
      console.log(`📝 代碼更新: ${studentId.slice(0, 8)}... (${code.length} 字符, ${language})`);
      
      // 保存到數據庫
      codeOperations.updateCode(studentId, code, language);
      userOperations.setOnlineStatus(studentId, true);
      
      // 廣播給老師
      io.to('teacher').emit('student:code-update', {
        studentId,
        code,
        language,
        lastActive: Date.now()
      });
    });

    // 老師發送反饋
    socket.on('feedback:send', ({ studentId, message }) => {
      if (!studentId || !message) return;
      
      // 保存到數據庫
      const feedback = feedbackOperations.create(studentId, message, true);
      
      const formattedFeedback = {
        id: feedback.id,
        message: feedback.message,
        timestamp: feedback.created_at,
        isRead: false,
        fromTeacher: true
      };
      
      // 發送給學生
      io.to(`student:${studentId}`).emit('feedback:new', formattedFeedback);
      
      // 同時更新老師端的學生列表（用於顯示反饋記錄）
      io.to('teacher').emit('feedback:updated', {
        studentId,
        feedback: formattedFeedback
      });
    });

    // 學生發送消息（回覆老師）
    socket.on('student:message', ({ studentId, message }) => {
      if (!studentId || !message) return;
      
      // 保存到數據庫（fromTeacher = false）
      const feedback = feedbackOperations.create(studentId, message, false);
      
      const formattedFeedback = {
        id: feedback.id,
        message: feedback.message,
        timestamp: feedback.created_at,
        isRead: true, // 學生自己發的，已讀
        fromTeacher: false
      };
      
      // 不發送給學生自己（前端已經樂觀更新了）
      // 只通知老師有新消息
      io.to('teacher').emit('student:message:new', {
        studentId,
        feedback: formattedFeedback
      });
    });

    // 清空對話
    socket.on('feedback:clear', ({ studentId }) => {
      if (!studentId) return;
      
      // 從數據庫刪除所有反饋
      feedbackOperations.clearByStudent(studentId);
      
      // 通知學生對話已清空
      io.to(`student:${studentId}`).emit('feedback:cleared', { studentId });
      
      // 通知老師對話已清空
      io.to('teacher').emit('feedback:cleared', { studentId });
      
      console.log(`🗑️ 清空對話: ${studentId}`);
    });

    // 代碼執行請求（支持輸入）
    socket.on('code:execute', async ({ studentId, code, language, stdin }) => {
      console.log(`🔄 執行代碼請求: ${language}`);
      
      try {
        const result = await executeCode(code, language, stdin);
        
        socket.emit('code:result', {
          success: !result.error,
          output: result.output,
          error: result.error,
          executionTime: result.executionTime
        });
        
        // 如果是學生執行，也通知老師
        if (studentId) {
          io.to('teacher').emit('student:code-executed', {
            studentId,
            code,
            language,
            result
          });
        }
      } catch (error) {
        socket.emit('code:result', {
          success: false,
          error: error.message || '執行失敗'
        });
      }
    });

    // 斷開連接
    socket.on('disconnect', () => {
      const studentId = activeConnections.get(socket.id);
      
      if (studentId) {
        userOperations.setOnlineStatus(studentId, false);
        activeConnections.delete(socket.id);
        
        const student = userOperations.getById(studentId);
        console.log(`👋 學生已離線: ${student?.name}`);
        
        // 通知老師
        io.to('teacher').emit('student:offline', { studentId });
      }
      
      console.log(`❌ 連接斷開: ${socket.id}`);
    });

    // 心跳檢測
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });
}
