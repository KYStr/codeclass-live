// API 基础配置
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// 通用请求函数
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || '請求失敗');
  }
  
  return data;
}

// ==================== 認證 API ====================

export const authApi = {
  // 獲取學生列表（用於登入選擇）
  getStudentList: () => 
    request<{ id: string; name: string; classroomId?: string; isPasswordSet: boolean; isOnline: boolean }[]>('/auth/students'),
  
  // 老師登入
  teacherLogin: (password: string) =>
    request<{ success: boolean; user: { id: string; name: string; role: string } }>('/auth/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  
  // 老師登出
  teacherLogout: () =>
    request<{ success: boolean }>('/auth/teacher/logout', { method: 'POST' }),
  
  // 老師修改密碼
  teacherChangePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/teacher/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  
  // 檢查學生是否需要設置密碼
  checkStudent: (studentId: string) =>
    request<{ studentId: string; name: string; needsPassword: boolean }>('/auth/student/check', {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    }),
  
  // 學生設置密碼（首次）
  studentSetPassword: (studentId: string, password: string) =>
    request<{ success: boolean; user: { id: string; name: string; role: string } }>('/auth/student/set-password', {
      method: 'POST',
      body: JSON.stringify({ studentId, password }),
    }),
  
  // 學生登入
  studentLogin: (studentId: string, password: string) =>
    request<{ success: boolean; user: { id: string; name: string; role: string } }>('/auth/student/login', {
      method: 'POST',
      body: JSON.stringify({ studentId, password }),
    }),
  
  // 學生登出
  studentLogout: (studentId: string) =>
    request<{ success: boolean }>('/auth/student/logout', {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    }),
};

// ==================== 學生 API ====================

export interface StudentData {
  id: string;
  name: string;
  classroomId?: string;
  currentCode: string;
  currentLanguage: string;
  isOnline: boolean;
  isPasswordSet: boolean;
  lastActive: number;
  feedbacks: {
    id: string;
    message: string;
    timestamp: number;
    isRead: boolean;
    fromTeacher: boolean;
  }[];
  submissions: {
    id: string;
    assignmentId: string;
    code: string;
    language: string;
    timestamp: number;
    status: string;
  }[];
}

export const studentApi = {
  // 獲取所有學生
  getAll: () => request<StudentData[]>('/students'),
  
  // 獲取單個學生
  getById: (id: string) => request<StudentData>(`/students/${id}`),
  
  // 創建學生
  create: (name: string, classroomId?: string) =>
    request<StudentData>('/students', {
      method: 'POST',
      body: JSON.stringify({ name, classroomId }),
    }),
  
  // 更新學生所屬教室
  updateClassroom: (id: string, classroomId: string) =>
    request<{ success: boolean }>(`/students/${id}/classroom`, {
      method: 'PUT',
      body: JSON.stringify({ classroomId }),
    }),
  
  // 刪除學生
  delete: (id: string) =>
    request<{ success: boolean }>(`/students/${id}`, { method: 'DELETE' }),
  
  // 重置學生密碼
  resetPassword: (id: string) =>
    request<{ success: boolean; message: string }>(`/students/${id}/reset-password`, { method: 'POST' }),
  
  // 發送反饋
  sendFeedback: (id: string, message: string) =>
    request<{ id: string; message: string; timestamp: number }>(`/students/${id}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  
  // 更新代碼
  updateCode: (id: string, code: string, language: string) =>
    request<{ success: boolean }>(`/students/${id}/code`, {
      method: 'PUT',
      body: JSON.stringify({ code, language }),
    }),
  
  // 提交作業
  submitAssignment: (id: string, assignmentId: string, code: string, language: string) =>
    request<{ id: string; assignmentId: string; code: string; timestamp: number }>(`/students/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ assignmentId, code, language }),
    }),
  
  // 標記反饋已讀
  markFeedbackRead: (id: string) =>
    request<{ success: boolean }>(`/students/${id}/feedback/read`, { method: 'POST' }),
};

// ==================== 作業 API ====================

export interface AssignmentData {
  id: string;
  title: string;
  description: string;
  classroomId?: string;
  dueDate: number | null;
  isOpen: boolean;
  createdAt: number;
  submissionCount: number;
  totalStudents: number;
  submitters: {
    studentId: string;
    studentName: string;
    submittedAt: number;
  }[];
}

export const assignmentApi = {
  // 獲取所有作業
  getAll: (classroomId?: string) => 
    request<AssignmentData[]>(`/assignments${classroomId ? `?classroomId=${classroomId}` : ''}`),
  
  // 創建作業
  create: (title: string, description: string, dueDate?: number, classroomId?: string) =>
    request<AssignmentData>('/assignments', {
      method: 'POST',
      body: JSON.stringify({ title, description, dueDate, classroomId }),
    }),
  
  // 切換作業開放狀態
  toggle: (id: string) =>
    request<{ success: boolean }>(`/assignments/${id}/toggle`, { method: 'POST' }),
  
  // 刪除作業
  delete: (id: string) =>
    request<{ success: boolean }>(`/assignments/${id}`, { method: 'DELETE' }),
  
  // 獲取作業提交
  getSubmissions: (id: string) =>
    request<{ id: string; studentId: string; studentName: string; code: string; language: string; timestamp: number }[]>(
      `/assignments/${id}/submissions`
    ),
};

// ==================== 教室 API ====================

export interface ClassroomData {
  id: string;
  name: string;
  description: string;
  created_at: number;
  studentCount: number;
  assignmentCount: number;
}

export const classroomApi = {
  // 獲取所有教室
  getAll: () => request<{ success: boolean; classrooms: ClassroomData[] }>('/classrooms'),
  
  // 獲取單個教室
  getById: (id: string) => request<{ success: boolean; classroom: ClassroomData }>(`/classrooms/${id}`),
  
  // 創建教室
  create: (name: string, description?: string) =>
    request<{ success: boolean; classroom: ClassroomData }>('/classrooms', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  
  // 更新教室
  update: (id: string, name: string, description?: string) =>
    request<{ success: boolean; classroom: ClassroomData }>(`/classrooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    }),
  
  // 刪除教室
  delete: (id: string) =>
    request<{ success: boolean }>(`/classrooms/${id}`, { method: 'DELETE' }),
  
  // 獲取教室學生
  getStudents: (id: string) =>
    request<{ success: boolean; students: StudentData[] }>(`/classrooms/${id}/students`),
  
  // 獲取教室作業
  getAssignments: (id: string) =>
    request<{ success: boolean; assignments: AssignmentData[] }>(`/classrooms/${id}/assignments`),
  
  // 將學生移到教室
  moveStudent: (classroomId: string, studentId: string) =>
    request<{ success: boolean }>(`/classrooms/${classroomId}/students/${studentId}`, { method: 'POST' }),
};

// ==================== 健康檢查 ====================

export const healthCheck = () => request<{ status: string; timestamp: number }>('/health');

