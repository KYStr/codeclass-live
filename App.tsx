import React, { useState, useEffect, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import { healthCheck, studentApi, assignmentApi, StudentData, AssignmentData } from './services/api';
import { 
  connectSocket, 
  disconnectSocket, 
  teacherJoin, 
  studentJoin,
  onStudentCodeUpdate,
  onStudentOnline,
  onStudentOffline,
  onStudentHelpRequest,
  onStudentHelpCleared,
  onStudentHelpStatus,
  onClassroomTimerUpdated,
  onNewFeedback,
  onUnreadFeedback,
  onStudentsSync,
  onStudentCreated,
  onStudentDeleted,
  onAssignmentCreated,
  onAssignmentToggled,
  onAssignmentDeleted,
  onNewSubmission,
  onCodeResult,
  onFeedbackUpdated,
  onStudentMessageNew,
  onFeedbackCleared
} from './services/socket';

interface User {
  id: string;
  name: string;
  role: 'teacher' | 'student';
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [students, setStudents] = useState<StudentData[]>([]);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [currentStudent, setCurrentStudent] = useState<StudentData | null>(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        await healthCheck();
        setServerOnline(true);
      } catch {
        setServerOnline(false);
      } finally {
        setLoading(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 30000);
    return () => clearInterval(interval);
  }, []);

  // 載入初始資料
  const loadData = useCallback(async () => {
    if (!serverOnline || !user) return;

    try {
      const [studentsData, assignmentsData] = await Promise.all([
        studentApi.getAll(),
        assignmentApi.getAll()
      ]);
      setStudents(studentsData);
      setAssignments(assignmentsData);

      // 如果目前登入的是學生，更新自己的資料。
      if (user.role === 'student') {
        const student = studentsData.find(s => s.id === user.id);
        if (student) setCurrentStudent(student);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, [serverOnline, user]);

  useEffect(() => {
    if (!user || !serverOnline) return;

    connectSocket();
    loadData();

    if (user.role === 'teacher') {
      teacherJoin();
    } else {
      studentJoin(user.id);
    }

    return () => {
      disconnectSocket();
    };
  }, [user, serverOnline, loadData]);

  useEffect(() => {
    if (!user || user.role !== 'teacher') return;

    const unsubscribers: (() => void)[] = [];

    // 學生程式碼更新
    unsubscribers.push(onStudentCodeUpdate((data) => {
      console.log('收到學生程式碼更新:', {
        studentId: data.studentId.slice(0, 8) + '...',
        codeLength: data.code.length,
        language: data.language
      });
      setStudents(prev => prev.map(s => 
        s.id === data.studentId 
          ? { ...s, currentCode: data.code, currentLanguage: data.language, lastActive: data.lastActive }
          : s
      ));
    }));
    // 學生上線
    unsubscribers.push(onStudentOnline((data) => {
      setStudents(prev => prev.map(s => 
        s.id === data.studentId ? { ...s, isOnline: true } : s
      ));
    }));

    // 學生離線
    unsubscribers.push(onStudentOffline((data) => {
      setStudents(prev => prev.map(s => 
        s.id === data.studentId ? { ...s, isOnline: false } : s
      ));
    }));

    unsubscribers.push(onStudentsSync(() => {
      loadData();
    }));

    unsubscribers.push(onStudentHelpRequest((data) => {
      setStudents(prev => prev.map(s =>
        s.id === data.studentId
          ? { ...s, handRaised: true, handRaisedAt: data.handRaisedAt }
          : s
      ));
    }));

    unsubscribers.push(onStudentHelpCleared((data) => {
      setStudents(prev => prev.map(s =>
        s.id === data.studentId
          ? { ...s, handRaised: false, handRaisedAt: null }
          : s
      ));
    }));

    unsubscribers.push(onClassroomTimerUpdated((data) => {
      setStudents(prev => prev.map(s =>
        s.classroomId === data.classroomId
          ? { ...s, classroomTimer: data.timer }
          : s
      ));
    }));

    // 學生建立
    unsubscribers.push(onStudentCreated(() => {
      loadData();
    }));

    // 學生刪除
    unsubscribers.push(onStudentDeleted((data) => {
      setStudents(prev => prev.filter(s => s.id !== data.studentId));
    }));

    unsubscribers.push(onNewSubmission((data) => {
      setStudents(prev => prev.map(s => 
        s.id === data.studentId 
          ? { ...s, submissions: [...s.submissions, data.submission] }
          : s
      ));
      loadData();
    }));

    unsubscribers.push(onFeedbackUpdated((data) => {
      setStudents(prev => prev.map(s => 
        s.id === data.studentId 
          ? { ...s, feedbacks: [...s.feedbacks, data.feedback] }
          : s
      ));
    }));

    // 學生回覆老師
    unsubscribers.push(onStudentMessageNew((data) => {
      setStudents(prev => prev.map(s => 
        s.id === data.studentId 
          ? { ...s, feedbacks: [...s.feedbacks, data.feedback] }
          : s
      ));
    }));

    // 對話清空
    unsubscribers.push(onFeedbackCleared((data) => {
      // 更新學生列表中的對話狀態
      setStudents(prev => prev.map(s => 
        s.id === data.studentId 
          ? { ...s, feedbacks: [] }
          : s
      ));
    }));

    // 作業相關事件
    unsubscribers.push(onAssignmentCreated(() => loadData()));
    unsubscribers.push(onAssignmentToggled(() => loadData()));
    unsubscribers.push(onAssignmentDeleted(() => loadData()));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, loadData]);

  // Socket 事件監聽：學生端
  useEffect(() => {
    if (!user || user.role !== 'student') return;

    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(onNewFeedback((feedback) => {
      setCurrentStudent(prev => prev ? {
        ...prev,
        feedbacks: [...prev.feedbacks, feedback]
      } : null);
    }));

    unsubscribers.push(onFeedbackCleared((data) => {
      setCurrentStudent(prev => 
        prev && prev.id === data.studentId 
          ? { ...prev, feedbacks: [] }
          : prev
      );
    }));

    unsubscribers.push(onStudentHelpStatus((data) => {
      setCurrentStudent(prev =>
        prev && prev.id === data.studentId
          ? { ...prev, handRaised: data.handRaised, handRaisedAt: data.handRaisedAt }
          : prev
      );
    }));

    unsubscribers.push(onClassroomTimerUpdated((data) => {
      setCurrentStudent(prev =>
        prev && prev.classroomId === data.classroomId
          ? { ...prev, classroomTimer: data.timer }
          : prev
      );
    }));

    // 作業相關事件
    unsubscribers.push(onUnreadFeedback((feedbacks) => {
      setCurrentStudent(prev => {
        if (!prev) return null;
        const existingIds = new Set(prev.feedbacks.map(feedback => feedback.id));
        const newFeedbacks = feedbacks.filter(feedback => !existingIds.has(feedback.id));
        return newFeedbacks.length > 0
          ? { ...prev, feedbacks: [...prev.feedbacks, ...newFeedbacks] }
          : prev;
      });
    }));

    unsubscribers.push(onAssignmentCreated(() => loadData()));
    unsubscribers.push(onAssignmentToggled(() => loadData()));
    unsubscribers.push(onAssignmentDeleted(() => loadData()));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, loadData]);

  // 處理登入
  const handleTeacherLogin = (userId: string, userName: string) => {
    setUser({ id: userId, name: userName, role: 'teacher' });
  };

  const handleStudentLogin = (userId: string, userName: string) => {
    setUser({ id: userId, name: userName, role: 'student' });
  };

  // 處理登出
  const handleLogout = () => {
    disconnectSocket();
    setUser(null);
    setCurrentStudent(null);
  };

  // 更新學生資料
  const handleUpdateStudents = (updatedStudents: StudentData[]) => {
    setStudents(updatedStudents);
  };

  // 更新作業資料
  const handleUpdateAssignments = (updatedAssignments: AssignmentData[]) => {
    setAssignments(updatedAssignments);
  };

  // 更新目前學生資料
  const handleUpdateCurrentStudent = (updatedStudent: StudentData) => {
    setCurrentStudent(updatedStudent);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">正在連接伺服器...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        serverOnline={serverOnline}
        onTeacherLogin={handleTeacherLogin}
        onStudentLogin={handleStudentLogin}
      />
    );
  }

  // 老師畫面
  if (user.role === 'teacher') {
    return (
      <div className="relative">
        <button 
          onClick={handleLogout} 
          className="absolute top-4 right-4 z-50 bg-gray-800 text-xs px-4 py-2 rounded-lg border border-gray-600 hover:bg-red-900/50 hover:border-red-500 text-gray-400 hover:text-red-200 transition-all duration-200"
        >
          登出
        </button>
        <TeacherDashboard 
          students={students}
          assignments={assignments}
          onUpdateStudents={handleUpdateStudents}
          onUpdateAssignments={handleUpdateAssignments}
          onRefresh={loadData}
        />
      </div>
    );
  }

  // 學生畫面
  if (user.role === 'student' && currentStudent) {
    return (
      <div className="relative">
        <button 
          onClick={handleLogout} 
          className="hidden"
        >
          登出
        </button>
        <StudentDashboard 
          student={currentStudent}
          assignments={assignments}
          onUpdateStudent={handleUpdateCurrentStudent}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  return null;
};

export default App;
