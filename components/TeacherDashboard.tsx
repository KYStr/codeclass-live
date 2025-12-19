import React, { useState, useEffect } from 'react';
import { StudentData, AssignmentData, studentApi, assignmentApi, classroomApi, ClassroomData } from '../services/api';
import { emitFeedback, emitCodeExecute, onCodeResult, emitClearFeedback } from '../services/socket';
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
  ChevronDown
} from 'lucide-react';

interface TeacherDashboardProps {
  students: StudentData[];
  assignments: AssignmentData[];
  onUpdateStudents: (students: StudentData[]) => void;
  onUpdateAssignments: (assignments: AssignmentData[]) => void;
  onRefresh: () => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
  students, 
  assignments, 
  onUpdateStudents,
  onUpdateAssignments,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'assignments' | 'students' | 'classrooms'>('monitor');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<StudentData['submissions'][0] | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  
  // Classroom state
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomData | null>(null);
  const [showClassroomDropdown, setShowClassroomDropdown] = useState(false);
  
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
        console.error('載入教室列表失敗:', err);
      }
    };
    loadClassrooms();
  }, []);

  // 根據選擇的教室過濾學生
  const filteredStudents = selectedClassroom 
    ? students.filter(s => s.classroomId === selectedClassroom.id)
    : students;

  // 根據選擇的教室過濾作業
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

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // 發送反饋（只使用 Socket，避免重複）
  const handleSendFeedback = () => {
    if (!selectedStudent || !feedbackInput.trim()) return;

    // 只通過 Socket 發送（後端會保存並廣播）
    emitFeedback(selectedStudent.id, feedbackInput);
    setFeedbackInput('');
  };

  // 創建作業
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
        selectedClassroom?.id // 關聯到當前選擇的教室
      );
      
      onUpdateAssignments([newAssignment, ...assignments]);
      setNewAssignmentTitle('');
      setNewAssignmentDesc('');
      setNewAssignmentDueDate('');
      alert('作業已發布！');
    } catch (err) {
      console.error('Failed to create assignment:', err);
      alert('創建失敗，請重試');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  // 切換作業開放狀態
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
    if (!window.confirm('確定要刪除此作業嗎？')) return;
    
    try {
      await assignmentApi.delete(assignmentId);
      onUpdateAssignments(assignments.filter(a => a.id !== assignmentId));
    } catch (err) {
      console.error('Failed to delete assignment:', err);
    }
  };

  // 添加學生
  const handleAddNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    setIsCreatingStudent(true);
    try {
      const newStudent = await studentApi.create(
        newStudentName.trim(),
        selectedClassroom?.id // 關聯到當前選擇的教室
      );
      onUpdateStudents([...students, newStudent]);
      setNewStudentName('');
    } catch (err: any) {
      alert(err.message || '創建失敗');
    } finally {
      setIsCreatingStudent(false);
    }
  };

  // 刪除學生
  const handleRemoveStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!window.confirm(`確定要移除學生「${student.name}」嗎？`)) return;
    
    try {
      await studentApi.delete(studentId);
      onUpdateStudents(students.filter(s => s.id !== studentId));
    } catch (err) {
      console.error('Failed to delete student:', err);
    }
  };

  // 重置學生密碼
  const handleResetPassword = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!window.confirm(`確定要重置「${student.name}」的密碼嗎？`)) return;
    
    try {
      await studentApi.resetPassword(studentId);
      onUpdateStudents(students.map(s => 
        s.id === studentId ? { ...s, isPasswordSet: false } : s
      ));
      alert('密碼已重置，學生下次登入時需重新設置');
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
    
    let assignmentContext = "一般程式練習";
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

  // 執行代碼
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
    
    // 超時處理
    setTimeout(() => {
      if (isExecuting) {
        setExecutionResult({ output: '', error: '執行超時' });
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

  // 格式化時間
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 檢查是否過期
  const isOverdue = (dueDate?: number | null) => {
    if (!dueDate) return false;
    return Date.now() > dueDate;
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-2">
            <Users size={24} className="text-blue-400" />
            老師控制台
          </h1>
          <p className="text-xs text-gray-500 mt-1">管理課堂與監控學生</p>
          
          {/* 教室選擇下拉框 */}
          <div className="mt-4 relative">
            <button
              onClick={() => setShowClassroomDropdown(!showClassroomDropdown)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <School size={16} className="text-indigo-400" />
                {selectedClassroom ? selectedClassroom.name : '全部教室'}
              </span>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${showClassroomDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showClassroomDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setSelectedClassroom(null); setShowClassroomDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-600 transition-colors ${
                    !selectedClassroom ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-300'
                  }`}
                >
                  全部教室
                </button>
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
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => { setActiveTab('monitor'); setSelectedStudentId(null); setViewingSubmission(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <LayoutGrid size={20} />
            即時監控
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
            onClick={() => { setActiveTab('classrooms'); setSelectedStudentId(null); setViewingSubmission(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'classrooms' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <School size={20} />
            教室管理
          </button>
        </nav>

        {/* 統計信息 */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">在線學生</span>
            <span className="text-green-400 font-bold">{students.filter(s => s.isOnline).length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">總學生數</span>
            <span className="text-gray-300 font-bold">{filteredStudents.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">進行中作業</span>
            <span className="text-blue-400 font-bold">{assignments.filter(a => a.isOpen).length}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* ===================== 即時監控視圖 ===================== */}
        {activeTab === 'monitor' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Student List / Grid */}
            <div className={`flex-1 overflow-y-auto p-6 ${selectedStudentId ? 'hidden lg:block lg:w-1/3 lg:flex-none border-r border-gray-700' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                學生監控 ({filteredStudents.length})
                {selectedClassroom && <span className="text-sm font-normal text-indigo-400">- {selectedClassroom.name}</span>}
              </h2>
              
              {filteredStudents.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <Users size={48} className="mx-auto mb-4 opacity-30" />
                  <p>尚無學生資料</p>
                  <p className="text-sm mt-2">請前往「學生管理」新增學生</p>
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
                        selectedStudentId === student.id ? 'border-blue-500 bg-gray-800/80' : 'border-gray-700 hover:border-gray-500'
                      }`}
                    >
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
                      ← 返回
                    </button>
                    <span className={`w-2 h-2 rounded-full ${selectedStudent.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                    <span className="font-bold text-xl">{selectedStudent.name}</span>
                  </div>
                  <div className="flex gap-2">
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
                          <strong>快照模式：</strong> 
                          正在查看「{assignments.find(a => a.id === viewingSubmission.assignmentId)?.title}」
                        </span>
                        <button 
                          onClick={() => setViewingSubmission(null)} 
                          className="flex items-center gap-1 hover:text-white underline"
                        >
                          <RotateCcw size={12} /> 返回即時
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
                          <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">{executionResult.output || '(無輸出)'}</pre>
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
                                  {assignment?.title || '未知作業'}
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
                          <MessageSquare size={16}/> 即時留言
                        </h3>
                        {selectedStudent.feedbacks.length > 0 && (
                          <button
                            onClick={() => {
                              if (window.confirm('確定要清空所有對話嗎？此操作無法復原。')) {
                                emitClearFeedback(selectedStudent.id);
                              }
                            }}
                            className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1"
                            title="清空對話"
                          >
                            <Trash2 size={12} /> 清空
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
                              {fb.fromTeacher ? '👨‍🏫 我' : '👨‍🎓 學生'}
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
                          placeholder="輸入留言..."
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

        {/* ===================== 作業管理視圖 ===================== */}
        {activeTab === 'assignments' && (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {/* Create Assignment */}
              <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                  <FilePlus size={24}/> 發布新作業
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
                      placeholder="請說明作業要求..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-2">
                      <Calendar size={14} /> 截止日期（選填）
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
                      發布作業
                    </button>
                  </div>
                </form>
              </div>

              {/* Assignment List */}
              <h3 className="text-xl font-bold mb-4 text-gray-300">
                所有作業 ({filteredAssignments.length})
                {selectedClassroom && <span className="text-sm font-normal text-indigo-400 ml-2">- {selectedClassroom.name}</span>}
              </h3>
              {filteredAssignments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckSquare size={48} className="mx-auto mb-4 opacity-30" />
                  <p>尚未發布任何作業</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssignments.map(assign => {
                    const overdue = isOverdue(assign.dueDate);
                    
                    return (
                      <div key={assign.id} className={`bg-gray-800 rounded-xl border overflow-hidden ${
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
                              <span>建立於：{formatDate(assign.createdAt)}</span>
                              {assign.dueDate && (
                                <span className={overdue ? 'text-red-400' : ''}>
                                  截止：{formatDate(assign.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-4 ml-4">
                            <div className="text-center bg-gray-900 p-3 rounded-lg border border-gray-700 min-w-[100px]">
                              <div className="text-2xl font-bold text-blue-400">{assign.submissionCount} / {assign.totalStudents}</div>
                              <div className="text-xs text-gray-500 uppercase font-bold">已繳交</div>
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
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">已繳交學生：</p>
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

        {/* ===================== 學生管理視圖 ===================== */}
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
                學生名單 ({filteredStudents.length})
                {selectedClassroom && <span className="text-sm font-normal text-indigo-400 ml-2">- {selectedClassroom.name}</span>}
              </h3>
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users size={48} className="mx-auto mb-4 opacity-30" />
                  <p>尚無學生資料</p>
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
                              <span className="text-xs text-yellow-400">(未設密碼)</span>
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
                          title="查看詳情"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleResetPassword(student.id)}
                          className="p-2 bg-yellow-900/30 text-yellow-400 rounded-lg hover:bg-yellow-900/50"
                          title="重置密碼"
                        >
                          <Key size={18} />
                        </button>
                        <button
                          onClick={() => handleRemoveStudent(student.id)}
                          className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50"
                          title="移除學生"
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

        {/* ===================== 教室管理視圖 ===================== */}
        {activeTab === 'classrooms' && (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-blue-400">
                <School size={28} />
                教室管理
              </h2>
              <p className="text-gray-400 mb-6">
                創建不同的教室來管理不同班級的學生和作業。每個教室可以有獨立的學生名單和作業。
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
