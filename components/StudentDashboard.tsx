import React, { useState, useEffect, useRef } from 'react';
import { StudentData, AssignmentData, studentApi } from '../services/api';
import { emitCodeUpdate, emitCodeExecute, emitStudentMessage, onCodeResult } from '../services/socket';
import CodeEditor from './CodeEditor';
import { generateStudentHint } from '../services/geminiService';
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
  Users
} from 'lucide-react';

interface StudentDashboardProps {
  student: StudentData;
  assignments: AssignmentData[];
  onUpdateStudent: (updatedStudent: StudentData) => void;
}

// 防抖函數
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

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, assignments, onUpdateStudent }) => {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(true);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [hasNewFeedback, setHasNewFeedback] = useState(false);
  
  // 代碼執行狀態
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ output: string; error?: string; needsInput?: boolean } | null>(null);
  const [programInput, setProgramInput] = useState(''); // 程式輸入
  const [showInputPanel, setShowInputPanel] = useState(false);
  
  // 回覆消息
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  
  // 本地代碼狀態（用於防抖）
  const [localCode, setLocalCode] = useState(student.currentCode);
  const [localLanguage, setLocalLanguage] = useState(student.currentLanguage);
  
  // 防抖後的代碼
  const debouncedCode = useDebounce(localCode, 500);

  // 篩選開放中的作業
  const openAssignments = assignments.filter(a => a.isOpen);
  const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);

  // 滾動到最新反饋
  const feedbackEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedbackEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [student.feedbacks]);

  // 檢測新反饋
  useEffect(() => {
    const unreadCount = student.feedbacks.filter(f => !f.isRead && f.fromTeacher).length;
    if (unreadCount > 0 && !showFeedback) {
      setHasNewFeedback(true);
    }
  }, [student.feedbacks, showFeedback]);

  // 打開反饋窗口時標記為已讀
  useEffect(() => {
    if (showFeedback && hasNewFeedback) {
      setHasNewFeedback(false);
      studentApi.markFeedbackRead(student.id).catch(console.error);
      onUpdateStudent({
        ...student,
        feedbacks: student.feedbacks.map(f => ({ ...f, isRead: true }))
      });
    }
  }, [showFeedback, hasNewFeedback]);


  // 用於追蹤是否是首次渲染
  const isInitialMount = useRef(true);
  const lastSentCode = useRef(student.currentCode);
  const lastSentLanguage = useRef(student.currentLanguage);

  // 同步代碼到伺服器（防抖後）
  useEffect(() => {
    // 跳過首次渲染
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // 只有當代碼或語言實際變化時才發送
    if (debouncedCode !== lastSentCode.current || localLanguage !== lastSentLanguage.current) {
      console.log('📤 同步代碼到伺服器:', { 
        length: debouncedCode.length, 
        language: localLanguage 
      });
      
      emitCodeUpdate(student.id, debouncedCode, localLanguage);
      
      // 更新追蹤的值
      lastSentCode.current = debouncedCode;
      lastSentLanguage.current = localLanguage;
      
      // 更新本地狀態
      onUpdateStudent({
        ...student,
        currentCode: debouncedCode,
        currentLanguage: localLanguage
      });
    }
  }, [debouncedCode, localLanguage, student.id]);

  // 代碼變更（本地）
  const handleCodeChange = (newCode: string) => {
    setLocalCode(newCode);
    setExecutionResult(null);
  };

  // 語言變更
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalLanguage(e.target.value);
  };

  // 執行代碼
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
      
      // 如果需要輸入，顯示輸入面板
      if ((result as any).needsInput) {
        setShowInputPanel(true);
      }
      
      unsub();
    });
    
    emitCodeExecute(student.id, localCode, localLanguage, programInput);
    
    // 超時處理
    setTimeout(() => {
      if (isExecuting) {
        setExecutionResult({ output: '', error: '執行超時' });
        setIsExecuting(false);
      }
    }, 15000);
  };

  // 提交作業
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
        submissions: [...student.submissions, submission]
      });
      
      alert('作業已成功繳交！');
    } catch (err: any) {
      alert(err.message || '繳交失敗，請重試');
    }
  };

  // 請求 AI 提示
  const requestAiHint = async () => {
    if (!selectedAssignment) return;
    setIsGettingHint(true);
    setAiHint(null);
    
    try {
      const hint = await generateStudentHint(localCode, localLanguage, selectedAssignment.description);
      setAiHint(hint);
    } catch (err) {
      setAiHint('無法獲取 AI 提示，請稍後再試。');
    }
    
    setIsGettingHint(false);
  };

  // 發送回覆給老師
  const handleSendReply = () => {
    if (!replyMessage.trim()) return;
    
    setIsSendingReply(true);
    emitStudentMessage(student.id, replyMessage);
    
    // 樂觀更新（立即顯示）
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

  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-TW', {
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

  // 剩餘時間
  const getTimeRemaining = (dueDate?: number | null) => {
    if (!dueDate) return null;
    const diff = dueDate - Date.now();
    if (diff <= 0) return '已截止';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `剩餘 ${days} 天`;
    }
    return `剩餘 ${hours} 小時 ${minutes} 分鐘`;
  };

  const languages = [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' }
  ];

  const unreadCount = student.feedbacks.filter(f => !f.isRead && f.fromTeacher).length;

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            CodeClass Live
          </h2>
          <p className="text-sm text-gray-400 mt-1">歡迎，{student.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 作業列表 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle size={14} /> 課堂作業
            </h3>
            
            {openAssignments.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">目前沒有開放中的作業</p>
            )}
            
            {openAssignments.map(assignment => {
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

          {/* 選中作業詳情 */}
          {selectedAssignment && (
            <div className="bg-gray-700/30 p-4 rounded-xl border border-gray-600">
              <h4 className="font-bold text-blue-300 mb-2 flex items-center justify-between">
                {selectedAssignment.title}
                {hasSubmittedCurrent && (
                  <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded">已繳交</span>
                )}
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
              
              <div className="space-y-2">
                <button
                  onClick={requestAiHint}
                  disabled={isGettingHint}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-lg text-sm disabled:opacity-50"
                >
                  {isGettingHint ? <BrainCircuit className="animate-spin" size={16}/> : <Bot size={16} />}
                  {isGettingHint ? '思考中...' : '獲取 AI 提示'}
                </button>

                <button
                  onClick={handleSubmitAssignment}
                  disabled={hasSubmittedCurrent || isOverdue(selectedAssignment.dueDate)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm ${
                    hasSubmittedCurrent 
                      ? 'bg-green-600/20 text-green-400 cursor-not-allowed' 
                      : isOverdue(selectedAssignment.dueDate)
                        ? 'bg-red-600/20 text-red-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {hasSubmittedCurrent ? (
                    <><CheckCircle size={16} /> 已繳交</>
                  ) : isOverdue(selectedAssignment.dueDate) ? (
                    <><AlertCircle size={16} /> 已截止</>
                  ) : (
                    <><Send size={16} /> 繳交作業</>
                  )}
                </button>
              </div>

              {aiHint && (
                <div className="mt-3 p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg text-sm text-purple-200">
                  <strong className="block mb-1 text-purple-400 flex items-center gap-1">
                    <Bot size={14}/> AI 提示：
                  </strong>
                  <p className="whitespace-pre-wrap">{aiHint}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative bg-[#1e1e1e]">
        {/* Toolbar */}
        <div className="h-14 bg-[#252526] border-b border-gray-700 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">程式語言：</span>
            <select
              value={localLanguage}
              onChange={handleLanguageChange}
              className="bg-gray-800 text-white text-sm border border-gray-600 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {/* 程式輸入按鈕 */}
            <button
              onClick={() => setShowInputPanel(!showInputPanel)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                showInputPanel 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Keyboard size={16} />
              程式輸入
            </button>
            
            <button
              onClick={handleExecuteCode}
              disabled={isExecuting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm transition-all"
            >
              {isExecuting ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              執行
            </button>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              自動同步
            </span>
          </div>
        </div>

        {/* 程式輸入面板 */}
        {showInputPanel && (
          <div className="bg-yellow-900/20 border-b border-yellow-700/50 p-3 shrink-0">
            <div className="flex items-center gap-2 mb-2 text-sm text-yellow-300">
              <Keyboard size={16} />
              程式輸入（適用於 input() 等需要使用者輸入的程式）
            </div>
            <textarea
              value={programInput}
              onChange={(e) => setProgramInput(e.target.value)}
              placeholder="每行一個輸入值...&#10;例如：&#10;5&#10;Hello&#10;World"
              className="w-full h-20 bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm font-mono resize-none focus:border-yellow-500 outline-none"
            />
          </div>
        )}

        {/* Code Editor */}
        <div className={`flex-1 overflow-hidden ${executionResult ? 'h-[calc(100%-180px)]' : ''}`}>
          <CodeEditor
            code={localCode}
            onChange={handleCodeChange}
            language={localLanguage}
          />
        </div>

        {/* Execution Result Panel */}
        {executionResult && (
          <div className="h-36 bg-gray-900 border-t border-gray-700 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Terminal size={16} />
                執行結果
                {executionResult.needsInput && (
                  <span className="text-yellow-400 text-xs ml-2">⚠️ 需要輸入</span>
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
                <pre className="text-green-400 whitespace-pre-wrap">{executionResult.output || '(無輸出)'}</pre>
              )}
            </div>
          </div>
        )}

        {/* Floating Feedback Window */}
        {showFeedback && (
          <div className="absolute bottom-6 right-6 w-96 bg-gray-800/95 backdrop-blur border border-gray-600 rounded-xl shadow-2xl flex flex-col max-h-[500px] overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-t-xl flex justify-between items-center border-b border-gray-600 shrink-0">
              <div className="flex items-center gap-2 text-white font-medium">
                <MessageSquare size={16} className="text-blue-400" />
                課堂對話
                {student.feedbacks.length > 0 && (
                  <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">
                    {student.feedbacks.length}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setShowFeedback(false)} 
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {student.feedbacks.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={32} className="mx-auto text-gray-600 mb-2" />
                  <p className="text-gray-500 text-sm">尚無對話</p>
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

            {/* 回覆輸入框 */}
            <div className="p-3 border-t border-gray-700 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="回覆老師..."
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
          </div>
        )}

        {/* Show Feedback Button */}
        {!showFeedback && (
          <button
            onClick={() => setShowFeedback(true)}
            className="absolute bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
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
