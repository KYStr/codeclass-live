export enum Language {
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  JAVA = 'java',
  CPP = 'cpp'
}

export interface Feedback {
  id: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  fromTeacher: boolean;
}

export interface Submission {
  assignmentId: string;
  code: string;
  timestamp: number;
  status: 'submitted' | 'graded';
  language: Language;
}

export interface Student {
  id: string;
  name: string;
  currentCode: string;
  currentLanguage: Language;
  feedbacks: Feedback[];
  submissions: Submission[];
  lastActive: number;
  isOnline?: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  dueDate?: number;      // 截止日期 (可选)
  isOpen: boolean;       // 是否开放提交
}

export interface AppState {
  students: Student[];
  assignments: Assignment[];
}

// 本地存储键名
export const STORAGE_KEY = 'codeclass_state';

// 创建新学生的工厂函数
export const createNewStudent = (name: string): Student => ({
  id: crypto.randomUUID(),
  name,
  currentCode: `# ${name} 的程式碼\n# 請在這裡開始編寫...\n\nprint("Hello, World!")`,
  currentLanguage: Language.PYTHON,
  feedbacks: [],
  submissions: [],
  lastActive: Date.now(),
  isOnline: false,
});

// 创建新作业的工厂函数
export const createNewAssignment = (title: string, description: string, dueDate?: number): Assignment => ({
  id: crypto.randomUUID(),
  title,
  description,
  createdAt: Date.now(),
  dueDate,
  isOpen: true,
});
