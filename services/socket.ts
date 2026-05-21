import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Socket 撖虫?
let socket: Socket | null = null;
let currentJoin:
  | { role: 'teacher' }
  | { role: 'student'; studentId: string }
  | null = null;

// 鈭辣?矽憿?
type EventCallback = (...args: any[]) => void;

// 鈭辣???典???
const listeners: Map<string, Set<EventCallback>> = new Map();

// ?脣??撱?Socket ??
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // ??鈭辣
    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
      if (currentJoin?.role === 'teacher') {
        socket?.emit('teacher:join');
      } else if (currentJoin?.role === 'student') {
        socket?.emit('student:join', { studentId: currentJoin.studentId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('??Socket ?琿?:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('?? Socket ???航炊:', error.message);
    });
  }

  return socket;
}

// ?? Socket
export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

// ?琿? Socket
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
    currentJoin = null;
  }
}

// ?葦?
export function teacherJoin(): void {
  const s = getSocket();
  currentJoin = { role: 'teacher' };
  if (s.connected) s.emit('teacher:join');
}

// 摮貊??
export function studentJoin(studentId: string): void {
  const s = getSocket();
  currentJoin = { role: 'student', studentId };
  if (s.connected) s.emit('student:join', { studentId });
}

// ?潮誨蝣潭??
export function emitCodeUpdate(studentId: string, code: string, language: string): void {
  const s = getSocket();
  s.emit('code:update', { studentId, code, language });
}

// ?潮?擖?
export function emitFeedback(studentId: string, message: string): void {
  const s = getSocket();
  s.emit('feedback:send', { studentId, message });
}

// ?瑁?隞?Ⅳ嚗?撓?伐?
export function emitCodeExecute(studentId: string | null, code: string, language: string, stdin: string = ''): void {
  const s = getSocket();
  s.emit('code:execute', { studentId, code, language, stdin });
}

// 摮貊??潮???
export function emitStudentMessage(studentId: string, message: string): void {
  const s = getSocket();
  s.emit('student:message', { studentId, message });
}

// 皜征撠店
export function emitClearFeedback(studentId: string): void {
  const s = getSocket();
  s.emit('feedback:clear', { studentId });
}

// 閮鈭辣
export function onSocketEvent(event: string, callback: EventCallback): () => void {
  const s = getSocket();
  
  // 瘛餃??啁?賢??
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(callback);
  
  // 閮餃???Socket
  s.on(event, callback);
  
  // 餈???閮?賣
  return () => {
    s.off(event, callback);
    listeners.get(event)?.delete(callback);
  };
}

// ==================== ??蝢拐?隞園???====================

// 摮貊?隞?Ⅳ?湔鈭辣
export interface StudentCodeUpdateEvent {
  studentId: string;
  code: string;
  language: string;
  lastActive: number;
}

// 摮貊??函?/?Ｙ?鈭辣
export interface StudentOnlineEvent {
  studentId: string;
  name?: string;
}

export interface StudentHelpRequestEvent {
  studentId: string;
  studentName: string;
  handRaised: boolean;
  handRaisedAt: number | null;
}

export interface ClassroomTimerEvent {
  classroomId: string;
  timer: {
    classroomId: string;
    title: string;
    startedAt: number | null;
    endsAt: number | null;
    isActive: boolean;
  } | null;
}

export interface ClassroomNotesUpdatedEvent {
  classroomId: string;
}

// ??鈭辣
export interface FeedbackEvent {
  id: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  fromTeacher: boolean;
}

// 隞?Ⅳ?瑁?蝯?鈭辣
export interface CodeResultEvent {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

// ?漱鈭辣
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

// 摮貊??郊鈭辣
export interface StudentSyncEvent {
  id: string;
  name: string;
  currentCode: string;
  currentLanguage: string;
  isOnline: boolean;
  handRaised?: boolean;
  handRaisedAt?: number | null;
}

// ==================== 靘踵閮?賣 ====================

export function onStudentCodeUpdate(callback: (data: StudentCodeUpdateEvent) => void): () => void {
  return onSocketEvent('student:code-update', callback);
}

export function onStudentOnline(callback: (data: StudentOnlineEvent) => void): () => void {
  return onSocketEvent('student:online', callback);
}

export function onStudentOffline(callback: (data: StudentOnlineEvent) => void): () => void {
  return onSocketEvent('student:offline', callback);
}

export function onStudentHelpRequest(callback: (data: StudentHelpRequestEvent) => void): () => void {
  return onSocketEvent('student:help-request', callback);
}

export function onStudentHelpCleared(callback: (data: StudentHelpRequestEvent) => void): () => void {
  return onSocketEvent('student:help-cleared', callback);
}

export function onStudentHelpStatus(callback: (data: StudentHelpRequestEvent) => void): () => void {
  return onSocketEvent('student:help-status', callback);
}

export function onClassroomTimerUpdated(callback: (data: ClassroomTimerEvent) => void): () => void {
  return onSocketEvent('classroom:timer-updated', callback);
}

export function onClassroomNotesUpdated(callback: (data: ClassroomNotesUpdatedEvent) => void): () => void {
  return onSocketEvent('classroom:notes-updated', callback);
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

export function onAssignmentUpdated(callback: (data: any) => void): () => void {
  return onSocketEvent('assignment:updated', callback);
}

export function onFeedbackUpdated(callback: (data: { studentId: string; feedback: FeedbackEvent }) => void): () => void {
  return onSocketEvent('feedback:updated', callback);
}

export function onStudentMessageNew(callback: (data: { studentId: string; feedback: FeedbackEvent }) => void): () => void {
  return onSocketEvent('student:message:new', callback);
}

// 撠店皜征鈭辣
export function onFeedbackCleared(callback: (data: { studentId: string }) => void): () => void {
  return onSocketEvent('feedback:cleared', callback);
}

