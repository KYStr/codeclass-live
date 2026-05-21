import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StudentData, AssignmentData, studentApi, assignmentApi, classroomApi, ClassroomData, ClassroomNoteData, ClassroomNoteFolderData } from '../services/api';
import { emitFeedback, emitCodeExecute, onCodeResult, emitClearFeedback, onClassroomTimerUpdated } from '../services/socket';
import CodeEditor from './CodeEditor';
import { analyzeStudentCode } from '../services/geminiService';
import ClassroomManager from './ClassroomManager';
import { 
  LayoutGrid, 
  Users, 
  FilePlus, 
  MessageSquare, 
  Send, 
  Eye, 
  CheckSquare, 
  Sparkles,
  Loader2,
  Clock,
  RotateCcw,
  ExternalLink,
  UserPlus,
  Trash2,
  Calendar,
  ToggleLeft,
  ToggleRight,
  UserMinus,
  AlertCircle,
  Key,
  Play,
  Terminal,
  School,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Folder,
  FolderPlus,
  FileText,
  Save,
  X,
  Pencil,
  Check
} from 'lucide-react';

interface TeacherDashboardProps {
  students: StudentData[];
  assignments: AssignmentData[];
  onUpdateStudents: (students: StudentData[]) => void;
  onUpdateAssignments: (assignments: AssignmentData[]) => void;
  onRefresh: () => void;
}

interface TeacherHistoryState {
  codeclassTeacher: true;
  activeTab: 'monitor' | 'assignments' | 'students' | 'classrooms' | 'notes';
  selectedClassroomId: string | null;
  selectedStudentId: string | null;
  viewingSubmissionId: string | null;
}

interface TeacherNoteFolderNode extends ClassroomNoteFolderData {
  children: TeacherNoteFolderNode[];
  notes: ClassroomNoteData[];
}

