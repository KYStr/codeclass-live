import React, { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StudentData, AssignmentData, ProjectData, ProjectFolderData, AiTutorMessageData, ClassroomNoteData, ClassroomNoteFolderData, studentApi, classroomApi } from '../services/api';
import { emitCodeUpdate, emitCodeExecute, emitStudentMessage, onCodeResult, onClassroomNotesUpdated } from '../services/socket';
import CodeEditor, { type CodeEditorThemeKey } from './CodeEditor';
import {
  MessageSquare,
  Send,
  CheckCircle,
  Bot,
  BrainCircuit,
  Clock,
  AlertCircle,
  Bell,
  X,
  Calendar,
  Play,
  Terminal,
  Loader2,
  Keyboard,
  User,
  Users,
  Folder,
  Save,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FileCode,
  FileText,
  BookOpen,
  LogOut,
  Upload
} from 'lucide-react';

interface StudentDashboardProps {
  student: StudentData;
  assignments: AssignmentData[];
  onUpdateStudent: (updatedStudent: StudentData) => void;
  onLogout?: () => void;
}

interface ProjectFolderNode extends ProjectFolderData {
  children: ProjectFolderNode[];
  projects: ProjectData[];
}

interface ClassroomNoteFolderNode extends ClassroomNoteFolderData {
  children: ClassroomNoteFolderNode[];
  notes: ClassroomNoteData[];
}

