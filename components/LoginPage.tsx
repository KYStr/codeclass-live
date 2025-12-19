import React, { useState, useEffect, useMemo } from 'react';
import { authApi, classroomApi, ClassroomData } from '../services/api';
import { User, Users, Sparkles, Lock, Eye, EyeOff, AlertCircle, Loader2, School, Search, ArrowRight, X } from 'lucide-react';

interface StudentOption {
  id: string;
  name: string;
  isPasswordSet: boolean;
  isOnline: boolean;
  classroomId?: string;
}

interface LoginPageProps {
  onTeacherLogin: (userId: string, userName: string) => void;
  onStudentLogin: (userId: string, userName: string) => void;
  serverOnline: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ onTeacherLogin, onStudentLogin, serverOnline }) => {
  const [mode, setMode] = useState<'select' | 'teacher' | 'student-classroom' | 'student-select' | 'student-password' | 'student-set-password'>('select');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomData | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 載入學生和教室列表
  useEffect(() => {
    if (serverOnline) {
      loadStudents();
      loadClassrooms();
    }
  }, [serverOnline]);

  const loadStudents = async () => {
    try {
      const data = await authApi.getStudentList();
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  const loadClassrooms = async () => {
    try {
      const result = await classroomApi.getAll();
      setClassrooms(result.classrooms || []);
    } catch (err) {
      console.error('Failed to load classrooms:', err);
    }
  };

  // 根據搜索和教室過濾學生
  const filteredStudents = useMemo(() => {
    let result = students;
    
    // 如果選擇了教室，只顯示該教室的學生
    if (selectedClassroom) {
      result = result.filter(s => s.classroomId === selectedClassroom.id);
    }
    
    // 如果有搜索詞，過濾名字
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s => s.name.toLowerCase().includes(query));
    }
    
    return result;
  }, [students, selectedClassroom, searchQuery]);

  // 根據搜索過濾教室
  const filteredClassrooms = useMemo(() => {
    if (!searchQuery.trim()) return classrooms;
    const query = searchQuery.toLowerCase().trim();
    return classrooms.filter(c => c.name.toLowerCase().includes(query));
  }, [classrooms, searchQuery]);

  // 老師登入
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authApi.teacherLogin(password);
      if (result.success) {
        onTeacherLogin(result.user.id, result.user.name);
      }
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  // 選擇學生
  const handleSelectStudent = async (student: StudentOption) => {
    setSelectedStudent(student);
    setPassword('');
    setError('');
    
    if (student.isPasswordSet) {
      setMode('student-password');
    } else {
      setMode('student-set-password');
    }
  };

  // 學生登入
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    setError('');
    setLoading(true);

    try {
      const result = await authApi.studentLogin(selectedStudent.id, password);
      if (result.success) {
        onStudentLogin(result.user.id, result.user.name);
      }
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  // 學生設置密碼
  const handleStudentSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    
    if (password.length < 4) {
      setError('密碼至少需要 4 個字符');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const result = await authApi.studentSetPassword(selectedStudent.id, password);
      if (result.success) {
        onStudentLogin(result.user.id, result.user.name);
      }
    } catch (err: any) {
      setError(err.message || '設置密碼失敗');
    } finally {
      setLoading(false);
    }
  };

  // 返回
  const handleBack = () => {
    if (mode === 'student-select') {
      setMode('student-classroom');
      setSearchQuery('');
    } else if (mode === 'student-classroom') {
      setMode('select');
      setSelectedClassroom(null);
      setSearchQuery('');
    } else {
      setMode('select');
    }
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSelectedStudent(null);
  };

  // 選擇教室
  const handleSelectClassroom = (classroom: ClassroomData | null) => {
    setSelectedClassroom(classroom);
    setSearchQuery('');
    setMode('student-select');
  };

  // 角色選擇頁面
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        {/* 背景裝飾 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-md w-full text-center space-y-8 relative z-10">
          {/* Logo */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="text-yellow-400" size={32} />
            </div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
              CodeClass Live
            </h1>
            <p className="text-gray-400 text-lg">即時程式教學輔助平台</p>
          </div>

          {/* 伺服器狀態 */}
          <div className={`flex items-center justify-center gap-2 text-sm ${serverOnline ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            {serverOnline ? '伺服器在線' : '伺服器離線 - 請稍後重試'}
          </div>

          {/* 角色選擇 */}
          <div className="grid grid-cols-2 gap-6 pt-4">
            {/* 老師入口 */}
            <button
              onClick={() => setMode('teacher')}
              disabled={!serverOnline}
              className="group relative p-8 bg-gray-800/50 backdrop-blur hover:bg-gray-800 border-2 border-gray-700 hover:border-blue-500 rounded-2xl transition-all duration-300 flex flex-col items-center gap-4 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl group-hover:scale-110 transition-transform shadow-lg">
                <Users size={36} className="text-white" />
              </div>
              <span className="font-bold text-xl text-gray-200 group-hover:text-white">老師</span>
              <span className="text-xs text-gray-500">監控與管理</span>
            </button>

            {/* 學生入口 */}
            <button
              onClick={() => setMode('student-classroom')}
              disabled={!serverOnline}
              className="group relative p-8 bg-gray-800/50 backdrop-blur hover:bg-gray-800 border-2 border-gray-700 hover:border-green-500 rounded-2xl transition-all duration-300 flex flex-col items-center gap-4 hover:scale-105 hover:shadow-xl hover:shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <div className="p-4 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl group-hover:scale-110 transition-transform shadow-lg">
                <User size={36} className="text-white" />
              </div>
              <span className="font-bold text-xl text-gray-200 group-hover:text-white">學生</span>
              <span className="text-xs text-gray-500">編寫程式碼</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 老師登入頁面
  if (mode === 'teacher') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <button onClick={handleBack} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            ← 返回
          </button>
          
          <div className="text-center">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl inline-block mb-4">
              <Users size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold">老師登入</h2>
            <p className="text-gray-400 text-sm mt-1">請輸入管理密碼</p>
          </div>

          <form onSubmit={handleTeacherLogin} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-10 focus:border-blue-500 outline-none transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : null}
              {loading ? '登入中...' : '登入'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600">
            預設密碼：admin
          </p>
        </div>
      </div>
    );
  }

  // 學生教室選擇頁面
  if (mode === 'student-classroom') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <button onClick={handleBack} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            ← 返回
          </button>
          
          <div className="text-center">
            <div className="p-4 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl inline-block mb-4">
              <School size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold">選擇教室</h2>
            <p className="text-gray-400 text-sm mt-1">請選擇您所屬的教室</p>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索教室或學生名字..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-10 focus:border-green-500 outline-none transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* 如果有搜索詞且找到學生，直接顯示學生列表 */}
          {searchQuery.trim() && filteredStudents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">找到 {filteredStudents.length} 個學生：</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 rounded-xl transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white font-bold">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-medium">{student.name}</span>
                        {!student.isPasswordSet && (
                          <span className="text-xs text-yellow-400 ml-2">(首次登入)</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-gray-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 教室列表 */}
          {(!searchQuery.trim() || filteredStudents.length === 0) && (
            <div className="space-y-2">
              {searchQuery.trim() && filteredStudents.length === 0 && (
                <p className="text-sm text-gray-400 mb-2">沒有找到學生，請選擇教室：</p>
              )}
              
              {/* 全部學生選項 */}
              <button
                onClick={() => handleSelectClassroom(null)}
                className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 rounded-xl transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white">
                    <Users size={20} />
                  </div>
                  <div>
                    <span className="font-medium">全部學生</span>
                    <p className="text-xs text-gray-500">{students.length} 人</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-gray-500" />
              </button>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredClassrooms.map(classroom => (
                  <button
                    key={classroom.id}
                    onClick={() => handleSelectClassroom(classroom)}
                    className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 rounded-xl transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white">
                        <School size={20} />
                      </div>
                      <div>
                        <span className="font-medium">{classroom.name}</span>
                        <p className="text-xs text-gray-500">{classroom.studentCount} 人</p>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-gray-500" />
                  </button>
                ))}
              </div>

              {classrooms.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  尚無教室，請直接搜索名字
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 學生選擇頁面
  if (mode === 'student-select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <button onClick={handleBack} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            ← 返回選擇教室
          </button>
          
          <div className="text-center">
            <div className="p-4 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl inline-block mb-4">
              <User size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold">選擇您的名字</h2>
            <p className="text-gray-400 text-sm mt-1">
              {selectedClassroom ? `教室：${selectedClassroom.name}` : '全部學生'}
            </p>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索名字..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-10 focus:border-green-500 outline-none transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User size={32} className="mx-auto mb-2 opacity-50" />
                <p>{searchQuery ? '沒有找到匹配的學生' : '此教室目前沒有學生'}</p>
                <p className="text-xs mt-1">請聯繫老師添加您的帳號</p>
              </div>
            ) : (
              filteredStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => handleSelectStudent(student)}
                  className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 rounded-xl transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white font-bold">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-medium">{student.name}</span>
                      {!student.isPasswordSet && (
                        <span className="text-xs text-yellow-400 ml-2">(首次登入)</span>
                      )}
                    </div>
                  </div>
                  {student.isOnline && (
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // 學生密碼輸入頁面
  if (mode === 'student-password' && selectedStudent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <button onClick={() => setMode('student-select')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            ← 返回選擇
          </button>
          
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
              {selectedStudent.name.charAt(0)}
            </div>
            <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
            <p className="text-gray-400 text-sm mt-1">請輸入您的密碼</p>
          </div>

          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-10 focus:border-green-500 outline-none transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : null}
              {loading ? '登入中...' : '登入'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 學生設置密碼頁面（首次登入）
  if (mode === 'student-set-password' && selectedStudent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <button onClick={() => setMode('student-select')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            ← 返回選擇
          </button>
          
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
              {selectedStudent.name.charAt(0)}
            </div>
            <h2 className="text-2xl font-bold">歡迎，{selectedStudent.name}！</h2>
            <p className="text-gray-400 text-sm mt-1">這是您首次登入，請設置密碼</p>
          </div>

          <form onSubmit={handleStudentSetPassword} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="設置您的密碼"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-10 focus:border-yellow-500 outline-none transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="確認密碼"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-10 focus:border-yellow-500 outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : null}
              {loading ? '設置中...' : '設置密碼並進入'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            密碼至少需要 4 個字符
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default LoginPage;