function buildTeacherNoteTree(folders: ClassroomNoteFolderData[], notes: ClassroomNoteData[]) {
  const nodeMap = new Map<string, TeacherNoteFolderNode>();
  folders.forEach(folder => {
    nodeMap.set(folder.id, { ...folder, children: [], notes: [] });
  });

  const rootFolders: TeacherNoteFolderNode[] = [];
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

  const sortNode = (node: TeacherNoteFolderNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    node.notes.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
    node.children.forEach(sortNode);
  };

  rootFolders.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  rootFolders.forEach(sortNode);
  rootNotes.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));

  return { rootFolders, rootNotes };
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
  students, 
  assignments, 
  onUpdateStudents,
  onUpdateAssignments,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'assignments' | 'students' | 'classrooms' | 'notes'>('monitor');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<StudentData['submissions'][0] | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const historyReadyRef = useRef(false);
  const restoringHistoryRef = useRef(false);
  
  // Classroom state
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomData | null>(null);
  const [showClassroomDropdown, setShowClassroomDropdown] = useState(false);
  const [timerTitle, setTimerTitle] = useState('課堂倒數');
  const [timerMinutes, setTimerMinutes] = useState('10');
  const [isUpdatingTimer, setIsUpdatingTimer] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [noteFolders, setNoteFolders] = useState<ClassroomNoteFolderData[]>([]);
  const [notes, setNotes] = useState<ClassroomNoteData[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNoteFolderId, setSelectedNoteFolderId] = useState<string | null>(null);
  const [collapsedNoteFolderIds, setCollapsedNoteFolderIds] = useState<Set<string>>(new Set());
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  
  // Assignment creation state
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentDesc, setNewAssignmentDesc] = useState('');
  const [newAssignmentDueDate, setNewAssignmentDueDate] = useState('');

  // Student management state
  const [newStudentName, setNewStudentName] = useState('');

  // 載入教室列表
  useEffect(() => {
    const loadClassrooms = async () => {
      try {
        const result = await classroomApi.getAll();
        setClassrooms(result.classrooms || []);
      } catch (err) {
        console.error('載入教室失敗:', err);
      }
    };
    loadClassrooms();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return onClassroomTimerUpdated((data) => {
      setClassrooms(prev => prev.map(classroom =>
        classroom.id === data.classroomId ? { ...classroom, timer: data.timer } : classroom
      ));
      setSelectedClassroom(prev =>
        prev && prev.id === data.classroomId ? { ...prev, timer: data.timer } : prev
      );
    });
  }, []);

  const filteredStudents = selectedClassroom 
    ? students.filter(s => s.classroomId === selectedClassroom.id)
    : students;

  const filteredAssignments = selectedClassroom
    ? assignments.filter(a => a.classroomId === selectedClassroom.id)
    : assignments;

  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Code execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ output: string; error?: string } | null>(null);

  // Loading states
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [editingDueDateValue, setEditingDueDateValue] = useState('');

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedNote = notes.find(note => note.id === selectedNoteId) || null;
  const { rootFolders: noteTreeFolders, rootNotes: noteTreeRootNotes } = useMemo(
    () => buildTeacherNoteTree(noteFolders, notes),
    [noteFolders, notes]
  );
  const classroomTimer = selectedClassroom?.timer || null;
  const classroomTimerRemainingMs = classroomTimer?.endsAt
    ? Math.max(0, classroomTimer.endsAt - timerNow)
    : 0;
  const classroomTimerActive = !!classroomTimer?.endsAt && classroomTimerRemainingMs > 0;
  const classroomTimerFinished = !!classroomTimer?.endsAt && classroomTimerRemainingMs <= 0;

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

  const updateClassroomTimerState = (updatedClassroom: ClassroomData) => {
    setClassrooms(prev => prev.map(classroom =>
      classroom.id === updatedClassroom.id ? updatedClassroom : classroom
    ));
    setSelectedClassroom(updatedClassroom);
  };

  const handleStartClassroomTimer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClassroom) return;

    const minutes = Number(timerMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      alert('請輸入有效的倒數分鐘數');
      return;
    }

    setIsUpdatingTimer(true);
    try {
      const result = await classroomApi.startTimer(
        selectedClassroom.id,
        minutes,
        timerTitle.trim() || '課堂倒數'
      );
      updateClassroomTimerState(result.classroom);
    } catch (err: any) {
      alert(err.message || '設定倒數失敗，請稍後再試');
    } finally {
      setIsUpdatingTimer(false);
    }
  };

  const handleClearClassroomTimer = async () => {
    if (!selectedClassroom) return;

    setIsUpdatingTimer(true);
    try {
      const result = await classroomApi.clearTimer(selectedClassroom.id);
      updateClassroomTimerState(result.classroom);
    } catch (err: any) {
      alert(err.message || '清除倒數失敗，請稍後再試');
    } finally {
      setIsUpdatingTimer(false);
    }
  };

  const loadClassroomNotes = async (classroomId = selectedClassroom?.id) => {
    if (!classroomId) {
      setNoteFolders([]);
      setNotes([]);
      setSelectedNoteId(null);
      return;
    }

    setIsLoadingNotes(true);
    try {
      const [foldersResult, notesResult] = await Promise.all([
        classroomApi.getNoteFolders(classroomId),
        classroomApi.getNotes(classroomId)
      ]);
      setNoteFolders(foldersResult.folders || []);
      setNotes(notesResult.notes || []);
    } catch (err) {
      console.error('Failed to load classroom notes:', err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadClassroomNotes(selectedClassroom?.id);
  }, [selectedClassroom?.id]);

  const handleSelectNote = (note: ClassroomNoteData) => {
    setSelectedNoteId(note.id);
    setSelectedNoteFolderId(note.folderId || null);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  const handleCreateNoteFolder = async () => {
    if (!selectedClassroom) return;
    const name = window.prompt('資料夾名稱', '課堂筆記');
    if (!name?.trim()) return;

    try {
      const result = await classroomApi.createNoteFolder(selectedClassroom.id, name.trim(), selectedNoteFolderId);
      setNoteFolders(prev => [...prev, result.folder]);
      setSelectedNoteFolderId(result.folder.id);
    } catch (err: any) {
      alert(err.message || '新增筆記資料夾失敗');
    }
  };

  const handleDeleteNoteFolder = async () => {
    if (!selectedClassroom || !selectedNoteFolderId) return;
    const folder = noteFolders.find(item => item.id === selectedNoteFolderId);
    if (!folder) return;

    if (!window.confirm(`確定要刪除「${folder.name}」嗎？學生在這個資料夾底下自己建立的內容會移到「學生資料夾」。`)) {
      return;
    }

    try {
      await classroomApi.deleteNoteFolder(selectedClassroom.id, folder.id);
      setSelectedNoteFolderId(null);
      setSelectedNoteId(null);
      setNoteTitle('');
      setNoteContent('');
      await loadClassroomNotes(selectedClassroom.id);
    } catch (err: any) {
      alert(err.message || '刪除筆記資料夾失敗');
    }
  };

  const handleCreateNote = async () => {
    if (!selectedClassroom) return;
    const title = window.prompt('筆記檔名', '課堂筆記.md');
    if (!title?.trim()) return;

    const starter = `# ${title.trim().replace(/\.md$/i, '')}\n\n`;
    try {
      const result = await classroomApi.createNote(selectedClassroom.id, title.trim(), starter, selectedNoteFolderId);
      setNotes(prev => [result.note, ...prev]);
      handleSelectNote(result.note);
    } catch (err: any) {
      alert(err.message || '新增筆記失敗');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedClassroom || !selectedNoteId || !noteTitle.trim()) return;
    setIsSavingNote(true);
    try {
      const result = await classroomApi.updateNote(selectedClassroom.id, selectedNoteId, {
        title: noteTitle.trim(),
        content: noteContent,
        folderId: selectedNoteFolderId
      });
      setNotes(prev => prev.map(note => note.id === result.note.id ? result.note : note));
      handleSelectNote(result.note);
    } catch (err: any) {
      alert(err.message || '儲存筆記失敗');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (note: ClassroomNoteData) => {
    if (!selectedClassroom) return;
    if (!window.confirm(`確定要刪除「${note.title}」嗎？`)) return;

    try {
      await classroomApi.deleteNote(selectedClassroom.id, note.id);
      setNotes(prev => prev.filter(item => item.id !== note.id));
      if (selectedNoteId === note.id) {
        setSelectedNoteId(null);
        setNoteTitle('');
        setNoteContent('');
      }
    } catch (err: any) {
      alert(err.message || '刪除筆記失敗');
    }
  };

  const toggleTeacherNoteFolder = (folderId: string) => {
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

  const renderTeacherNoteRow = (note: ClassroomNoteData, depth = 0) => (
    <button
      key={note.id}
      onClick={() => handleSelectNote(note)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
        selectedNoteId === note.id
          ? 'bg-blue-900/40 text-blue-100'
          : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
      }`}
      style={{ paddingLeft: `${8 + depth * 18}px` }}
      title={note.title}
    >
      <FileText size={15} className="shrink-0 text-emerald-300" />
      <span className="min-w-0 flex-1 truncate">{note.title}</span>
    </button>
  );

  const renderTeacherNoteFolderNode = (folder: TeacherNoteFolderNode, depth = 0): React.ReactNode => {
    const isCollapsed = collapsedNoteFolderIds.has(folder.id);
    const isSelected = selectedNoteFolderId === folder.id && !selectedNoteId;
    const hasChildren = folder.children.length > 0 || folder.notes.length > 0;

    return (
      <div key={folder.id}>
        <div
          className={`group flex w-full items-center gap-1 rounded-lg px-2 py-2 text-sm transition-colors ${
            isSelected
              ? 'bg-gray-700 text-white'
              : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
          }`}
          style={{ paddingLeft: `${6 + depth * 18}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleTeacherNoteFolder(folder.id)}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-600 hover:text-white disabled:opacity-30"
            disabled={!hasChildren}
            aria-label={isCollapsed ? '展開資料夾' : '收合資料夾'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedNoteId(null);
              setSelectedNoteFolderId(folder.id);
              if (hasChildren && isCollapsed) {
                toggleTeacherNoteFolder(folder.id);
              }
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            title={folder.name}
          >
            <Folder size={15} className="shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          </button>
        </div>
        {!isCollapsed && (
          <div className="mt-1 space-y-1">
            {folder.children.map(child => renderTeacherNoteFolderNode(child, depth + 1))}
            {folder.notes.map(note => renderTeacherNoteRow(note, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // 同步老師端畫面到瀏覽器歷史，方便側鍵返回上一個畫面。
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const state: TeacherHistoryState = {
      codeclassTeacher: true,
      activeTab,
      selectedClassroomId: selectedClassroom?.id || null,
      selectedStudentId,
      viewingSubmissionId: viewingSubmission?.id || null
    };

    if (!historyReadyRef.current) {
      window.history.replaceState(state, '');
      historyReadyRef.current = true;
      return;
    }

    if (restoringHistoryRef.current) {
      window.history.replaceState(state, '');
      restoringHistoryRef.current = false;
      return;
    }

    window.history.pushState(state, '');
  }, [activeTab, selectedClassroom?.id, selectedStudentId, viewingSubmission?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as TeacherHistoryState | null;
      if (!state?.codeclassTeacher) return;

      restoringHistoryRef.current = true;
      const classroom = classrooms.find(item => item.id === state.selectedClassroomId) || null;
      const student = students.find(item => item.id === state.selectedStudentId);
      const submission = student?.submissions.find(item => item.id === state.viewingSubmissionId) || null;

      setActiveTab(state.activeTab);
      setSelectedClassroom(classroom);
      setSelectedStudentId(state.selectedStudentId);
      setViewingSubmission(submission);
      setAiAnalysis(null);
      setExecutionResult(null);
      setShowClassroomDropdown(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [classrooms, students]);

  const handleSendFeedback = () => {
    if (!selectedStudent || !feedbackInput.trim()) return;

    emitFeedback(selectedStudent.id, feedbackInput);
    setFeedbackInput('');
  };


  const handleClearHelpRequest = async (studentId: string) => {
    try {
      const result = await studentApi.clearHelpRequest(studentId);
      onUpdateStudents(students.map(student =>
        student.id === studentId
          ? { ...student, handRaised: result.handRaised, handRaisedAt: result.handRaisedAt }
          : student
      ));
    } catch (err: any) {
      alert(err.message || '清除舉手狀態失敗，請稍後再試');
    }
  };
  // 新增作業
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignmentTitle.trim()) return;

    setIsCreatingAssignment(true);
    try {
      const dueDate = newAssignmentDueDate ? new Date(newAssignmentDueDate).getTime() : undefined;
      const newAssignment = await assignmentApi.create(
        newAssignmentTitle, 
        newAssignmentDesc, 
        dueDate,
        selectedClassroom?.id // 發布到目前選取的教室
      );
      
      onUpdateAssignments([newAssignment, ...assignments]);
      setNewAssignmentTitle('');
      setNewAssignmentDesc('');
      setNewAssignmentDueDate('');
      alert('作業已新增');
    } catch (err) {
      console.error('Failed to create assignment:', err);
      alert('新增失敗，請稍後再試');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleToggleAssignment = async (assignmentId: string) => {
    try {
      await assignmentApi.toggle(assignmentId);
      onUpdateAssignments(assignments.map(a => 
        a.id === assignmentId ? { ...a, isOpen: !a.isOpen } : a
      ));
    } catch (err) {
      console.error('Failed to toggle assignment:', err);
    }
  };

  // 刪除作業
  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('確定要刪除這份作業嗎？')) return;
    
    try {
      await assignmentApi.delete(assignmentId);
      onUpdateAssignments(assignments.filter(a => a.id !== assignmentId));
    } catch (err) {
      console.error('Failed to delete assignment:', err);
    }
  };

  const handleStartEditDueDate = (assign: AssignmentData) => {
    setEditingDueDateId(assign.id);
    if (assign.dueDate) {
      const d = new Date(assign.dueDate);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setEditingDueDateValue(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    } else {
      setEditingDueDateValue('');
    }
  };

  const handleSaveDueDate = async (assignmentId: string) => {
    try {
      const dueDate = editingDueDateValue ? new Date(editingDueDateValue).getTime() : null;
      const updated = await assignmentApi.updateDueDate(assignmentId, dueDate);
      onUpdateAssignments(assignments.map(a => a.id === assignmentId ? updated : a));
      setEditingDueDateId(null);
    } catch (err) {
      console.error('Failed to update due date:', err);
      alert('修改截止時間失敗，請稍後再試');
    }
  };

  // 新增學生
  const handleAddNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    setIsCreatingStudent(true);
    try {
      const newStudent = await studentApi.create(
        newStudentName.trim(),
        selectedClassroom?.id // 加入目前選取的教室
      );
      onUpdateStudents([...students, newStudent]);
      setNewStudentName('');
    } catch (err: any) {
      alert(err.message || '新增學生失敗，請稍後再試');
    } finally {
      setIsCreatingStudent(false);
    }
  };

  // 刪除學生
  const handleRemoveStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!window.confirm(`確定要刪除學生「${student.name}」嗎？`)) return;
    
    try {
      await studentApi.delete(studentId);
      onUpdateStudents(students.filter(s => s.id !== studentId));
    } catch (err) {
      console.error('Failed to delete student:', err);
    }
  };

  // 重設學生密碼
  const handleResetPassword = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!window.confirm(`確定要重設「${student.name}」的密碼嗎？`)) return;
    
    try {
      await studentApi.resetPassword(studentId);
      onUpdateStudents(students.map(s => 
        s.id === studentId ? { ...s, isPasswordSet: false } : s
      ));
      alert('密碼已重設，學生下次登入需要重新設定密碼');
    } catch (err) {
      console.error('Failed to reset password:', err);
    }
  };

  // AI 分析
  const handleAnalyzeCode = async () => {
    if (!selectedStudent) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    
    const codeToAnalyze = viewingSubmission ? viewingSubmission.code : selectedStudent.currentCode;
    
    let assignmentContext = '未指定作業內容';
    if (viewingSubmission) {
      const subAssignment = assignments.find(a => a.id === viewingSubmission.assignmentId);
      if (subAssignment) assignmentContext = subAssignment.description;
    }
    
    const analysis = await analyzeStudentCode(
      codeToAnalyze, 
      selectedStudent.currentLanguage, 
      assignmentContext
    );
    
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  // 執行程式
  const handleExecuteCode = () => {
    if (!selectedStudent) return;
    
    const codeToExecute = viewingSubmission ? viewingSubmission.code : selectedStudent.currentCode;
    const language = viewingSubmission?.language || selectedStudent.currentLanguage;
    
    setIsExecuting(true);
    setExecutionResult(null);
    
    // 監聽執行結果
    const unsub = onCodeResult((result) => {
      setExecutionResult({ output: result.output, error: result.error });
      setIsExecuting(false);
      unsub();
    });
    
    emitCodeExecute(selectedStudent.id, codeToExecute, language);
    
    // 頞???
    setTimeout(() => {
      if (isExecuting) {
        setExecutionResult({ output: '', error: '執行逾時' });
        setIsExecuting(false);
      }
    }, 15000);
  };

  const jumpToSubmission = (studentId: string, submission: StudentData['submissions'][0]) => {
    setSelectedStudentId(studentId);
    setViewingSubmission(submission);
    setActiveTab('monitor');
    setAiAnalysis(null);
    setExecutionResult(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-TW', {
      year: 'numeric',
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

  if (!selectedClassroom && classrooms.length > 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <School className="text-indigo-400" />
              選擇要進入的教室
            </h1>
            <p className="text-gray-400 mt-2">
              進入老師頁面前，先選擇這堂課要監看的教室；之後仍可在左上角切換。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {classrooms.map(classroom => (
              <button
                key={classroom.id}
                onClick={() => setSelectedClassroom(classroom)}
                className="text-left bg-gray-800 border border-gray-700 hover:border-indigo-400 hover:bg-gray-700 rounded-lg p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{classroom.name}</h2>
                    {classroom.description && (
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{classroom.description}</p>
                    )}
                  </div>
                  <School size={22} className="text-indigo-400 shrink-0" />
                </div>
                <div className="mt-5 flex items-center gap-4 text-sm text-gray-400">
                  <span>{classroom.studentCount} 位學生</span>
                  <span>{classroom.assignmentCount} 份作業</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-2">
            <Users size={24} className="text-blue-400" />
            老師控制台
          </h1>
          <p className="text-xs text-gray-500 mt-1">即時監看學生練習狀態</p>
          
          {/* 教室選擇 */}
          <div className="mt-4 relative">
            <button
              onClick={() => setShowClassroomDropdown(!showClassroomDropdown)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <School size={16} className="text-indigo-400" />
                {selectedClassroom ? selectedClassroom.name : '選擇教室'}
              </span>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${showClassroomDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showClassroomDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                {classrooms.map(classroom => (
                  <button
                    key={classroom.id}
                    onClick={() => { setSelectedClassroom(classroom); setShowClassroomDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-600 transition-colors ${
                      selectedClassroom?.id === classroom.id ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{classroom.name}</span>
                      <span className="text-xs text-gray-500">{classroom.studentCount}人</span>
                    </div>
                  </button>
                ))}
                {classrooms.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-500">尚無教室</p>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={handleStartClassroomTimer}
            className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                <Clock size={16} className="text-cyan-300" />
                教室倒數
              </span>
              {classroomTimer && (
                <span className={`text-xs font-bold ${classroomTimerActive ? 'text-cyan-300' : 'text-red-300'}`}>
                  {classroomTimerActive ? formatCountdown(classroomTimerRemainingMs) : '時間到'}
                </span>
              )}
            </div>

            <input
              value={timerTitle}
              onChange={(e) => setTimerTitle(e.target.value)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-cyan-500"
              placeholder="倒數名稱，例如：小練習"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="number"
                min={1}
                max={600}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(e.target.value)}
                className="min-w-0 rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-cyan-500"
                placeholder="分鐘"
              />
              <button
                type="submit"
                disabled={!selectedClassroom || isUpdatingTimer}
                className="rounded bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white"
              >
                開始
              </button>
            </div>

            {classroomTimer && (
              <div className={`rounded border px-2 py-1.5 text-xs ${
                classroomTimerFinished
                  ? 'border-red-500/40 bg-red-900/30 text-red-200'
                  : 'border-cyan-500/30 bg-cyan-900/20 text-cyan-100'
              }`}>
                <div className="font-semibold truncate">{classroomTimer.title}</div>
                <div className="mt-0.5 text-[11px] opacity-80">
                  {classroomTimerFinished ? '已結束，學生端仍會看到時間到提示。' : `剩餘 ${formatCountdown(classroomTimerRemainingMs)}`}
                </div>
                <button
                  type="button"
                  onClick={handleClearClassroomTimer}
                  disabled={isUpdatingTimer}
                  className="mt-2 w-full rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-200 hover:bg-gray-700 disabled:opacity-50"
                >
                  清除倒數
                </button>
              </div>
            )}
          </form>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => { setActiveTab('monitor'); setSelectedStudentId(null); setViewingSubmission(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <LayoutGrid size={20} />
            即時監看
          </button>
          <button
            onClick={() => { setActiveTab('assignments'); setSelectedStudentId(null); setViewingSubmission(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'assignments' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <CheckSquare size={20} />
            作業管理
          </button>
          <button
            onClick={() => { setActiveTab('students'); setSelectedStudentId(null); setViewingSubmission(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'students' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <UserPlus size={20} />
            學生管理
          </button>
          <button
            onClick={() => { setActiveTab('notes'); setSelectedStudentId(null); setViewingSubmission(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'notes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <BookOpen size={20} />
            課堂筆記
          </button>
          <button
            onClick={() => { setActiveTab('classrooms'); setSelectedStudentId(null); setViewingSubmission(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'classrooms' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <School size={20} />
            教室管理
          </button>
        </nav>

        {/* 統計資訊 */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">在線學生</span>
            <span className="text-green-400 font-bold">{students.filter(s => s.isOnline).length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">目前學生</span>
            <span className="text-gray-300 font-bold">{filteredStudents.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">開放作業</span>
            <span className="text-blue-400 font-bold">{assignments.filter(a => a.isOpen).length}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* ===================== 即時監看 ===================== */}
        {activeTab === 'monitor' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Student List / Grid */}
            <div className={`flex-1 overflow-y-auto p-6 ${selectedStudentId ? 'hidden lg:block lg:w-1/3 lg:flex-none border-r border-gray-700' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                學生監看 ({filteredStudents.length})
                {selectedClassroom && <span className="text-sm font-normal text-indigo-400">- {selectedClassroom.name}</span>}
              </h2>
              
              {filteredStudents.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <Users size={48} className="mx-auto mb-4 opacity-30" />
                  <p>目前沒有學生資料</p>
                  <p className="text-sm mt-2">請先新增學生，或切換到其他教室。</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredStudents.map(student => (
                    <div 
                      key={student.id}
                      onClick={() => {
                        setSelectedStudentId(student.id);
                        setAiAnalysis(null);
                        setViewingSubmission(null);
                        setExecutionResult(null);
                      }}
                      className={`cursor-pointer group relative bg-gray-800 rounded-xl border-2 transition-all p-4 hover:shadow-xl ${
                        student.handRaised
                          ? 'border-yellow-400 bg-yellow-900/30 shadow-lg shadow-yellow-500/20'
                          : selectedStudentId === student.id
                            ? 'border-blue-500 bg-gray-800/80'
                            : 'border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      {student.handRaised && (
                        <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-1 text-xs font-bold text-gray-950 shadow-lg">
                          <AlertCircle size={12} />
                          舉手
                        </div>
                      )}
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${student.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                          <h3 className="font-bold text-lg">{student.name}</h3>
                        </div>
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 uppercase font-mono">{student.currentLanguage}</span>
                      </div>
                      
                      {/* Code Preview */}
                      <div className="h-28 bg-[#1e1e1e] rounded overflow-hidden p-2 text-[9px] text-gray-400 font-mono leading-tight select-none opacity-70 group-hover:opacity-100 transition-opacity">
                        <pre className="whitespace-pre-wrap break-all">
                          {student.currentCode.slice(0, 250)}
                          {student.currentCode.length > 250 && '...'}
                        </pre>
                      </div>
                      
                      {/* Submission indicator */}
                      {student.submissions.length > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded-full">
                          <CheckSquare size={12} />
                          {student.submissions.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detailed Student View */}
            {selectedStudent && (
              <div className="flex-1 flex flex-col bg-[#1e1e1e] w-full absolute lg:relative z-10 h-full">
                {/* Header */}
                <div className="h-16 bg-gray-800 border-b border-gray-700 flex justify-between items-center px-6 shrink-0">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedStudentId(null)} className="lg:hidden text-gray-400 hover:text-white">
                      返回列表
                    </button>
                    <span className={`w-2 h-2 rounded-full ${selectedStudent.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                    <span className="font-bold text-xl">{selectedStudent.name}</span>
                    {selectedStudent.handRaised && (
                      <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 border border-yellow-400 px-2 py-1 text-xs font-bold text-yellow-300">
                        <AlertCircle size={12} />
                        正在舉手
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedStudent.handRaised && (
                      <button
                        onClick={() => handleClearHelpRequest(selectedStudent.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-yellow-600 hover:bg-yellow-700 text-white transition-all"
                      >
                        <AlertCircle size={16} />
                        已處理
                      </button>
                    )}
                    <button 
                      onClick={handleExecuteCode}
                      disabled={isExecuting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all"
                    >
                      {isExecuting ? <Loader2 className="animate-spin" size={16}/> : <Play size={16}/>}
                      執行
                    </button>
                    <button 
                      onClick={handleAnalyzeCode}
                      disabled={isAnalyzing}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                        viewingSubmission ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'
                      } disabled:opacity-50`}
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                      AI 分析
                    </button>
                  </div>
                </div>

                {/* Split: Code & Feedback */}
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 border-r border-gray-700 flex flex-col">
                    {/* Viewing State Banner */}
                    {viewingSubmission ? (
                      <div className="bg-amber-900/40 border-b border-amber-700/50 p-2 px-4 flex justify-between items-center text-amber-200 text-xs shadow-md z-10 shrink-0">
                        <span className="flex items-center gap-2">
                          <Clock size={14} />
                          <strong>正在查看提交：</strong>
                          {assignments.find(a => a.id === viewingSubmission.assignmentId)?.title || '未命名作業'}
                        </span>
                        <button 
                          onClick={() => setViewingSubmission(null)} 
                          className="flex items-center gap-1 hover:text-white underline"
                        >
                          <RotateCcw size={12} /> 回到即時畫面
                        </button>
                      </div>
                    ) : (
                      <div className="bg-blue-900/20 border-b border-blue-900/30 p-1.5 px-4 text-blue-300/70 text-xs flex justify-between shrink-0">
                        <span>語言：{selectedStudent.currentLanguage}</span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/> 即時
                        </span>
                      </div>
                    )}

                    <div className="flex-1 overflow-hidden">
                      <CodeEditor 
                        code={viewingSubmission ? viewingSubmission.code : selectedStudent.currentCode} 
                        onChange={() => {}} 
                        language={viewingSubmission?.language || selectedStudent.currentLanguage}
                        readOnly={true}
                      />
                    </div>

                    {/* Execution Result */}
                    {executionResult && (
                      <div className="h-32 bg-gray-900 border-t border-gray-700 p-3 overflow-auto shrink-0">
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                          <Terminal size={14} />
                          執行結果
                        </div>
                        {executionResult.error ? (
                          <pre className="text-red-400 text-sm font-mono whitespace-pre-wrap">{executionResult.error}</pre>
                        ) : (
                          <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">{executionResult.output || '(沒有輸出)'}</pre>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Right Panel */}
                  <div className="w-80 bg-gray-800 flex flex-col shrink-0">
                    {/* AI Analysis */}
                    {aiAnalysis && (
                      <div className="p-4 border-b border-gray-700 bg-purple-900/10 shrink-0">
                        <h4 className="text-purple-400 text-sm font-bold mb-2 flex items-center gap-1">
                          <Sparkles size={14}/> AI 分析
                        </h4>
                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
                      </div>
                    )}

                    {/* Submissions */}
                    <div className="p-4 border-b border-gray-700 flex-1 overflow-hidden flex flex-col max-h-[35%]">
                      <h3 className="font-bold text-gray-300 mb-2 flex items-center gap-2 shrink-0">
                        <CheckSquare size={16}/> 作業提交
                      </h3>
                      <div className="space-y-2 overflow-y-auto flex-1">
                        {selectedStudent.submissions.length === 0 && (
                          <span className="text-xs text-gray-500">尚無提交</span>
                        )}
                        {[...selectedStudent.submissions].reverse().map((sub, idx) => {
                          const assignment = assignments.find(a => a.id === sub.assignmentId);
                          const isViewing = viewingSubmission?.timestamp === sub.timestamp;
                          return (
                            <div 
                              key={idx} 
                              className={`p-2 rounded text-xs border transition-all flex justify-between items-center ${
                                isViewing ? 'bg-amber-900/30 border-amber-500' : 'bg-gray-700/50 border-transparent hover:bg-gray-700'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold truncate ${isViewing ? 'text-amber-300' : 'text-blue-300'}`}>
                                  {assignment?.title || '未命名作業'}
                                </p>
                                <p className="text-gray-400">{formatDate(sub.timestamp)}</p>
                              </div>
                              <button 
                                onClick={() => setViewingSubmission(sub)}
                                className="ml-2 p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-600"
                              >
                                <Eye size={16} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Feedback */}
                    <div className="flex-1 flex flex-col p-4 border-t border-gray-700 overflow-hidden">
                      <div className="flex items-center justify-between mb-2 shrink-0">
                        <h3 className="font-bold text-gray-300 flex items-center gap-2">
                          <MessageSquare size={16}/> 師生對話
                        </h3>
                        {selectedStudent.feedbacks.length > 0 && (
                          <button
                            onClick={() => {
                              if (window.confirm('確定要清除這位學生的所有對話嗎？')) {
                                emitClearFeedback(selectedStudent.id);
                              }
                            }}
                            className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1"
                            title="清除對話"
                          >
                            <Trash2 size={12} /> 清除
                          </button>
                        )}
                      </div>
                                    <div className="flex-1 bg-gray-900 rounded-lg p-2 mb-2 overflow-y-auto">
                        {selectedStudent.feedbacks.length === 0 && (
                          <span className="text-xs text-gray-600">尚無對話</span>
                        )}
                        {selectedStudent.feedbacks.map(fb => (
                          <div 
                            key={fb.id} 
                            className={`mb-2 p-2 rounded border text-sm max-w-[90%] ${
                              fb.fromTeacher 
                                ? 'bg-blue-900/20 border-blue-900/50 ml-auto' 
                                : 'bg-green-900/20 border-green-900/50 mr-auto'
                            }`}
                          >
                            <div className="flex items-center gap-1 mb-1 text-[10px] opacity-60">
                              {fb.fromTeacher ? '老師' : '學生'}
                            </div>
                            <p className="text-gray-300">{fb.message}</p>
                            <p className="text-[10px] text-gray-500 text-right mt-1">
                              {new Date(fb.timestamp).toLocaleTimeString('zh-TW')}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <input 
                          type="text"
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder="輸入訊息..."
                          className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && handleSendFeedback()}
                        />
                        <button 
                          onClick={handleSendFeedback}
                          disabled={!feedbackInput.trim()}
                          className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== 作業管理 ===================== */}
        {activeTab === 'assignments' && (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {/* Create Assignment */}
              <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                  <FilePlus size={24}/> 新增作業
                  {selectedClassroom && <span className="text-sm font-normal text-indigo-400">- 發布到 {selectedClassroom.name}</span>}
                </h2>
                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">作業標題 *</label>
                    <input 
                      type="text" 
                      value={newAssignmentTitle}
                      onChange={(e) => setNewAssignmentTitle(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-blue-500 outline-none"
                      placeholder="例如：Python 迴圈練習"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">作業說明</label>
                    <textarea 
                      value={newAssignmentDesc}
                      onChange={(e) => setNewAssignmentDesc(e.target.value)}
                      className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-blue-500 outline-none resize-none"
                      placeholder="請輸入題目、規則或補充說明..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-2">
                      <Calendar size={14} /> 截止時間（可選）
                    </label>
                    <input 
                      type="datetime-local" 
                      value={newAssignmentDueDate}
                      onChange={(e) => setNewAssignmentDueDate(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isCreatingAssignment}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                    >
                      {isCreatingAssignment && <Loader2 className="animate-spin" size={18} />}
                      新增作業
                    </button>
                  </div>
                </form>
              </div>

              {/* Assignment List */}
              <h3 className="text-xl font-bold mb-4 text-gray-300">
                目前作業 ({filteredAssignments.length})
                {selectedClassroom && <span className="text-sm font-normal text-indigo-400 ml-2">- {selectedClassroom.name}</span>}
              </h3>
              {filteredAssignments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckSquare size={48} className="mx-auto mb-4 opacity-30" />
                  <p>目前沒有作業</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssignments.map(assign => {
                    const overdue = isOverdue(assign.dueDate);
                    
                    return (
                      <div key={assign.id} className={`group/card bg-gray-800 rounded-xl border overflow-hidden ${
                        !assign.isOpen ? 'border-gray-700 opacity-60' : overdue ? 'border-red-700/50' : 'border-gray-700'
                      }`}>
                        <div className="p-4 flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-bold text-lg">{assign.title}</h4>
                              {!assign.isOpen && <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">已關閉</span>}
                              {assign.isOpen && overdue && (
                                <span className="text-xs bg-red-900/50 text-red-400 px-2 py-1 rounded flex items-center gap-1">
                                  <AlertCircle size={12} /> 已截止
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm whitespace-pre-wrap mb-2">{assign.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>建立：{formatDate(assign.createdAt)}</span>
                              {editingDueDateId === assign.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="datetime-local"
                                    value={editingDueDateValue}
                                    onChange={(e) => setEditingDueDateValue(e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none"
                                  />
                                  <button
                                    onClick={() => handleSaveDueDate(assign.id)}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-900/30 text-green-400 hover:bg-green-900/50"
                                    title="儲存"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={() => setEditingDueDateId(null)}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-700 text-gray-400 hover:bg-gray-600"
                                    title="取消"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartEditDueDate(assign)}
                                  className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                                  title="修改截止時間"
                                >
                                  <Calendar size={12} />
                                  {assign.dueDate ? (
                                    <span className={overdue ? 'text-red-400' : ''}>
                                      截止：{formatDate(assign.dueDate)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-600">設定截止時間</span>
                                  )}
                                  <Pencil size={10} className="opacity-0 group-hover/card:opacity-100" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-4 ml-4">
                            <div className="text-center bg-gray-900 p-3 rounded-lg border border-gray-700 min-w-[100px]">
                              <div className="text-2xl font-bold text-blue-400">{assign.submissionCount} / {assign.totalStudents}</div>
                              <div className="text-xs text-gray-500 uppercase font-bold">提交</div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleToggleAssignment(assign.id)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs ${
                                  assign.isOpen 
                                    ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50' 
                                    : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                                }`}
                              >
                                {assign.isOpen ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                {assign.isOpen ? '關閉' : '開放'}
                              </button>
                              <button
                                onClick={() => handleDeleteAssignment(assign.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50"
                              >
                                <Trash2 size={14} /> 刪除
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Submitters */}
                        {assign.submitters.length > 0 && (
                          <div className="bg-gray-900/50 p-3 border-t border-gray-700">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">已提交學生</p>
                            <div className="flex flex-wrap gap-2">
                              {assign.submitters.map((submitter, idx) => {
                                const student = students.find(s => s.id === submitter.studentId);
                                const submission = student?.submissions.find(s => s.assignmentId === assign.id);
                                if (!submission) return null;

                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => jumpToSubmission(submitter.studentId, submission)}
                                    className="flex items-center gap-2 bg-gray-800 hover:bg-blue-900/40 border border-gray-600 hover:border-blue-500 rounded-full pl-3 pr-2 py-1 text-sm transition-all group"
                                  >
                                    <span>{submitter.studentName}</span>
                                    <span className="bg-gray-700 group-hover:bg-blue-600 p-1 rounded-full">
                                      <ExternalLink size={12}/>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== 學生管理 ===================== */}
        {activeTab === 'notes' && (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-3">
                    <BookOpen size={28} />
                    課堂筆記
                  </h2>
                  <p className="mt-2 text-sm text-gray-400">建立給整間教室看的 Markdown 筆記。學生只能閱讀，不能修改。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleCreateNoteFolder} disabled={!selectedClassroom} className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50">
                    <FolderPlus size={16} /> 新增資料夾
                  </button>
                  <button onClick={handleCreateNote} disabled={!selectedClassroom} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">
                    <FileText size={16} /> 新增筆記
                  </button>
                </div>
              </div>

              {!selectedClassroom ? (
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-400">請先選擇教室。</div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
                  <div className="flex min-h-[420px] flex-col rounded-xl border border-gray-700 bg-gray-800 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-300">檔案樹</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNoteId(null);
                          setSelectedNoteFolderId(null);
                        }}
                        className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                          !selectedNoteFolderId && !selectedNoteId
                            ? 'bg-blue-900/40 text-blue-100'
                            : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        根目錄
                      </button>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button onClick={handleCreateNoteFolder} disabled={!selectedClassroom} className="flex items-center justify-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50">
                        <FolderPlus size={15} /> 資料夾
                      </button>
                      <button onClick={handleCreateNote} disabled={!selectedClassroom} className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">
                        <FileText size={15} /> 筆記
                      </button>
                    </div>

                    <button
                      onClick={handleDeleteNoteFolder}
                      disabled={!selectedNoteFolderId}
                      className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200 hover:bg-red-900/60 disabled:opacity-40"
                      title="刪除選取的老師資料夾"
                    >
                      <Trash2 size={15} />
                      刪除選取資料夾
                    </button>

                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/35 p-2">
                      {isLoadingNotes && <p className="px-2 py-3 text-sm text-gray-500">讀取筆記中...</p>}
                      {!isLoadingNotes && noteFolders.length === 0 && notes.length === 0 && (
                        <p className="rounded border border-dashed border-gray-700 py-6 text-center text-sm text-gray-500">目前沒有筆記</p>
                      )}
                      {!isLoadingNotes && noteTreeFolders.map(folder => renderTeacherNoteFolderNode(folder))}
                      {!isLoadingNotes && noteTreeRootNotes.map(note => renderTeacherNoteRow(note))}
                    </div>
                    <p className="mt-3 text-xs text-gray-500">選取資料夾後新增的資料夾或筆記會建立在該位置。</p>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
                    {selectedNote ? (
                      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-2">
                        <div className="flex min-h-0 flex-col border-b border-gray-700 lg:border-b-0 lg:border-r">
                          <div className="space-y-3 border-b border-gray-700 p-4">
                            <div className="flex gap-2">
                              <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="檔名，例如 lesson-01.md" />
                              <button onClick={handleSaveNote} disabled={isSavingNote || !noteTitle.trim()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                                {isSavingNote ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} 儲存
                              </button>
                              <button onClick={() => handleDeleteNote(selectedNote)} className="rounded-lg bg-red-900/40 px-3 py-2 text-red-200 hover:bg-red-900/60" title="刪除筆記">
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <select value={selectedNoteFolderId || ''} onChange={(e) => setSelectedNoteFolderId(e.target.value || null)} className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-blue-500">
                              <option value="">根目錄</option>
                              {noteFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                            </select>
                          </div>
                          <div className="min-h-0 flex-1">
                            <CodeEditor code={noteContent} onChange={setNoteContent} language="markdown" height="100%" />
                          </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto p-5">
                          <div className="mb-3 flex items-center justify-between border-b border-gray-700 pb-3">
                            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><BookOpen size={16} />學生看到的預覽</span>
                            <span className="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200">唯讀</span>
                          </div>
                          <div className="ai-markdown prose prose-invert max-w-none text-sm text-gray-200">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[420px] items-center justify-center p-8 text-center text-gray-500">
                        <div><BookOpen size={44} className="mx-auto mb-4 opacity-40" /><p>選一份筆記，或新增一個 Markdown 檔案。</p></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              {/* Add Student */}
              <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
                  <UserPlus size={24}/> 新增學生
                </h2>
                <form onSubmit={handleAddNewStudent} className="flex gap-4">
                  <input 
                    type="text" 
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-green-500 outline-none"
                    placeholder="輸入學生姓名"
                    required
                  />
                  <button 
                    type="submit"
                    disabled={isCreatingStudent}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                  >
                    {isCreatingStudent && <Loader2 className="animate-spin" size={18} />}
                    <UserPlus size={18} /> 新增
                  </button>
                </form>
              </div>

              {/* Student List */}
              <h3 className="text-xl font-bold mb-4 text-gray-300">
                學生列表 ({filteredStudents.length})
                {selectedClassroom && <span className="text-sm font-normal text-indigo-400 ml-2">- {selectedClassroom.name}</span>}
              </h3>
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users size={48} className="mx-auto mb-4 opacity-30" />
                  <p>目前沒有學生資料</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStudents.map((student, index) => (
                    <div 
                      key={student.id} 
                      className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-between hover:border-gray-600"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{student.name}</span>
                            {student.isOnline && (
                              <span className="flex items-center gap-1 text-xs text-green-400">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                在線
                              </span>
                            )}
                            {!student.isPasswordSet && (
                              <span className="text-xs text-yellow-400">(尚未設定密碼)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span>語言：{student.currentLanguage}</span>
                            <span>提交：{student.submissions.length}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedStudentId(student.id);
                            setActiveTab('monitor');
                          }}
                          className="p-2 bg-blue-900/30 text-blue-400 rounded-lg hover:bg-blue-900/50"
                          title="查看即時畫面"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleResetPassword(student.id)}
                          className="p-2 bg-yellow-900/30 text-yellow-400 rounded-lg hover:bg-yellow-900/50"
                          title="重設密碼"
                        >
                          <Key size={18} />
                        </button>
                        <button
                          onClick={() => handleRemoveStudent(student.id)}
                          className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50"
                          title="刪除學生"
                        >
                          <UserMinus size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== 教室管理 ===================== */}
        {activeTab === 'classrooms' && (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-blue-400">
                <School size={28} />
                教室管理
              </h2>
              <p className="text-gray-400 mb-6">
                建立與管理教室。學生與作業會依教室分組，老師可從左上角切換目前監看的教室。
              </p>
              
              <ClassroomManager
                selectedClassroomId={selectedClassroom?.id || null}
                onSelectClassroom={(classroom) => {
                  setSelectedClassroom(classroom);
                  // 更新教室列表
                  classroomApi.getAll().then(result => {
                    setClassrooms(result.classrooms || []);
                  });
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