function normalizeMarkdownTables(markdown: string) {
  let inCodeFence = false;

  return markdown
    .split('\n')
    .map(line => {
      if (/^\s*```/.test(line)) {
        inCodeFence = !inCodeFence;
        return line;
      }

      if (inCodeFence || !line.includes('|') || !/\|\s*:?-{3,}:?\s*\|/.test(line)) {
        return line;
      }

      return line.replace(/\|\s+\|/g, '|\n|');
    })
    .join('\n');
}

type StudentThemeKey = 'vscode-dark' | 'vscode-light' | 'monokai' | 'solarized-light' | 'dracula';

interface StudentThemeConfig {
  label: string;
  editorTheme: CodeEditorThemeKey;
  vars: Record<string, string>;
}

const STUDENT_THEME_STORAGE_KEY = 'codeclass.studentTheme';

const studentThemeConfigs: Record<StudentThemeKey, StudentThemeConfig> = {
  'vscode-dark': {
    label: 'VS Code Dark',
    editorTheme: 'codeclass-vscode-dark',
    vars: {
      '--cc-page': '#1e1e1e',
      '--cc-sidebar': '#252526',
      '--cc-surface': '#2d2d30',
      '--cc-surface-soft': 'rgba(45, 45, 48, 0.72)',
      '--cc-elevated': 'rgba(37, 37, 38, 0.96)',
      '--cc-border': '#3e3e42',
      '--cc-border-strong': '#52525b',
      '--cc-text': '#f3f4f6',
      '--cc-muted': '#9ca3af',
      '--cc-subtle': '#6b7280',
      '--cc-hover': '#3a3d41',
      '--cc-accent': '#007acc',
      '--cc-accent-hover': '#0067ad',
      '--cc-accent-soft': 'rgba(0, 122, 204, 0.22)',
      '--cc-accent-text': '#7dd3fc',
      '--cc-ai': '#8b5cf6',
      '--cc-success': '#16a34a',
      '--cc-warning': '#ca8a04',
      '--cc-danger': '#dc2626',
      '--cc-on-accent': '#ffffff',
      '--cc-code-bg': '#111827',
      '--cc-code-inline-bg': '#1f2937',
      '--cc-code-text': '#e5e7eb',
      '--cc-code-border': '#374151',
      '--cc-table-head': '#1f2937',
      '--cc-table-bg': 'rgba(17, 24, 39, 0.38)',
    },
  },
  'vscode-light': {
    label: 'VS Code Light',
    editorTheme: 'codeclass-vscode-light',
    vars: {
      '--cc-page': '#ffffff',
      '--cc-sidebar': '#f3f3f3',
      '--cc-surface': '#f6f8fa',
      '--cc-surface-soft': 'rgba(246, 248, 250, 0.86)',
      '--cc-elevated': 'rgba(255, 255, 255, 0.97)',
      '--cc-border': '#d0d7de',
      '--cc-border-strong': '#afb8c1',
      '--cc-text': '#24292f',
      '--cc-muted': '#57606a',
      '--cc-subtle': '#6e7781',
      '--cc-hover': '#eaeef2',
      '--cc-accent': '#0969da',
      '--cc-accent-hover': '#0757b8',
      '--cc-accent-soft': 'rgba(9, 105, 218, 0.12)',
      '--cc-accent-text': '#0969da',
      '--cc-ai': '#8250df',
      '--cc-success': '#1a7f37',
      '--cc-warning': '#9a6700',
      '--cc-danger': '#cf222e',
      '--cc-on-accent': '#ffffff',
      '--cc-code-bg': '#f6f8fa',
      '--cc-code-inline-bg': '#eaeef2',
      '--cc-code-text': '#24292f',
      '--cc-code-border': '#d0d7de',
      '--cc-table-head': '#eaeef2',
      '--cc-table-bg': '#ffffff',
    },
  },
  monokai: {
    label: 'Monokai',
    editorTheme: 'codeclass-monokai',
    vars: {
      '--cc-page': '#272822',
      '--cc-sidebar': '#1f201b',
      '--cc-surface': '#34352d',
      '--cc-surface-soft': 'rgba(52, 53, 45, 0.76)',
      '--cc-elevated': 'rgba(31, 32, 27, 0.96)',
      '--cc-border': '#49483e',
      '--cc-border-strong': '#69685a',
      '--cc-text': '#f8f8f2',
      '--cc-muted': '#c2c2b0',
      '--cc-subtle': '#a6a69b',
      '--cc-hover': '#3e3d32',
      '--cc-accent': '#a6e22e',
      '--cc-accent-hover': '#8ccf23',
      '--cc-accent-soft': 'rgba(166, 226, 46, 0.18)',
      '--cc-accent-text': '#a6e22e',
      '--cc-ai': '#ae81ff',
      '--cc-success': '#a6e22e',
      '--cc-warning': '#e6db74',
      '--cc-danger': '#f92672',
      '--cc-on-accent': '#1f201b',
      '--cc-code-bg': '#1f201b',
      '--cc-code-inline-bg': '#3e3d32',
      '--cc-code-text': '#f8f8f2',
      '--cc-code-border': '#69685a',
      '--cc-table-head': '#3e3d32',
      '--cc-table-bg': '#272822',
    },
  },
  'solarized-light': {
    label: 'Solarized Light',
    editorTheme: 'codeclass-solarized-light',
    vars: {
      '--cc-page': '#fdf6e3',
      '--cc-sidebar': '#eee8d5',
      '--cc-surface': '#f7f0d7',
      '--cc-surface-soft': 'rgba(247, 240, 215, 0.86)',
      '--cc-elevated': 'rgba(253, 246, 227, 0.97)',
      '--cc-border': '#d6cfb7',
      '--cc-border-strong': '#bdb69e',
      '--cc-text': '#586e75',
      '--cc-muted': '#657b83',
      '--cc-subtle': '#839496',
      '--cc-hover': '#eee8d5',
      '--cc-accent': '#268bd2',
      '--cc-accent-hover': '#1f75b5',
      '--cc-accent-soft': 'rgba(38, 139, 210, 0.16)',
      '--cc-accent-text': '#268bd2',
      '--cc-ai': '#6c71c4',
      '--cc-success': '#859900',
      '--cc-warning': '#b58900',
      '--cc-danger': '#dc322f',
      '--cc-on-accent': '#ffffff',
      '--cc-code-bg': '#eee8d5',
      '--cc-code-inline-bg': '#e1dac4',
      '--cc-code-text': '#586e75',
      '--cc-code-border': '#d6cfb7',
      '--cc-table-head': '#eee8d5',
      '--cc-table-bg': '#fdf6e3',
    },
  },
  dracula: {
    label: 'Dracula',
    editorTheme: 'codeclass-dracula',
    vars: {
      '--cc-page': '#282a36',
      '--cc-sidebar': '#21222c',
      '--cc-surface': '#343746',
      '--cc-surface-soft': 'rgba(52, 55, 70, 0.78)',
      '--cc-elevated': 'rgba(33, 34, 44, 0.96)',
      '--cc-border': '#44475a',
      '--cc-border-strong': '#5b6078',
      '--cc-text': '#f8f8f2',
      '--cc-muted': '#c7c9d9',
      '--cc-subtle': '#9aa0c7',
      '--cc-hover': '#44475a',
      '--cc-accent': '#8be9fd',
      '--cc-accent-hover': '#68d8f0',
      '--cc-accent-soft': 'rgba(139, 233, 253, 0.16)',
      '--cc-accent-text': '#8be9fd',
      '--cc-ai': '#bd93f9',
      '--cc-success': '#50fa7b',
      '--cc-warning': '#f1fa8c',
      '--cc-danger': '#ff5555',
      '--cc-on-accent': '#282a36',
      '--cc-code-bg': '#21222c',
      '--cc-code-inline-bg': '#44475a',
      '--cc-code-text': '#f8f8f2',
      '--cc-code-border': '#5b6078',
      '--cc-table-head': '#343746',
      '--cc-table-bg': '#282a36',
    },
  },
};

const studentThemeCss = `
.student-theme { background: var(--cc-page); color: var(--cc-text); }
.student-theme .bg-gray-900, .student-theme .bg-\\[\\#1e1e1e\\], .student-theme .bg-gray-950 { background-color: var(--cc-page) !important; }
.student-theme .bg-gray-800, .student-theme .bg-\\[\\#252526\\] { background-color: var(--cc-sidebar) !important; }
.student-theme .bg-gray-700, .student-theme .bg-gray-700\\/20, .student-theme .bg-gray-700\\/30, .student-theme .bg-gray-800\\/50, .student-theme .bg-gray-800\\/80, .student-theme .bg-gray-900\\/50, .student-theme .bg-gray-900\\/60 { background-color: var(--cc-surface-soft) !important; }
.student-theme .bg-gray-800\\/95 { background-color: var(--cc-elevated) !important; }
.student-theme .hover\\:bg-gray-700:hover, .student-theme .hover\\:bg-gray-700\\/50:hover, .student-theme .hover\\:bg-gray-700\\/60:hover, .student-theme .hover\\:bg-gray-600:hover { background-color: var(--cc-hover) !important; }
.student-theme .border-gray-700, .student-theme .border-gray-600, .student-theme .border-gray-500 { border-color: var(--cc-border) !important; }
.student-theme .text-white, .student-theme .text-gray-100, .student-theme .text-gray-200, .student-theme .text-gray-300 { color: var(--cc-text) !important; }
.student-theme .text-gray-400, .student-theme .text-gray-500, .student-theme .text-gray-600 { color: var(--cc-muted) !important; }
.student-theme select, .student-theme input, .student-theme textarea { background-color: var(--cc-surface) !important; border-color: var(--cc-border) !important; color: var(--cc-text) !important; }
.student-theme select option { background-color: var(--cc-surface); color: var(--cc-text); }
.student-theme .bg-cyan-700, .student-theme .bg-blue-600, .student-theme .bg-purple-600 { background-color: var(--cc-accent) !important; color: var(--cc-on-accent) !important; }
.student-theme .hover\\:bg-cyan-800:hover, .student-theme .hover\\:bg-blue-700:hover, .student-theme .hover\\:bg-purple-700:hover { background-color: var(--cc-accent-hover) !important; color: var(--cc-on-accent) !important; }
.student-theme .bg-cyan-900\\/30, .student-theme .bg-blue-900\\/30, .student-theme .bg-blue-900\\/40, .student-theme .bg-purple-900\\/25, .student-theme .bg-purple-900\\/30 { background-color: var(--cc-accent-soft) !important; }
.student-theme .text-cyan-100, .student-theme .text-cyan-200, .student-theme .text-cyan-300, .student-theme .text-blue-300, .student-theme .text-blue-400, .student-theme .text-purple-100, .student-theme .text-purple-200, .student-theme .text-purple-300, .student-theme .text-purple-400 { color: var(--cc-accent-text) !important; }
.student-theme .border-cyan-500, .student-theme .border-blue-500, .student-theme .border-purple-500\\/40, .student-theme .border-purple-500\\/50, .student-theme .border-blue-500\\/50 { border-color: var(--cc-accent) !important; }
.student-theme .bg-green-600, .student-theme .bg-green-500 { background-color: var(--cc-success) !important; color: var(--cc-on-accent) !important; }
.student-theme .text-green-400, .student-theme .text-green-500 { color: var(--cc-success) !important; }
.student-theme .bg-yellow-600, .student-theme .bg-yellow-900\\/20 { background-color: color-mix(in srgb, var(--cc-warning) 22%, transparent) !important; }
.student-theme .text-yellow-100, .student-theme .text-yellow-300, .student-theme .text-yellow-400 { color: var(--cc-warning) !important; }
.student-theme .bg-red-600\\/20, .student-theme .bg-red-900\\/30, .student-theme .hover\\:bg-red-900\\/40:hover { background-color: color-mix(in srgb, var(--cc-danger) 22%, transparent) !important; }
.student-theme .text-red-100, .student-theme .text-red-200, .student-theme .text-red-400, .student-theme .hover\\:text-red-400:hover, .student-theme .hover\\:text-red-200:hover { color: var(--cc-danger) !important; }
.student-theme .border-yellow-700\\/50 { border-color: var(--cc-warning) !important; }
.student-theme .border-red-700\\/50 { border-color: var(--cc-danger) !important; }
.student-theme .border-cyan-500\\/40 { border-color: var(--cc-accent) !important; }
.student-theme .shadow-2xl { box-shadow: 0 18px 48px color-mix(in srgb, var(--cc-page) 72%, black) !important; }
.student-theme .ai-markdown { color: var(--cc-text); }
.student-theme .ai-markdown code { background-color: var(--cc-code-inline-bg) !important; color: var(--cc-code-text) !important; border: 1px solid var(--cc-code-border); }
.student-theme .ai-markdown pre { background-color: var(--cc-code-bg) !important; color: var(--cc-code-text) !important; border: 1px solid var(--cc-code-border); }
.student-theme .ai-markdown pre code { background-color: transparent !important; color: inherit !important; border: 0 !important; padding: 0 !important; }
.student-theme .ai-markdown table { background-color: var(--cc-table-bg); color: var(--cc-text); }
.student-theme .ai-markdown thead { background-color: var(--cc-table-head) !important; color: var(--cc-text) !important; }
.student-theme .ai-markdown th, .student-theme .ai-markdown td { border-color: var(--cc-code-border) !important; color: var(--cc-text) !important; }
`;

// ?脫??賣
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function buildProjectTree(folders: ProjectFolderData[], projects: ProjectData[]) {
  const nodeMap = new Map<string, ProjectFolderNode>();
  folders.forEach(folder => {
    nodeMap.set(folder.id, { ...folder, children: [], projects: [] });
  });

  const rootFolders: ProjectFolderNode[] = [];
  nodeMap.forEach(node => {
    const parent = node.parentId ? nodeMap.get(node.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      rootFolders.push(node);
    }
  });

  const rootProjects: ProjectData[] = [];
  projects.forEach(project => {
    const folder = project.folderId ? nodeMap.get(project.folderId) : null;
    if (folder) {
      folder.projects.push(project);
    } else {
      rootProjects.push(project);
    }
  });

  const sortNode = (node: ProjectFolderNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    node.projects.sort((a, b) => b.updatedAt - a.updatedAt);
    node.children.forEach(sortNode);
  };

  rootFolders.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  rootFolders.forEach(sortNode);
  rootProjects.sort((a, b) => b.updatedAt - a.updatedAt);

  return { rootFolders, rootProjects };
}

function buildClassroomNoteTree(folders: ClassroomNoteFolderData[], notes: ClassroomNoteData[]) {
  const nodeMap = new Map<string, ClassroomNoteFolderNode>();
  folders.forEach(folder => {
    nodeMap.set(folder.id, { ...folder, children: [], notes: [] });
  });

  const rootFolders: ClassroomNoteFolderNode[] = [];
  nodeMap.forEach(node => {
    const parent = node.parentId ? nodeMap.get(node.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      rootFolders.push(node);
    }
  });

  const rootNotes: ClassroomNoteData[] = [];
  notes.forEach(note => {
    const folder = note.folderId ? nodeMap.get(note.folderId) : null;
    if (folder) {
      folder.notes.push(note);
    } else {
      rootNotes.push(note);
    }
  });

  const sortNode = (node: ClassroomNoteFolderNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    node.notes.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
    node.children.forEach(sortNode);
  };

  rootFolders.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  rootFolders.forEach(sortNode);
  rootNotes.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));

  return { rootNoteFolders: rootFolders, rootNotes };
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, assignments, onUpdateStudent, onLogout }) => {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(true);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [hasNewFeedback, setHasNewFeedback] = useState(false);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [projectFolders, setProjectFolders] = useState<ProjectFolderData[]>([]);
  const [classroomNotes, setClassroomNotes] = useState<ClassroomNoteData[]>([]);
  const [classroomNoteFolders, setClassroomNoteFolders] = useState<ClassroomNoteFolderData[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [collapsedNoteFolderIds, setCollapsedNoteFolderIds] = useState<Set<string>>(new Set());
  const [isRootCollapsed, setIsRootCollapsed] = useState(false);
  const [isNotesRootCollapsed, setIsNotesRootCollapsed] = useState(false);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverAssignmentId, setDragOverAssignmentId] = useState<string | null>(null);
  const [collapsedAssignmentSections, setCollapsedAssignmentSections] = useState<Set<string>>(new Set(['ended']));
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiTutorMessageData[]>([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiTaskText, setAiTaskText] = useState('');
  const [aiContextUrl, setAiContextUrl] = useState('');
  const [aiScreenshot, setAiScreenshot] = useState<{ name: string; dataUrl: string } | null>(null);
  const [isLoadingAiMessages, setIsLoadingAiMessages] = useState(false);
  const [isSendingAiMessage, setIsSendingAiMessage] = useState(false);
  const [aiThinkingSummary, setAiThinkingSummary] = useState('');
  const [activeChatTab, setActiveChatTab] = useState<'teacher' | 'ai'>('teacher');
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [isUpdatingHelpRequest, setIsUpdatingHelpRequest] = useState(false);
  const [studentThemeKey, setStudentThemeKey] = useState<StudentThemeKey>(() => {
    if (typeof window === 'undefined') return 'vscode-dark';
    const savedTheme = window.localStorage.getItem(STUDENT_THEME_STORAGE_KEY);
    return savedTheme && savedTheme in studentThemeConfigs ? savedTheme as StudentThemeKey : 'vscode-dark';
  });
  const [chatWindowSize, setChatWindowSize] = useState({ width: 448, height: 544 });
  const [timerNow, setTimerNow] = useState(Date.now());

  // 拖曳檔案上傳
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // 程式執行
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ output: string; error?: string; needsInput?: boolean } | null>(null);
  const [programInput, setProgramInput] = useState(''); // 蝔?頛詨
  const [showInputPanel, setShowInputPanel] = useState(false);

  // ??瘨
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // 本地編輯狀態
  const [localCode, setLocalCode] = useState(student.currentCode);
  const [localLanguage, setLocalLanguage] = useState(student.currentLanguage);

  // ?脫?敺?隞?Ⅳ
  const debouncedCode = useDebounce(localCode, 500);

  // 蝭拚?銝剔?雿平
  const classroomAssignments = assignments.filter(a => a.classroomId === student.classroomId);
  const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const activeProject = projects.find(project => project.id === activeProjectId);
  const activeNote = classroomNotes.find(note => note.id === activeNoteId) || null;
  const activeAssignment = selectedAssignment || assignments.find(a => a.id === activeProject?.sourceAssignmentId);
  const assignmentDescriptionForAi = activeAssignment
    ? `${activeAssignment.title}\n\n${activeAssignment.description || ''}`.trim()
    : '';
  const { rootFolders, rootProjects } = useMemo(
    () => buildProjectTree(projectFolders, projects),
    [projectFolders, projects]
  );
  const { rootNoteFolders, rootNotes } = useMemo(
    () => buildClassroomNoteTree(classroomNoteFolders, classroomNotes),
    [classroomNoteFolders, classroomNotes]
  );
  const folderOptions = useMemo(() => {
    const options: { id: string | null; label: string }[] = [{ id: null, label: '根目錄' }];

    const walk = (nodes: ProjectFolderNode[], depth = 0) => {
      nodes.forEach(node => {
        options.push({ id: node.id, label: `${'  '.repeat(depth)}${node.name}` });
        walk(node.children, depth + 1);
      });
    };

    walk(rootFolders);
    return options;
  }, [rootFolders]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const [projectData, folderData] = await Promise.all([
        studentApi.getProjects(student.id),
        studentApi.getProjectFolders(student.id)
      ]);
      setProjects(projectData);
      setProjectFolders(folderData);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadClassroomNotes = async () => {
    if (!student.classroomId) {
      setClassroomNotes([]);
      setClassroomNoteFolders([]);
      setActiveNoteId(null);
      return;
    }

    try {
      const [notesResult, foldersResult] = await Promise.all([
        classroomApi.getNotes(student.classroomId),
        classroomApi.getNoteFolders(student.classroomId)
      ]);
      setClassroomNotes(notesResult.notes || []);
      setClassroomNoteFolders(foldersResult.folders || []);
    } catch (err) {
      console.error('Failed to load classroom notes:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [student.id]);

  useEffect(() => {
    loadClassroomNotes();
  }, [student.classroomId]);

  useEffect(() => {
    if (activeNoteId && !classroomNotes.some(note => note.id === activeNoteId)) {
      setActiveNoteId(null);
    }
  }, [activeNoteId, classroomNotes]);

  useEffect(() => {
    if (!activeProject?.readOnly) return;
    setLocalCode(activeProject.code);
    setLocalLanguage(activeProject.language);
    setSelectedFolderId(activeProject.folderId || null);
  }, [
    activeProject?.id,
    activeProject?.readOnly,
    activeProject?.code,
    activeProject?.language,
    activeProject?.folderId,
    activeProject?.updatedAt
  ]);

  useEffect(() => {
    return onClassroomNotesUpdated((data) => {
      if (data.classroomId === student.classroomId) {
        loadProjects();
        loadClassroomNotes();
      }
    });
  }, [student.classroomId]);

  useEffect(() => {
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeProjectId || activeProject?.readOnly) {
      setAiMessages([]);
      setAiThinkingSummary('');
      setShowAiSetup(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingAiMessages(true);
    studentApi.getProjectAiMessages(student.id, activeProjectId)
      .then(messages => {
        if (!isCancelled) setAiMessages(messages);
      })
      .catch(err => {
        console.error('Failed to load AI messages:', err);
        if (!isCancelled) setAiMessages([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingAiMessages(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [student.id, activeProjectId, activeProject?.readOnly]);

  useEffect(() => {
    window.localStorage.setItem(STUDENT_THEME_STORAGE_KEY, studentThemeKey);
  }, [studentThemeKey]);

  // 回饋視窗捲動
  const feedbackEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedbackEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [student.feedbacks]);

  // 新回饋提示
  useEffect(() => {
    const unreadCount = student.feedbacks.filter(f => !f.isRead && f.fromTeacher).length;
    if (unreadCount > 0 && !showFeedback) {
      setHasNewFeedback(true);
    }
  }, [student.feedbacks, showFeedback]);

  // ????蝒??閮撌脰?
  useEffect(() => {
    const hasUnreadTeacherFeedback = student.feedbacks.some(f => !f.isRead && f.fromTeacher);
    if (showFeedback && activeChatTab === 'teacher' && (hasNewFeedback || hasUnreadTeacherFeedback)) {
      setHasNewFeedback(false);
      studentApi.markFeedbackRead(student.id).catch(console.error);
      onUpdateStudent({
        ...student,
        feedbacks: student.feedbacks.map(f => f.fromTeacher ? { ...f, isRead: true } : f)
      });
    }
  }, [showFeedback, activeChatTab, hasNewFeedback, student.feedbacks, student.id]);


  // 避免初次載入就送出同步
  const isInitialMount = useRef(true);
  const lastSentCode = useRef(student.currentCode);
  const lastSentLanguage = useRef(student.currentLanguage);

  // 同步程式碼更新給老師端
  useEffect(() => {
    // 頝喲?擐活皜脫?
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (debouncedCode !== lastSentCode.current || localLanguage !== lastSentLanguage.current) {
      console.log('? ?郊隞?Ⅳ?唬撩?:', {
        length: debouncedCode.length,
        language: localLanguage
      });

      emitCodeUpdate(student.id, debouncedCode, localLanguage);

      lastSentCode.current = debouncedCode;
      lastSentLanguage.current = localLanguage;

      onUpdateStudent({
        ...student,
        currentCode: debouncedCode,
        currentLanguage: localLanguage
      });
    }
  }, [debouncedCode, localLanguage, student.id]);

  // 隞?Ⅳ霈嚗?堆?
  const handleCodeChange = (newCode: string) => {
    setLocalCode(newCode);
    setExecutionResult(null);
  };

  // 隤?霈
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalLanguage(e.target.value);
  };

  const allowedFileExtensions: Record<string, string> = {
    '.py': 'python',
    '.js': 'javascript',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.h': 'cpp',
    '.hpp': 'cpp',
  };

  const validateDroppedFile = (file: File): { lang: string } | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const lang = allowedFileExtensions[ext];
    if (!lang) {
      const allowed = Object.keys(allowedFileExtensions).join(', ');
      alert(`不支援此檔案格式。\n允許的格式：${allowed}`);
      return null;
    }
    if (file.size > 1024 * 1024) {
      alert('檔案過大，請選擇 1MB 以下的檔案');
      return null;
    }
    return { lang };
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    dragCounterRef.current = 0;

    if (!!activeNote || !!activeProject?.readOnly) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const result = validateDroppedFile(file);
    if (!result) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setLocalCode(content);
      setLocalLanguage(result.lang);
      setExecutionResult(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleFileDropToFolder = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    setDragOverFolderId(null);
    dragCounterRef.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const result = validateDroppedFile(file);
    if (!result) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      const projectName = file.name.replace(/\.[^.]+$/, '');
      try {
        const project = await studentApi.createProject(
          student.id,
          projectName,
          content,
          result.lang,
          null,
          folderId
        );
        setProjects(prev => [project, ...prev]);
        handleLoadProject(project);
        if (folderId) {
          setCollapsedFolderIds(prev => {
            const next = new Set(prev);
            next.delete(folderId);
            return next;
          });
        } else {
          setIsRootCollapsed(false);
        }
      } catch (err: any) {
        alert(err.message || '建立專案失敗，請稍後再試');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleFileDropToAssignment = (e: React.DragEvent, assignment: AssignmentData) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    setDragOverAssignmentId(null);
    dragCounterRef.current = 0;

    const canSubmit = assignment.isOpen && !isOverdue(assignment.dueDate);
    if (!canSubmit) {
      alert('此作業已截止或已關閉，無法提交');
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const result = validateDroppedFile(file);
    if (!result) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setSelectedAssignmentId(assignment.id);
      setActiveNoteId(null);
      setAiHint(null);
      setLocalCode(content);
      setLocalLanguage(result.lang);
      setExecutionResult(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleEditorDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handlePageDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handlePageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDraggingFile(false);
      dragCounterRef.current = 0;
    }
  };

  const handlePageDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
    }
  };

  const handlePageDrop = (e: React.DragEvent) => {
    setIsDraggingFile(false);
    setDragOverAssignmentId(null);
    dragCounterRef.current = 0;
  };

  // ?瑁?隞?Ⅳ
  const handleLoadProject = (project: ProjectData) => {
    setActiveProjectId(project.id);
    setActiveNoteId(null);
    setSelectedFolderId(project.folderId || null);
    setSelectedAssignmentId(project.sourceAssignmentId || null);
    setLocalCode(project.code);
    setLocalLanguage(project.readOnly ? project.language : ensureProgrammingLanguage(project.language));
    setExecutionResult(null);
    setAiHint(null);
  };

  const handleLoadClassroomNote = (note: ClassroomNoteData) => {
    setActiveNoteId(note.id);
    setExecutionResult(null);
    setAiHint(null);
  };

  const handleSaveCurrentProject = async () => {
    setIsSavingProject(true);
    try {
      if (activeProject) {
        const updatedProject = await studentApi.updateProject(student.id, activeProject.id, {
          code: localCode,
          language: localLanguage,
        });
        setProjects(prev => [updatedProject, ...prev.filter(project => project.id !== updatedProject.id)]);
      } else {
        const defaultName = selectedAssignment ? `${selectedAssignment.title} 練習` : '未命名練習專案';
        const name = window.prompt('專案名稱', defaultName);
        if (!name?.trim()) return;
        const project = await studentApi.createProject(
          student.id,
          name.trim(),
          localCode,
          localLanguage,
          selectedAssignmentId,
          selectedFolderId
        );
        setProjects(prev => [project, ...prev]);
        setActiveProjectId(project.id);
      }
    } catch (err: any) {
      alert(err.message || '專案儲存失敗，請稍後再試');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleToggleHelpRequest = async () => {
    setIsUpdatingHelpRequest(true);
    try {
      const result = student.handRaised
        ? await studentApi.clearHelpRequest(student.id)
        : await studentApi.raiseHelpRequest(student.id);

      onUpdateStudent({
        ...student,
        handRaised: result.handRaised,
        handRaisedAt: result.handRaisedAt
      });
    } catch (err: any) {
      alert(err.message || '舉手狀態更新失敗，請稍後再試');
    } finally {
      setIsUpdatingHelpRequest(false);
    }
  };

  const handleSaveAssignmentAsProject = async () => {
    if (!selectedAssignment) return;
    setIsSavingProject(true);
    try {
      const project = await studentApi.createProject(
        student.id,
        `${selectedAssignment.title} 練習`,
        localCode,
        localLanguage,
        selectedAssignment.id,
        selectedFolderId
      );
      setProjects(prev => [project, ...prev]);
      setActiveProjectId(project.id);
      alert('已存成練習專案');
    } catch (err: any) {
      alert(err.message || '存成練習專案失敗，請稍後再試');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleCreateBlankProject = async () => {
    const name = window.prompt('專案名稱', '新的練習專案');
    if (!name?.trim()) return;

    const projectLanguage = ensureProgrammingLanguage(localLanguage);
    setLocalLanguage(projectLanguage);
    setIsSavingProject(true);
    try {
      const project = await studentApi.createProject(student.id, name.trim(), '', projectLanguage, null, selectedFolderId);
      setProjects(prev => [project, ...prev]);
      handleLoadProject(project);
    } catch (err: any) {
      alert(err.message || '新增專案失敗，請稍後再試');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (project: ProjectData) => {
    if (!window.confirm(`確定要刪除「${project.name}」嗎？`)) return;

    try {
      await studentApi.deleteProject(student.id, project.id);
      setProjects(prev => prev.filter(item => item.id !== project.id));
      if (activeProjectId === project.id) {
        setActiveProjectId(null);
      }
    } catch (err: any) {
      alert(err.message || '刪除專案失敗，請稍後再試');
    }
  };

  const moveProjectToFolder = async (projectId: string, folderId: string | null) => {
    const project = projects.find(item => item.id === projectId);
    if (!project || project.folderId === folderId) return;
    if (project.readOnly) return;

    try {
      const updatedProject = await studentApi.updateProject(student.id, project.id, { folderId });
      setProjects(prev => prev.map(item => item.id === updatedProject.id ? updatedProject : item));
      if (activeProjectId === project.id) {
        setSelectedFolderId(folderId);
      }
    } catch (err: any) {
      alert(err.message || '移動專案失敗，請稍後再試');
    }
  };

  const handleProjectDrop = async (folderId: string | null) => {
    if (!draggingProjectId) return;
    await moveProjectToFolder(draggingProjectId, folderId);
    setDraggingProjectId(null);
    setDragOverFolderId(null);
  };

  const toggleFolder = (folderId: string) => {
    setCollapsedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleAssignmentSection = (sectionId: string) => {
    setCollapsedAssignmentSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleCreateFolder = async (parentId: string | null = selectedFolderId) => {
    const name = window.prompt('資料夾名稱', '新的資料夾');
    if (!name?.trim()) return;

    try {
      const folder = await studentApi.createProjectFolder(student.id, name.trim(), parentId);
      setProjectFolders(prev => [...prev, folder]);
      setSelectedFolderId(folder.id);
      if (parentId) {
        setCollapsedFolderIds(prev => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
    } catch (err: any) {
      alert(err.message || '新增資料夾失敗，請確認名稱後再試');
    }
  };

  const handleDeleteFolder = async (folder: ProjectFolderData) => {
    if (!window.confirm(`確定要刪除資料夾「${folder.name}」嗎？`)) return;

    try {
      await studentApi.deleteProjectFolder(student.id, folder.id);
      setProjectFolders(prev => prev.filter(item => item.id !== folder.id));
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(folder.parentId || null);
      }
    } catch (err: any) {
      alert(err.message || '鞈?憭曉???批捆嚗??宏?箸??芷');
    }
  };

  const renderProjectRow = (project: ProjectData, depth = 0) => (
    <div
      key={project.id}
      draggable={!project.readOnly}
      onDragStart={(e) => {
        if (project.readOnly) {
          e.preventDefault();
          return;
        }
        setDraggingProjectId(project.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', project.id);
      }}
      onDragEnd={() => {
        setDraggingProjectId(null);
        setDragOverFolderId(null);
      }}
      className={`group flex items-center gap-2 rounded border p-2 ${
        activeProjectId === project.id
          ? 'bg-cyan-900/30 border-cyan-500'
          : draggingProjectId === project.id
            ? 'bg-gray-700/50 border-cyan-700 opacity-60'
            : 'bg-gray-700/20 border-transparent hover:bg-gray-700/60 hover:border-gray-600'
      }`}
      style={{ marginLeft: depth * 14 }}
    >
      <button
        onClick={() => handleLoadProject(project)}
        className="min-w-0 flex-1 text-left flex items-center gap-2"
      >
        {project.language === 'markdown' ? (
          <FileText size={14} className="text-emerald-300 shrink-0" />
        ) : (
          <FileCode size={14} className="text-gray-400 shrink-0" />
        )}
        <span className="truncate text-sm">{project.name}</span>
      </button>
      {project.readOnly ? (
        <span className="shrink-0 rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-200">
          唯讀
        </span>
      ) : (
        <button
          onClick={() => handleDeleteProject(project)}
          className="p-1 text-gray-500 hover:text-red-400 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          title="刪除專案"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );

  const renderFolderNode = (folder: ProjectFolderNode, depth = 0) => {
    const collapsed = collapsedFolderIds.has(folder.id);
    const hasChildren = folder.children.length > 0 || folder.projects.length > 0;

    return (
      <div key={folder.id} className="space-y-1">
        <div
          className={`group flex items-center gap-1 rounded px-1 py-1 ${
            dragOverFolderId === folder.id
              ? 'bg-cyan-800/50 text-cyan-100 ring-1 ring-cyan-400'
              : selectedFolderId === folder.id
                ? 'bg-cyan-900/30 text-cyan-200'
                : 'hover:bg-gray-700/50'
          }`}
          style={{ marginLeft: depth * 14 }}
          onDragOver={(e) => {
            if (!draggingProjectId && !isDraggingFile) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = draggingProjectId ? 'move' : 'copy';
            setDragOverFolderId(folder.id);
          }}
          onDragLeave={() => {
            if (dragOverFolderId === folder.id) setDragOverFolderId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files?.length > 0 && !draggingProjectId) {
              handleFileDropToFolder(e, folder.id);
            } else {
              handleProjectDrop(folder.id);
            }
          }}
        >
          <button
            onClick={() => toggleFolder(folder.id)}
            className="p-0.5 text-gray-400 hover:text-white"
            title={collapsed ? '展開資料夾' : '收合資料夾'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => setSelectedFolderId(folder.id)}
            className="min-w-0 flex-1 text-left flex items-center gap-2"
          >
            <Folder size={14} className={`shrink-0 ${dragOverFolderId === folder.id && isDraggingFile ? 'text-cyan-400' : 'text-yellow-400'}`} />
            <span className="truncate text-sm font-medium">{folder.name}</span>
          </button>
          <button
            onClick={() => handleCreateFolder(folder.id)}
            className="p-1 text-gray-500 hover:text-cyan-300 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
            title="新增子資料夾"
          >
            <FolderPlus size={14} />
          </button>
          {!hasChildren && (
            <button
              onClick={() => handleDeleteFolder(folder)}
              className="p-1 text-gray-500 hover:text-red-400 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              title="刪除資料夾"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {!collapsed && (
          <div className="space-y-1">
            {folder.children.map(child => renderFolderNode(child, depth + 1))}
            {folder.projects.map(project => renderProjectRow(project, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const toggleNoteFolder = (folderId: string) => {
    setCollapsedNoteFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderClassroomNoteRow = (note: ClassroomNoteData, depth = 0) => (
    <button
      key={note.id}
      onClick={() => handleLoadClassroomNote(note)}
      className={`w-full flex items-center gap-2 rounded border p-2 text-left ${
        activeNoteId === note.id
          ? 'bg-cyan-900/30 border-cyan-500 text-cyan-100'
          : 'bg-gray-700/20 border-transparent hover:bg-gray-700/60 hover:border-gray-600'
      }`}
      style={{ marginLeft: depth * 14 }}
    >
      <FileText size={14} className="text-emerald-300 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm">{note.title}</span>
      <span className="shrink-0 rounded border border-gray-600 px-1.5 py-0.5 text-[10px] text-gray-400">唯讀</span>
    </button>
  );

  const renderClassroomNoteFolderNode = (folder: ClassroomNoteFolderNode, depth = 0) => {
    const collapsed = collapsedNoteFolderIds.has(folder.id);

    return (
      <div key={folder.id} className="space-y-1">
        <div
          className="group flex items-center gap-1 rounded px-1 py-1 hover:bg-gray-700/50"
          style={{ marginLeft: depth * 14 }}
        >
          <button
            onClick={() => toggleNoteFolder(folder.id)}
            className="p-0.5 text-gray-400 hover:text-white"
            title={collapsed ? '展開資料夾' : '收合資料夾'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <div className="min-w-0 flex-1 text-left flex items-center gap-2">
            <Folder size={14} className="text-yellow-400 shrink-0" />
            <span className="truncate text-sm font-medium">{folder.name}</span>
          </div>
        </div>
        {!collapsed && (
          <div className="space-y-1">
            {folder.children.map(child => renderClassroomNoteFolderNode(child, depth + 1))}
            {folder.notes.map(note => renderClassroomNoteRow(note, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderAssignmentButton = (assignment: AssignmentData) => {
    const isSubmitted = student.submissions.some(s => s.assignmentId === assignment.id);
    const overdue = isOverdue(assignment.dueDate);
    const timeRemaining = getTimeRemaining(assignment.dueDate);
    const isDropTarget = dragOverAssignmentId === assignment.id && isDraggingFile;
    const canSubmit = assignment.isOpen && !overdue;

    return (
      <div
        key={assignment.id}
        onClick={() => {
          setSelectedAssignmentId(assignment.id);
          setActiveNoteId(null);
          setAiHint(null);
          setLocalLanguage(prev => ensureProgrammingLanguage(prev));
        }}
        onDragOver={(e) => {
          if (!isDraggingFile) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          setDragOverAssignmentId(assignment.id);
        }}
        onDragLeave={() => {
          if (dragOverAssignmentId === assignment.id) setDragOverAssignmentId(null);
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files?.length > 0) {
            handleFileDropToAssignment(e, assignment);
          }
        }}
        className={`w-full text-left p-3 rounded-lg transition-all border cursor-pointer ${
          isDropTarget
            ? canSubmit
              ? 'bg-green-900/40 border-green-400 ring-1 ring-green-400/50 shadow-lg shadow-green-500/20'
              : 'bg-red-900/30 border-red-500/50'
            : selectedAssignmentId === assignment.id
              ? 'bg-blue-900/40 border-blue-500 shadow-lg shadow-blue-500/20'
              : 'bg-gray-700/30 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
        }`}
      >
        <div className="flex justify-between items-start gap-2">
          <span className="font-medium truncate flex-1">{assignment.title}</span>
          {isDropTarget && canSubmit && <Upload size={16} className="text-green-400 shrink-0 animate-bounce" />}
          {!isDropTarget && isSubmitted && <CheckCircle size={16} className="text-green-500 shrink-0" />}
        </div>

        {isDropTarget ? (
          <p className="text-xs mt-1 text-green-300">
            {canSubmit ? '放開以載入檔案，之後可提交' : '此作業已截止或已關閉'}
          </p>
        ) : (
          <div className="flex items-center gap-2 mt-1 text-xs">
            {assignment.dueDate && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-gray-500'}`}>
                <Clock size={12} /> {timeRemaining}
              </span>
            )}
            {!assignment.isOpen && (
              <span className="text-gray-500">已關閉</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAssignmentSection = (sectionId: string, title: string, items: AssignmentData[]) => {
    const collapsed = collapsedAssignmentSections.has(sectionId);

    return (
      <div className="space-y-2">
        <button
          onClick={() => toggleAssignmentSection(sectionId)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            {title}
          </span>
          <span className="text-xs text-gray-500">{items.length}</span>
        </button>
        {!collapsed && (
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-gray-500 text-sm py-3 text-center border border-dashed border-gray-700 rounded-lg">
                沒有作業
              </p>
            ) : (
              items.map(renderAssignmentButton)
            )}
          </div>
        )}
      </div>
    );
  };

  const handleExecuteCode = () => {
    setIsExecuting(true);
    setExecutionResult(null);

    const unsub = onCodeResult((result) => {
      setExecutionResult({
        output: result.output,
        error: result.error,
        needsInput: (result as any).needsInput
      });
      setIsExecuting(false);

      // 憒??閬撓?伐?憿舐內頛詨?Ｘ
      if ((result as any).needsInput) {
        setShowInputPanel(true);
      }

      unsub();
    });

    emitCodeExecute(student.id, localCode, localLanguage, programInput);

    // 頞???
    setTimeout(() => {
      if (isExecuting) {
        setExecutionResult({ output: '', error: '執行逾時' });
        setIsExecuting(false);
      }
    }, 15000);
  };

  // ?漱雿平
  const handleSubmitAssignment = async () => {
    if (!selectedAssignmentId) return;

    try {
      const submission = await studentApi.submitAssignment(
        student.id,
        selectedAssignmentId,
        localCode,
        localLanguage
      );

      onUpdateStudent({
        ...student,
        submissions: [
          submission,
          ...student.submissions.filter(item => item.assignmentId !== submission.assignmentId)
        ]
      });

      alert('作業已提交');
    } catch (err: any) {
      alert(err.message || '提交失敗，請稍後再試');
    }
  };

  const handleAiScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAiScreenshot(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片檔');
      e.target.value = '';
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('截圖太大，請裁切到 4MB 以下再上傳');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAiScreenshot({ name: file.name, dataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  };

  const handleChatResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = chatWindowSize.width;
    const startHeight = chatWindowSize.height;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const maxWidth = Math.max(288, window.innerWidth - 24);
      const maxHeight = Math.max(320, window.innerHeight - 24);
      const nextWidth = Math.min(maxWidth, Math.max(288, startWidth + startX - moveEvent.clientX));
      const nextHeight = Math.min(maxHeight, Math.max(320, startHeight + startY - moveEvent.clientY));
      setChatWindowSize({ width: nextWidth, height: nextHeight });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const sendAiTutorMessage = async (messageOverride?: string) => {
    const message = (messageOverride ?? aiQuestion).trim();
    if (!activeProjectId) {
      alert('請先建立或開啟一個練習專案，AI 對話會跟著專案保存。');
      return;
    }
    if (activeProject?.readOnly) {
      alert('老師筆記是唯讀內容，請切回自己的練習專案再使用 AI 提示。');
      return;
    }
    if (!message) {
      alert('請先輸入想問 AI 的問題');
      return;
    }
    if (aiMessages.length === 0 && !aiContextUrl.trim() && !aiTaskText.trim() && !aiScreenshot) {
      setShowAiSetup(true);
      alert('第一次使用這個專案的 AI 提示前，請先提供題目內容、題目網址或截圖。');
      return;
    }

    setIsSendingAiMessage(true);
    setIsGettingHint(true);
    setShowFeedback(true);
    setActiveChatTab('ai');
    setAiThinkingSummary('AI 正在讀題目、檢查目前程式碼，並整理不直接暴露答案的提示...');
    setAiHint(null);

    try {
      const result = await studentApi.sendProjectAiMessage(student.id, activeProjectId, {
        message,
        language: localLanguage,
        code: localCode,
        assignmentDescription: [assignmentDescriptionForAi, aiTaskText.trim()].filter(Boolean).join('\n\n'),
        contextUrl: aiContextUrl.trim(),
        screenshot: aiScreenshot
      });

      setAiMessages(prev => [...prev, result.userMessage, result.assistantMessage]);
      setAiQuestion('');
      setAiScreenshot(null);
      setAiThinkingSummary(result.thinkingSummary ? `模型回傳的思考摘要：${result.thinkingSummary}` : '');
      setAiHint(result.assistantMessage.content);
      setShowAiSetup(false);
    } catch (err: any) {
      alert(err.message || 'AI 提示暫時無法使用，請稍後再試');
      setAiThinkingSummary('');
      setAiHint('暫時無法取得 AI 提示，請稍後再試。');
    } finally {
      setIsSendingAiMessage(false);
      setIsGettingHint(false);
    }
  };

  const requestAiHint = async () => {
    await sendAiTutorMessage('請根據我目前的程式碼給我一個提示，不要直接給答案。');
  };

  // ?潮?閬策?葦
  const handleSendReply = () => {
    if (!replyMessage.trim()) return;

    setIsSendingReply(true);
    emitStudentMessage(student.id, replyMessage);

    // 璅??湔嚗??喲＊蝷綽?
    const newFeedback = {
      id: `temp-${Date.now()}`,
      message: replyMessage,
      timestamp: Date.now(),
      isRead: true,
      fromTeacher: false
    };

    onUpdateStudent({
      ...student,
      feedbacks: [...student.feedbacks, newFeedback]
    });

    setReplyMessage('');
    setIsSendingReply(false);
  };

  const hasSubmittedCurrent = student.submissions.some(s => s.assignmentId === selectedAssignmentId);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 瑼Ｘ?臬??
  const isOverdue = (dueDate?: number | null) => {
    if (!dueDate) return false;
    return Date.now() > dueDate;
  };

  // ?拚???
  const getTimeRemaining = (dueDate?: number | null) => {
    if (!dueDate) return null;
    const diff = dueDate - Date.now();
    if (diff <= 0) return '已截止';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `剩下 ${days} 天`;
    }
    return `剩下 ${hours} 小時 ${minutes} 分鐘`;
  };

  const formatCountdown = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => value.toString().padStart(2, '0');

    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${minutes}:${pad(seconds)}`;
  };

  const languages = [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' }
  ];

  const programmingLanguageValues = languages.map(l => l.value);
  const ensureProgrammingLanguage = (lang: string) =>
    programmingLanguageValues.includes(lang) ? lang : 'python';

  const ongoingAssignments = classroomAssignments.filter(assignment => (
    assignment.isOpen && !isOverdue(assignment.dueDate)
  ));
  const endedAssignments = classroomAssignments.filter(assignment => (
    !assignment.isOpen || isOverdue(assignment.dueDate)
  ));
  const selectedAssignmentCanSubmit = !!selectedAssignment?.isOpen && !isOverdue(selectedAssignment?.dueDate);

  const unreadCount = student.feedbacks.filter(f => !f.isRead && f.fromTeacher).length;
  const classroomTimer = student.classroomTimer || null;
  const classroomTimerRemainingMs = classroomTimer?.endsAt
    ? Math.max(0, classroomTimer.endsAt - timerNow)
    : 0;
  const classroomTimerActive = !!classroomTimer?.endsAt && classroomTimerRemainingMs > 0;
  const classroomTimerFinished = !!classroomTimer?.endsAt && classroomTimerRemainingMs <= 0;
  const classroomTimerUrgent = classroomTimerActive && classroomTimerRemainingMs <= 5 * 60 * 1000;
  const studentTheme = studentThemeConfigs[studentThemeKey];
  const studentThemeStyle = studentTheme.vars as CSSProperties;
  const isViewingClassroomNote = !!activeNote;
  const isViewingTeacherProject = !!activeProject?.readOnly;
  const isViewingTeacherMarkdown = isViewingTeacherProject && activeProject?.language === 'markdown';

  return (
    <div
      className="student-theme flex flex-col lg:flex-row h-screen w-screen max-w-full bg-gray-900 text-white overflow-hidden"
      data-student-theme={studentThemeKey}
      style={studentThemeStyle}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      <style>{studentThemeCss}</style>
      {/* Left Sidebar */}
      <div className="w-full lg:w-80 max-w-full max-h-[42vh] lg:max-h-none bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-700 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            CodeClass Live
          </h2>
          <p className="text-sm text-gray-400 mt-1">學生：{student.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isDraggingFile && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-cyan-400/60 bg-cyan-900/20 px-3 py-2 text-xs text-cyan-300 animate-pulse">
              <Upload size={14} className="shrink-0" />
              拖到資料夾建立專案，或拖到作業直接載入
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                <Folder size={14} /> 練習專案
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCreateFolder()}
                  className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1.5 rounded"
                  title="新增資料夾"
                >
                  <FolderPlus size={14} />
                  資料夾
                </button>
                <button
                  onClick={handleCreateBlankProject}
                  disabled={isSavingProject}
                  className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-2 py-1.5 rounded"
                  title="新增練習專案"
                >
                  <FileCode size={14} />
                  專案
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedFolderId(null);
                setIsRootCollapsed(prev => !prev);
              }}
              className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                dragOverFolderId === 'root'
                  ? 'bg-cyan-800/50 text-cyan-100 ring-1 ring-cyan-400'
                  : selectedFolderId === null
                    ? 'bg-cyan-900/30 text-cyan-200'
                    : 'text-gray-300 hover:bg-gray-700/50'
              }`}
              onDragOver={(e) => {
                if (!draggingProjectId && !isDraggingFile) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = draggingProjectId ? 'move' : 'copy';
                setDragOverFolderId('root');
              }}
              onDragLeave={() => {
                if (dragOverFolderId === 'root') setDragOverFolderId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files?.length > 0 && !draggingProjectId) {
                  handleFileDropToFolder(e, null);
                } else {
                  handleProjectDrop(null);
                }
              }}
            >
              {isRootCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <Folder size={14} className={`${dragOverFolderId === 'root' && isDraggingFile ? 'text-cyan-400' : 'text-yellow-400'}`} />
              根目錄
            </button>

            {isLoadingProjects && (
              <p className="text-gray-500 text-sm py-2">載入專案中...</p>
            )}

            {!isLoadingProjects && projects.length === 0 && projectFolders.length === 0 && (
              <p className="text-gray-500 text-sm py-3 text-center border border-dashed border-gray-700 rounded-lg">
                還沒有練習專案
              </p>
            )}

            {!isRootCollapsed && (
              <div className="space-y-1">
                {rootFolders.map(folder => renderFolderNode(folder))}
                {rootProjects.map(project => renderProjectRow(project))}
                {false && (
                <div className="mt-4 space-y-2 border-t border-gray-700 pt-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <BookOpen size={14} /> 課堂筆記
                  </h3>
                  <button
                    onClick={() => setIsNotesRootCollapsed(prev => !prev)}
                    className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                      activeNoteId
                        ? 'bg-emerald-900/30 text-emerald-200'
                        : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    {isNotesRootCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <Folder size={14} className="text-yellow-400" />
                    老師筆記
                  </button>
                  {!isNotesRootCollapsed && (
                    <div className="space-y-1">
                      {classroomNotes.length === 0 && classroomNoteFolders.length === 0 ? (
                        <p className="text-gray-500 text-sm py-3 text-center border border-dashed border-gray-700 rounded-lg">
                          目前沒有課堂筆記
                        </p>
                      ) : (
                        <>
                          {rootNoteFolders.map(folder => renderClassroomNoteFolderNode(folder))}
                          {rootNotes.map(note => renderClassroomNoteRow(note))}
                        </>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
          </div>
          {/* 雿平?” */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle size={14} /> 課堂作業
            </h3>

            {classroomAssignments.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">目前沒有課堂作業</p>
            )}

            {classroomAssignments.length > 0 && (
              <>
                {renderAssignmentSection('ongoing', '進行中', ongoingAssignments)}
                {renderAssignmentSection('ended', '已截止 / 已關閉', endedAssignments)}
              </>
            )}

            {false && openAssignments.map(assignment => {
              const isSubmitted = student.submissions.some(s => s.assignmentId === assignment.id);
              const overdue = isOverdue(assignment.dueDate);
              const timeRemaining = getTimeRemaining(assignment.dueDate);

              return (
                <button
                  key={assignment.id}
                  onClick={() => {
                    setSelectedAssignmentId(assignment.id);
                    setAiHint(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-all border ${
                    selectedAssignmentId === assignment.id
                      ? 'bg-blue-900/40 border-blue-500 shadow-lg shadow-blue-500/20'
                      : 'bg-gray-700/30 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium truncate flex-1">{assignment.title}</span>
                    {isSubmitted && <CheckCircle size={16} className="text-green-500 shrink-0" />}
                  </div>

                  {assignment.dueDate && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${overdue ? 'text-red-400' : 'text-gray-500'}`}>
                      <Clock size={12} /> {timeRemaining}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ?訾葉雿平閰單? */}
          {selectedAssignment && (
            <div className="bg-gray-700/30 p-4 rounded-xl border border-gray-600">
              <h4 className="font-bold text-blue-300 mb-2 flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="break-words">{selectedAssignment.title}</span>
                  {hasSubmittedCurrent && (
                    <span className="ml-2 inline-flex text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded">已提交</span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setSelectedAssignmentId(null);
                    setAiHint(null);
                  }}
                  className="shrink-0 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-600"
                  title="關閉作業"
                >
                  <X size={16} />
                </button>
              </h4>

              <p className="text-sm text-gray-300 whitespace-pre-wrap mb-3">
                {selectedAssignment.description}
              </p>

              {selectedAssignment.dueDate && (
                <div className={`flex items-center gap-2 text-xs mb-3 p-2 rounded ${
                  isOverdue(selectedAssignment.dueDate) ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'
                }`}>
                  <Calendar size={14} />
                  截止：{formatDate(selectedAssignment.dueDate)}
                </div>
              )}

              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">存到練習資料夾</label>
                <select
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-2 text-sm focus:border-cyan-500 outline-none"
                >
                  {folderOptions.map(option => (
                    <option key={option.id || 'root'} value={option.id || ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <button
                  onClick={requestAiHint}
                  disabled={isGettingHint}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-lg text-sm disabled:opacity-50"
                >
                  {isGettingHint ? <BrainCircuit className="animate-spin" size={16}/> : <Bot size={16} />}
                  {isGettingHint ? '取得提示中...' : '請 AI 提示'}
                </button>

                <button
                  onClick={handleSaveAssignmentAsProject}
                  disabled={isSavingProject}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-800 text-white py-2.5 px-4 rounded-lg text-sm disabled:opacity-50"
                >
                  {isSavingProject ? <Loader2 className="animate-spin" size={16} /> : <Folder size={16} />}
                  存成練習專案
                </button>

                <button
                  onClick={handleSubmitAssignment}
                  disabled={!selectedAssignmentCanSubmit}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm ${
                    !selectedAssignmentCanSubmit
                        ? 'bg-red-600/20 text-red-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {hasSubmittedCurrent ? (
                    <><CheckCircle size={16} /> 更新提交</>
                  ) : isOverdue(selectedAssignment.dueDate) ? (
                    <><AlertCircle size={16} /> 已截止</>
                  ) : (
                    <><Send size={16} /> 提交作業</>
                  )}
                </button>
              </div>

              {aiHint && (
                <div className="mt-3 p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg text-sm text-purple-200">
                  <strong className="block mb-1 text-purple-400 flex items-center gap-1">
                    <Bot size={14}/> AI 提示
                  </strong>
                  <div className="ai-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        code: ({ children }) => <code className="rounded bg-gray-900/80 px-1 py-0.5 font-mono text-[0.85em] text-cyan-100">{children}</code>,
                        pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded bg-gray-950 p-2 text-xs text-cyan-100">{children}</pre>,
                        table: ({ children }) => (
                          <div className="my-3 overflow-x-auto rounded border border-purple-500/30">
                            <table className="w-full border-collapse text-left text-xs">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-purple-950/60 text-purple-100">{children}</thead>,
                        th: ({ children }) => <th className="border border-purple-500/30 px-2 py-1.5 font-semibold">{children}</th>,
                        td: ({ children }) => <td className="border border-purple-500/20 px-2 py-1.5 align-top text-purple-50">{children}</td>
                      }}
                    >
                      {normalizeMarkdownTables(aiHint)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
            <button
              onClick={() => setShowAiSetup(prev => !prev)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-700/50"
              aria-expanded={showAiSetup}
            >
              <span className="min-w-0 flex items-center gap-2">
                <Bot size={15} className="text-purple-300 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-purple-100">AI 提示設定</span>
                  <span className="block truncate text-[11px] text-gray-400">
                    {!activeProjectId
                      ? '開啟練習專案後可使用'
                      : aiMessages.length === 0
                        ? '第一次提問前設定題目資訊'
                        : '已完成，可到右下角繼續對話'}
                  </span>
                </span>
              </span>
              {showAiSetup ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
            </button>

            {showAiSetup && (
              <div className="border-t border-gray-700 p-3 space-y-3">
                {activeProject && (
                  <div className="rounded bg-gray-900/50 border border-gray-700 px-2 py-1.5 text-[11px] text-gray-400">
                    目前專案：<span className="text-purple-200">{activeProject.name}</span>
                  </div>
                )}

                {!activeProjectId ? (
                  <p className="text-xs text-gray-400 leading-relaxed">
                    先建立或開啟練習專案後，就可以使用專案專屬的 AI 提示對話。
                  </p>
                ) : aiMessages.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      第一次提問前，請先提供題目網址、文字或截圖，AI 才能根據完整題目給提示。
                    </p>
                    <div className="rounded bg-gray-800/80 border border-gray-600 px-2 py-1.5 text-xs text-gray-300">
                      目前語言：<span className="text-purple-200">{localLanguage}</span>
                    </div>
                    <input
                      value={aiContextUrl}
                      onChange={(e) => setAiContextUrl(e.target.value)}
                      placeholder="題目網址，可留空改傳截圖"
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-2 text-xs focus:border-purple-500 outline-none"
                    />
                    <textarea
                      value={aiTaskText}
                      onChange={(e) => setAiTaskText(e.target.value)}
                      placeholder="題目內容或補充說明，可貼題目文字或老師補充規則"
                      className="w-full h-20 bg-gray-800 border border-gray-600 rounded px-2 py-2 text-xs resize-none focus:border-purple-500 outline-none"
                    />
                    <label className="block">
                      <span className="text-xs text-gray-400">題目截圖</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAiScreenshotChange}
                        className="mt-1 block w-full text-xs text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-gray-600 file:px-2 file:py-1 file:text-xs file:text-white"
                      />
                    </label>
                    {aiScreenshot && (
                      <p className="text-[11px] text-purple-300 truncate">已選擇：{aiScreenshot.name}</p>
                    )}
                    <textarea
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      placeholder="先問第一個問題，例如：我不知道這題下一步要怎麼想"
                      className="w-full h-20 bg-gray-800 border border-gray-600 rounded px-2 py-2 text-xs resize-none focus:border-purple-500 outline-none"
                    />
                    <button
                      onClick={() => sendAiTutorMessage()}
                      disabled={isSendingAiMessage}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 px-3 rounded text-sm"
                    >
                      {isSendingAiMessage ? <BrainCircuit className="animate-spin" size={14} /> : <Send size={14} />}
                      {isSendingAiMessage ? '讀取題目中...' : '開始 AI 對話'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      AI 已讀取這個專案的初始題目脈絡，後續請到右下角「AI 提示」分頁繼續提問。
                    </p>
                    <button
                      onClick={() => {
                        setShowFeedback(true);
                        setActiveChatTab('ai');
                        setShowAiSetup(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded text-sm"
                    >
                      <MessageSquare size={14} />
                      開啟右下 AI 對話
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col relative bg-[#1e1e1e]">
        {/* Toolbar */}
        <div className="min-w-0 max-w-full overflow-hidden bg-[#252526] border-b border-gray-700 flex flex-col gap-2 px-3 sm:px-4 py-2 shrink-0">
          <div className="min-w-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 sm:flex-none items-center gap-2">
                <span className="shrink-0 text-gray-400 text-sm">程式語言：</span>
                <select
                  value={localLanguage}
                  onChange={handleLanguageChange}
                  className="min-w-0 flex-1 sm:flex-none bg-gray-800 text-white text-sm border border-gray-600 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                >
                  {languages.map(lang => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-1 sm:flex-none items-center gap-2">
                <span className="shrink-0 text-gray-400 text-sm">介面風格：</span>
                <select
                  value={studentThemeKey}
                  onChange={(e) => setStudentThemeKey(e.target.value as StudentThemeKey)}
                  className="min-w-0 flex-1 sm:flex-none bg-gray-800 text-white text-sm border border-gray-600 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                >
                  {(Object.entries(studentThemeConfigs) as [StudentThemeKey, StudentThemeConfig][]).map(([key, theme]) => (
                    <option key={key} value={key}>{theme.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <span className="shrink-0 text-xs text-gray-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              即時同步
            </span>
          </div>
          <div className="min-w-0 w-full flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-end">
            {activeProject && (
              <span className="min-w-0 text-xs text-cyan-300 max-w-full 2xl:max-w-40 truncate">
                {activeProject.readOnly ? `唯讀筆記：${activeProject.name}` : activeProject.name}
              </span>
            )}
            {activeNote && (
              <span className="min-w-0 text-xs text-emerald-300 max-w-full 2xl:max-w-56 truncate">
                唯讀筆記：{activeNote.title}
              </span>
            )}
            <div className="grid min-w-0 w-full grid-cols-[repeat(2,minmax(0,1fr))] gap-2 2xl:flex 2xl:w-auto 2xl:flex-wrap 2xl:items-center 2xl:justify-end">
              <button
                onClick={handleSaveCurrentProject}
                disabled={isSavingProject || isViewingClassroomNote || isViewingTeacherProject}
                className="min-w-0 max-w-full overflow-hidden flex items-center justify-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm bg-cyan-700 text-white hover:bg-cyan-800 disabled:opacity-50 transition-all"
              >
                {isSavingProject ? <Loader2 className="animate-spin shrink-0" size={16} /> : <Save className="shrink-0" size={16} />}
                <span className="min-w-0 truncate">儲存</span>
              </button>
              <button
                onClick={() => setShowInputPanel(!showInputPanel)}
                disabled={isViewingClassroomNote || isViewingTeacherProject}
                className={`min-w-0 max-w-full overflow-hidden flex items-center justify-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm transition-all ${
                  isViewingClassroomNote || isViewingTeacherProject
                    ? 'bg-gray-700 text-gray-500 opacity-60'
                    : showInputPanel
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Keyboard className="shrink-0" size={16} />
                <span className="min-w-0 truncate">程式輸入</span>
              </button>
              <button
                onClick={handleExecuteCode}
                disabled={isExecuting || isViewingClassroomNote || isViewingTeacherProject}
                className="min-w-0 max-w-full overflow-hidden flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 sm:px-3 py-1.5 rounded-lg text-sm transition-all"
              >
                {isExecuting ? <Loader2 className="animate-spin shrink-0" size={16} /> : <Play className="shrink-0" size={16} />}
                <span className="min-w-0 truncate">執行</span>
              </button>
              <button
                onClick={handleToggleHelpRequest}
                disabled={isUpdatingHelpRequest}
                className={`min-w-0 max-w-full overflow-hidden flex items-center justify-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm transition-all disabled:opacity-50 ${
                  student.handRaised
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={student.handRaised ? '取消舉手' : '舉手請老師協助'}
              >
                {isUpdatingHelpRequest ? <Loader2 className="animate-spin shrink-0" size={16} /> : <Bell className="shrink-0" size={16} />}
                <span className="min-w-0 truncate">{student.handRaised ? '已舉手' : '舉手發問'}</span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="min-w-0 max-w-full overflow-hidden flex items-center justify-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm border border-gray-600 text-gray-300 hover:text-red-200 hover:border-red-500 hover:bg-red-900/40 transition-all"
                >
                  <LogOut className="shrink-0" size={16} />
                  <span className="min-w-0 truncate">登出</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {classroomTimer && (
          <div className={`shrink-0 border-b px-3 sm:px-4 py-2 ${
            classroomTimerFinished
              ? 'bg-red-900/30 border-red-700/50 text-red-100'
              : classroomTimerUrgent
                ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-100'
                : 'bg-cyan-900/30 border-cyan-500/40 text-cyan-100'
          }`}>
            <div className="min-w-0 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <Clock size={16} className="shrink-0" />
                <span className="text-sm font-semibold truncate">{classroomTimer.title}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-lg font-bold tabular-nums">
                {classroomTimerFinished ? '時間到' : formatCountdown(classroomTimerRemainingMs)}
              </div>
            </div>
          </div>
        )}

        {/* 蝔?頛詨?Ｘ */}
        {showInputPanel && (
          <div className="bg-yellow-900/20 border-b border-yellow-700/50 p-3 shrink-0">
            <div className="flex items-center gap-2 mb-2 text-sm text-yellow-300">
              <Keyboard size={16} />
              程式輸入：需要 input() 時，請把每一行輸入寫在這裡。
            </div>
            <textarea
              value={programInput}
              onChange={(e) => setProgramInput(e.target.value)}
              placeholder="每行一筆輸入，例如：&#10;5&#10;Hello&#10;World"
              className="w-full h-20 bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm font-mono resize-none focus:border-yellow-500 outline-none"
            />
          </div>
        )}

        {/* Code Editor */}
        <div
          className={`min-w-0 flex-1 overflow-hidden relative ${executionResult ? 'h-[calc(100%-180px)]' : ''}`}
          onDragOver={handleEditorDragOver}
          onDrop={handleFileDrop}
        >
          {isDraggingFile && !activeNote && !activeProject?.readOnly && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm border-2 border-dashed border-cyan-400 rounded-lg pointer-events-none">
              <div className="text-center space-y-3">
                <Upload size={48} className="mx-auto text-cyan-400 animate-bounce" />
                <p className="text-lg font-semibold text-cyan-200">放到這裡直接載入編輯器</p>
                <p className="text-sm text-gray-400">
                  或拖到左側資料夾自動建立專案
                </p>
                <p className="text-xs text-gray-500">
                  支援格式：{Object.keys(allowedFileExtensions).join(', ')}
                </p>
              </div>
            </div>
          )}
          {activeNote || isViewingTeacherMarkdown ? (
            <div className="h-full overflow-y-auto bg-gray-900 p-4 sm:p-6">
              <div className="mx-auto max-w-4xl rounded-lg border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                      <BookOpen size={14} />
                      老師課堂筆記
                    </div>
                    <h2 className="mt-1 truncate text-xl font-bold text-white">{activeNote?.title || activeProject?.name}</h2>
                  </div>
                  <span className="rounded border border-emerald-500/40 bg-emerald-900/30 px-2 py-1 text-xs text-emerald-200">
                    學生唯讀
                  </span>
                </div>
                <div className="ai-markdown text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold text-white">{children}</h1>,
                      h2: ({ children }) => <h2 className="mb-3 mt-5 text-xl font-bold text-white">{children}</h2>,
                      h3: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-semibold text-white">{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                      ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ children }) => <code className="rounded bg-gray-900/80 px-1 py-0.5 font-mono text-[0.85em] text-cyan-100">{children}</code>,
                      pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded bg-gray-950 p-3 text-xs text-cyan-100">{children}</pre>,
                      table: ({ children }) => (
                        <div className="my-3 overflow-x-auto rounded border border-gray-600">
                          <table className="w-full border-collapse text-left text-xs">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-gray-900/70 text-gray-100">{children}</thead>,
                      th: ({ children }) => <th className="border border-gray-600 px-2 py-1.5 font-semibold">{children}</th>,
                      td: ({ children }) => <td className="border border-gray-700 px-2 py-1.5 align-top">{children}</td>
                    }}
                  >
                    {normalizeMarkdownTables(activeNote?.content || localCode)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <CodeEditor
              code={localCode}
              onChange={handleCodeChange}
              language={localLanguage}
              editorTheme={studentTheme.editorTheme}
            />
          )}
        </div>

        {/* Execution Result Panel */}
        {executionResult && (
          <div className="h-36 bg-gray-900 border-t border-gray-700 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Terminal size={16} />
                執行結果
                {executionResult.needsInput && (
                  <span className="text-yellow-400 text-xs ml-2">需要輸入</span>
                )}
              </div>
              <button
                onClick={() => setExecutionResult(null)}
                className="text-gray-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 p-3 overflow-auto font-mono text-sm">
              {executionResult.error ? (
                <pre className="text-red-400 whitespace-pre-wrap">{executionResult.error}</pre>
              ) : (
                <pre className="text-green-400 whitespace-pre-wrap">{executionResult.output || '(沒有輸出)'}</pre>
              )}
            </div>
          </div>
        )}

        {/* Floating Chat Window */}
        {showFeedback && (
          <div
            className="fixed z-50 bottom-3 right-3 bg-gray-800/95 backdrop-blur border border-gray-600 rounded-lg shadow-2xl flex flex-col overflow-hidden"
            style={{
              width: `min(${chatWindowSize.width}px, calc(100vw - 1.5rem))`,
              height: `min(${chatWindowSize.height}px, calc(100dvh - 1.5rem))`,
              minWidth: '18rem',
              minHeight: '20rem',
              maxWidth: 'calc(100vw - 1.5rem)',
              maxHeight: 'calc(100dvh - 1.5rem)'
            }}
          >
            <div
              onPointerDown={handleChatResizeStart}
              className="absolute left-0 top-0 z-10 h-7 w-7 cursor-nwse-resize rounded-br-lg border-b border-r border-gray-600 bg-gray-700/90 hover:bg-gray-600"
              title="拖曳調整對話框大小"
            >
              <div className="absolute left-1.5 top-1.5 h-3.5 w-3.5 border-l-2 border-t-2 border-gray-300" />
            </div>
            <div className="p-3 bg-gray-800 rounded-t-lg border-b border-gray-600 shrink-0 space-y-3">
              <div className="flex justify-between items-center gap-2">
                <div className="ml-5 flex items-center gap-2 text-white font-medium">
                  <MessageSquare size={16} className="text-blue-400" />
                  對話
                </div>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded bg-gray-900/60 p-1">
                <button
                  onClick={() => setActiveChatTab('teacher')}
                  className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs ${
                    activeChatTab === 'teacher'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Users size={13} />
                  老師
                  {(hasNewFeedback || unreadCount > 0) && (
                    <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{unreadCount || '!'}</span>
                  )}
                </button>
                <button
                  onClick={() => setActiveChatTab('ai')}
                  className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs ${
                    activeChatTab === 'ai'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {isSendingAiMessage ? <BrainCircuit className="animate-spin" size={13} /> : <Bot size={13} />}
                  AI 提示
                </button>
              </div>
            </div>

            {activeChatTab === 'teacher' ? (
              <>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {student.feedbacks.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={32} className="mx-auto text-gray-600 mb-2" />
                  <p className="text-gray-500 text-sm">目前沒有訊息</p>
                </div>
              ) : (
                student.feedbacks.map(fb => (
                  <div
                    key={fb.id}
                    className={`p-3 rounded-lg border text-sm max-w-[85%] ${
                      fb.fromTeacher
                        ? 'bg-blue-900/30 border-blue-500/50 mr-auto'
                        : 'bg-green-900/30 border-green-500/50 ml-auto'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-xs opacity-70">
                      {fb.fromTeacher ? (
                        <><Users size={12} /> 老師</>
                      ) : (
                        <><User size={12} /> 我</>
                      )}
                    </div>
                    <p className="text-gray-200 whitespace-pre-wrap">{fb.message}</p>
                    <p className="text-right text-xs text-gray-500 mt-2">
                      {new Date(fb.timestamp).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                ))
              )}
              <div ref={feedbackEndRef} />
            </div>

            {/* ??頛詨獢?*/}
            <div className="p-3 border-t border-gray-700 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="傳訊息給老師..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || isSendingReply}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {!activeProjectId ? (
                    <div className="text-center py-8">
                      <Bot size={32} className="mx-auto text-gray-600 mb-2" />
                      <p className="text-gray-500 text-sm">先在左側開啟或建立練習專案。</p>
                    </div>
                  ) : isLoadingAiMessages ? (
                    <p className="text-xs text-gray-500">載入 AI 對話中...</p>
                  ) : aiMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <Bot size={32} className="mx-auto text-gray-600 mb-2" />
                      <p className="text-gray-500 text-sm">先設定題目網址、文字或截圖，並送出第一個問題。</p>
                      <button
                        onClick={() => {
                          setShowAiSetup(true);
                          setShowFeedback(false);
                        }}
                        className="mt-3 inline-flex items-center gap-2 rounded bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
                      >
                        <Bot size={14} />
                        開啟 AI 題目設定
                      </button>
                    </div>
                  ) : (
                    aiMessages.map(message => (
                      <div
                        key={message.id}
                        className={`rounded-lg border p-3 text-sm max-w-[92%] ${
                          message.role === 'assistant'
                            ? 'bg-purple-900/25 border-purple-500/40 text-purple-100 mr-auto'
                            : 'bg-gray-700 border-gray-600 text-gray-100 ml-auto'
                        }`}
                      >
                        <div className="mb-1 text-[11px] text-gray-400">
                          {message.role === 'assistant' ? 'AI 提示' : '我'}
                          {message.attachmentName ? ` · ${message.attachmentName}` : ''}
                        </div>
                        {message.role === 'assistant' ? (
                          <div className="ai-markdown">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                code: ({ children }) => <code className="rounded bg-gray-900/80 px-1 py-0.5 font-mono text-[0.85em] text-cyan-100">{children}</code>,
                                pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded bg-gray-950 p-2 text-xs text-cyan-100">{children}</pre>,
                                table: ({ children }) => (
                                  <div className="my-3 overflow-x-auto rounded border border-purple-500/30">
                                    <table className="w-full border-collapse text-left text-xs">{children}</table>
                                  </div>
                                ),
                                thead: ({ children }) => <thead className="bg-purple-950/60 text-purple-100">{children}</thead>,
                                th: ({ children }) => <th className="border border-purple-500/30 px-2 py-1.5 font-semibold">{children}</th>,
                                td: ({ children }) => <td className="border border-purple-500/20 px-2 py-1.5 align-top text-purple-50">{children}</td>
                              }}
                            >
                              {normalizeMarkdownTables(message.content)}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )}
                      </div>
                    ))
                  )}
                  {isSendingAiMessage && (
                    <div className="rounded-lg border border-purple-500/40 bg-purple-900/25 p-3 text-sm text-purple-100 mr-auto max-w-[92%]">
                      <div className="mb-1 flex items-center gap-2 text-xs text-purple-300">
                        <BrainCircuit className="animate-spin" size={14} />
                        AI 執行中
                      </div>
                      {aiThinkingSummary || '正在整理提示...'}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-gray-700 shrink-0 space-y-2">
                  <textarea
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder={
                      activeProjectId && aiMessages.length > 0
                        ? '繼續問 AI，例如：我該檢查哪個變數？'
                        : '請先在左側完成 AI 提示設定'
                    }
                    disabled={!activeProjectId || aiMessages.length === 0 || isSendingAiMessage}
                    className="w-full h-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:border-purple-500 outline-none disabled:opacity-60"
                  />
                  <button
                    onClick={() => sendAiTutorMessage()}
                    disabled={!activeProjectId || aiMessages.length === 0 || !aiQuestion.trim() || isSendingAiMessage}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 px-3 rounded-lg text-sm"
                  >
                    {isSendingAiMessage ? <BrainCircuit className="animate-spin" size={16} /> : <Send size={16} />}
                    {isSendingAiMessage ? 'AI 正在想提示...' : '送出提問'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Show Feedback Button */}
        {!showFeedback && (
          <button
            onClick={() => setShowFeedback(true)}
            className="fixed z-50 bottom-3 right-3 sm:bottom-4 sm:right-4 bg-blue-600 text-white p-4 rounded-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
          >
            <Bell size={24} />
            {(hasNewFeedback || unreadCount > 0) && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 items-center justify-center text-xs font-bold">
                  {unreadCount || '!'}
                </span>
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
