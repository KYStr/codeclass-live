import React, { useState, useEffect } from 'react';
import { 
  School, Plus, Edit2, Trash2, Users, FileText, 
  ChevronRight, X, Check, ArrowLeft 
} from 'lucide-react';
import { classroomApi, ClassroomData, StudentData, AssignmentData } from '../services/api';

interface ClassroomManagerProps {
  onSelectClassroom: (classroom: ClassroomData | null) => void;
  selectedClassroomId: string | null;
}

export default function ClassroomManager({ onSelectClassroom, selectedClassroomId }: ClassroomManagerProps) {
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<ClassroomData | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState('');

  // 載入教室列表
  const loadClassrooms = async () => {
    try {
      setIsLoading(true);
      const result = await classroomApi.getAll();
      setClassrooms(result.classrooms || []);
    } catch (err) {
      console.error('載入教室失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClassrooms();
  }, []);

  // 創建教室
  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('請輸入教室名稱');
      return;
    }
    
    try {
      const result = await classroomApi.create(newName.trim(), newDescription.trim());
      setClassrooms([result.classroom, ...classrooms]);
      setShowCreateModal(false);
      setNewName('');
      setNewDescription('');
      setError('');
    } catch (err: any) {
      setError(err.message || '創建失敗');
    }
  };

  // 更新教室
  const handleUpdate = async () => {
    if (!editingClassroom || !newName.trim()) {
      setError('請輸入教室名稱');
      return;
    }
    
    try {
      const result = await classroomApi.update(editingClassroom.id, newName.trim(), newDescription.trim());
      setClassrooms(classrooms.map(c => c.id === editingClassroom.id ? result.classroom : c));
      setEditingClassroom(null);
      setNewName('');
      setNewDescription('');
      setError('');
    } catch (err: any) {
      setError(err.message || '更新失敗');
    }
  };

  // 刪除教室
  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此教室嗎？教室內的學生和作業將會保留但不再屬於任何教室。')) {
      return;
    }
    
    try {
      await classroomApi.delete(id);
      setClassrooms(classrooms.filter(c => c.id !== id));
      if (selectedClassroomId === id) {
        onSelectClassroom(null);
      }
    } catch (err) {
      console.error('刪除教室失敗:', err);
    }
  };

  // 開啟編輯
  const openEdit = (classroom: ClassroomData) => {
    setEditingClassroom(classroom);
    setNewName(classroom.name);
    setNewDescription(classroom.description || '');
    setError('');
  };

  // 取消編輯
  const cancelEdit = () => {
    setEditingClassroom(null);
    setShowCreateModal(false);
    setNewName('');
    setNewDescription('');
    setError('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-200 flex items-center gap-2">
          <School size={18} className="text-indigo-400" />
          教室管理
        </h3>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setNewName('');
            setNewDescription('');
            setError('');
          }}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> 新增教室
        </button>
      </div>

      {/* 教室列表 */}
      <div className="space-y-2">
        {/* 全部學生選項 */}
        <button
          onClick={() => onSelectClassroom(null)}
          className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between ${
            selectedClassroomId === null
              ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-300'
              : 'bg-gray-700/30 hover:bg-gray-700/50 border border-transparent text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span>全部學生</span>
          </div>
          <ChevronRight size={16} className="text-gray-500" />
        </button>

        {classrooms.map(classroom => (
          <div
            key={classroom.id}
            className={`p-3 rounded-lg transition-all border ${
              selectedClassroomId === classroom.id
                ? 'bg-indigo-600/30 border-indigo-500/50'
                : 'bg-gray-700/30 hover:bg-gray-700/50 border-transparent'
            }`}
          >
            {editingClassroom?.id === classroom.id ? (
              // 編輯模式
              <div className="space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="教室名稱"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="教室描述（可選）"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdate}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded-lg text-sm flex items-center justify-center gap-1"
                  >
                    <Check size={14} /> 保存
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1.5 rounded-lg text-sm flex items-center justify-center gap-1"
                  >
                    <X size={14} /> 取消
                  </button>
                </div>
              </div>
            ) : (
              // 顯示模式
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onSelectClassroom(classroom)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <School size={16} className={selectedClassroomId === classroom.id ? 'text-indigo-400' : 'text-gray-400'} />
                    <span className={selectedClassroomId === classroom.id ? 'text-indigo-300' : 'text-gray-300'}>
                      {classroom.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {classroom.studentCount} 人
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} /> {classroom.assignmentCount} 作業
                    </span>
                  </div>
                  {classroom.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{classroom.description}</p>
                  )}
                </button>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => openEdit(classroom)}
                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-600/50 rounded transition-colors"
                    title="編輯"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(classroom.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600/50 rounded transition-colors"
                    title="刪除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {classrooms.length === 0 && (
          <p className="text-center text-gray-500 py-4 text-sm">
            尚無教室，點擊上方按鈕創建
          </p>
        )}
      </div>

      {/* 創建教室模態框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={20} className="text-indigo-400" />
              創建新教室
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">教室名稱 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如：Python 基礎班"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">教室描述</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="教室的簡短描述..."
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                />
              </div>
              
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreate}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium transition-colors"
              >
                創建
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

