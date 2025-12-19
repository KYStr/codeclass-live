import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Socket 實例
let socket: Socket | null = null;

// 事件回調類型
type EventCallback = (...args: any[]) => void;

// 事件監聽器存儲
const listeners: Map<string, Set<EventCallback>> = new Map();

// 獲取或創建 Socket 連接
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // 連接事件
    socket.on('connect', () => {
      console.log('🔌 Socket 已連接:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket 斷開:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('⚠️ Socket 連接錯誤:', error.message);
    });
  }

  return socket;
}

// 連接 Socket
export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

// 斷開 Socket
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
  }
}

// 老師加入
export function teacherJoin(): void {
  const s = getSocket();
  s.emit('teacher:join');
}

// 學生加入
export function studentJoin(studentId: string): void {
  const s = getSocket();
  s.emit('student:join', { studentId });
}

// 發送代碼更新
export function emitCodeUpdate(studentId: string, code: string, language: string): void {
  const s = getSocket();
  s.emit('code:update', { studentId, code, language });
}

// 發送反饋
export function emitFeedback(studentId: string, message: string): void {
  const s = getSocket();
  s.emit('feedback:send', { studentId, message });
}

// 執行代碼（支持輸入）
export function emitCodeExecute(studentId: string | null, code: string, language: string, stdin: string = ''): void {
  const s = getSocket();
  s.emit('code:execute', { studentId, code, language, stdin });
}

// 學生發送消息
export function emitStudentMessage(studentId: string, message: string): void {
  const s = getSocket();
  s.emit('student:message', { studentId, message });
}

// 清空對話
export function emitClearFeedback(studentId: string): void {
  const s = getSocket();
  s.emit('feedback:clear', { studentId });
}

// 訂閱事件
export function onSocketEvent(event: string, callback: EventCallback): () => void {
  const s = getSocket();
  
  // 添加到監聽器集合
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(callback);
  
  // 註冊到 Socket
  s.on(event, callback);
  
  // 返回取消訂閱函數
  return () => {
    s.off(event, callback);
    listeners.get(event)?.delete(callback);
  };
}

// ==================== 預定義事件類型 ====================

// 學生代碼更新事件
export interface StudentCodeUpdateEvent {
  studentId: string;
  code: string;
  language: string;
  lastActive: number;
}

// 學生在線/離線事件
export interface StudentOnlineEvent {
  studentId: string;
  name?: string;
}

// 反饋事件
export interface FeedbackEvent {
  id: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  fromTeacher: boolean;
}

// 代碼執行結果事件
export interface CodeResultEvent {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

// 提交事件
export interface SubmissionEvent {
  studentId: string;
  studentName: string;
  submission: {
    id: string;
    assignmentId: string;
    code: string;
    language: string;
    timestamp: number;
    status: string;
  };
}

// 學生同步事件
export interface StudentSyncEvent {
  id: string;
  name: string;
  currentCode: string;
  currentLanguage: string;
  isOnline: boolean;
}

// ==================== 便捷訂閱函數 ====================

export function onStudentCodeUpdate(callback: (data: StudentCodeUpdateEvent) => void): () => void {
  return onSocketEvent('student:code-update', callback);
}

export function onStudentOnline(callback: (data: StudentOnlineEvent) => void): () => void {
  return onSocketEvent('student:online', callback);
}

export function onStudentOffline(callback: (data: StudentOnlineEvent) => void): () => void {
  return onSocketEvent('student:offline', callback);
}

export function onNewFeedback(callback: (data: FeedbackEvent) => void): () => void {
  return onSocketEvent('feedback:new', callback);
}

export function onUnreadFeedback(callback: (data: FeedbackEvent[]) => void): () => void {
  return onSocketEvent('feedback:unread', callback);
}

export function onCodeResult(callback: (data: CodeResultEvent) => void): () => void {
  return onSocketEvent('code:result', callback);
}

export function onNewSubmission(callback: (data: SubmissionEvent) => void): () => void {
  return onSocketEvent('submission:new', callback);
}

export function onStudentsSync(callback: (data: StudentSyncEvent[]) => void): () => void {
  return onSocketEvent('students:sync', callback);
}

export function onStudentCreated(callback: (data: { id: string; name: string }) => void): () => void {
  return onSocketEvent('student:created', callback);
}

export function onStudentDeleted(callback: (data: { studentId: string }) => void): () => void {
  return onSocketEvent('student:deleted', callback);
}

export function onAssignmentCreated(callback: (data: any) => void): () => void {
  return onSocketEvent('assignment:created', callback);
}

export function onAssignmentToggled(callback: (data: { assignmentId: string }) => void): () => void {
  return onSocketEvent('assignment:toggled', callback);
}

export function onAssignmentDeleted(callback: (data: { assignmentId: string }) => void): () => void {
  return onSocketEvent('assignment:deleted', callback);
}

export function onFeedbackUpdated(callback: (data: { studentId: string; feedback: FeedbackEvent }) => void): () => void {
  return onSocketEvent('feedback:updated', callback);
}

export function onStudentMessageNew(callback: (data: { studentId: string; feedback: FeedbackEvent }) => void): () => void {
  return onSocketEvent('student:message:new', callback);
}

// 對話清空事件
export function onFeedbackCleared(callback: (data: { studentId: string }) => void): () => void {
  return onSocketEvent('feedback:cleared', callback);
}

