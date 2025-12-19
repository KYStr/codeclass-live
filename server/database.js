import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// 創建數據庫連接
export const db = new Database('codeclass.db');

// 初始化數據庫表
export function initDatabase() {
  console.log('📦 初始化數據庫...');

  // 教室表
  db.exec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // 用戶表（老師和學生）
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
      classroom_id TEXT,
      password_hash TEXT,
      is_password_set INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 0,
      last_active INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
    )
  `);

  // 添加 classroom_id 列（如果不存在）
  try {
    db.exec('ALTER TABLE users ADD COLUMN classroom_id TEXT');
  } catch (e) {
    // 列已存在，忽略錯誤
  }

  // 學生代碼表
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_code (
      student_id TEXT PRIMARY KEY,
      current_code TEXT DEFAULT '',
      current_language TEXT DEFAULT 'python',
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 反饋/留言表
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      from_teacher INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 作業表
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      classroom_id TEXT,
      due_date INTEGER,
      is_open INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
    )
  `);

  // 添加 classroom_id 列到 assignments（如果不存在）
  try {
    db.exec('ALTER TABLE assignments ADD COLUMN classroom_id TEXT');
  } catch (e) {
    // 列已存在，忽略錯誤
  }

  // 提交表
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      assignment_id TEXT NOT NULL,
      code TEXT NOT NULL,
      language TEXT NOT NULL,
      status TEXT DEFAULT 'submitted',
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
    )
  `);

  // 代碼執行歷史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_executions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      code TEXT NOT NULL,
      language TEXT NOT NULL,
      output TEXT,
      error TEXT,
      execution_time INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 創建默認教室
  const defaultClassroom = db.prepare('SELECT id FROM classrooms LIMIT 1').get();
  let defaultClassroomId;
  if (!defaultClassroom) {
    defaultClassroomId = uuidv4();
    db.prepare(`
      INSERT INTO classrooms (id, name, description)
      VALUES (?, ?, ?)
    `).run(defaultClassroomId, '預設教室', '系統預設教室');
    console.log('✅ 已創建預設教室');
  } else {
    defaultClassroomId = defaultClassroom.id;
  }

  // 創建默認老師帳戶
  const teacherExists = db.prepare('SELECT id FROM users WHERE role = ?').get('teacher');
  if (!teacherExists) {
    const passwordHash = bcrypt.hashSync('admin', 10);
    db.prepare(`
      INSERT INTO users (id, name, role, password_hash, is_password_set)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), '老師', 'teacher', passwordHash, 1);
    console.log('✅ 已創建默認老師帳戶 (密碼: admin)');
  }

  // 將現有學生移到預設教室（如果還沒有 classroom_id）
  db.prepare('UPDATE users SET classroom_id = ? WHERE role = ? AND classroom_id IS NULL')
    .run(defaultClassroomId, 'student');

  // 將現有作業移到預設教室（如果還沒有 classroom_id）
  db.prepare('UPDATE assignments SET classroom_id = ? WHERE classroom_id IS NULL')
    .run(defaultClassroomId);

  console.log('✅ 數據庫初始化完成');
}

// 教室操作
export const classroomOperations = {
  // 獲取所有教室
  getAll: () => {
    const classrooms = db.prepare('SELECT * FROM classrooms ORDER BY created_at DESC').all();
    // 為每個教室添加學生數量和作業數量
    return classrooms.map(c => ({
      ...c,
      studentCount: db.prepare('SELECT COUNT(*) as count FROM users WHERE classroom_id = ? AND role = ?').get(c.id, 'student').count,
      assignmentCount: db.prepare('SELECT COUNT(*) as count FROM assignments WHERE classroom_id = ?').get(c.id).count
    }));
  },

  // 根據 ID 獲取教室
  getById: (id) => {
    return db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id);
  },

  // 創建教室
  create: (name, description) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO classrooms (id, name, description)
      VALUES (?, ?, ?)
    `).run(id, name, description || '');
    return classroomOperations.getById(id);
  },

  // 更新教室
  update: (id, name, description) => {
    db.prepare('UPDATE classrooms SET name = ?, description = ? WHERE id = ?')
      .run(name, description || '', id);
    return classroomOperations.getById(id);
  },

  // 刪除教室
  delete: (id) => {
    // 先將該教室的學生和作業移到 null
    db.prepare('UPDATE users SET classroom_id = NULL WHERE classroom_id = ?').run(id);
    db.prepare('UPDATE assignments SET classroom_id = NULL WHERE classroom_id = ?').run(id);
    // 刪除教室
    db.prepare('DELETE FROM classrooms WHERE id = ?').run(id);
  },

  // 獲取教室的學生
  getStudents: (classroomId) => {
    return db.prepare(`
      SELECT u.*, sc.current_code, sc.current_language
      FROM users u
      LEFT JOIN student_code sc ON u.id = sc.student_id
      WHERE u.role = 'student' AND u.classroom_id = ?
      ORDER BY u.created_at DESC
    `).all(classroomId);
  },

  // 獲取教室的作業
  getAssignments: (classroomId) => {
    return db.prepare('SELECT * FROM assignments WHERE classroom_id = ? ORDER BY created_at DESC').all(classroomId);
  }
};

// 用戶相關操作
export const userOperations = {
  // 獲取所有學生
  getAllStudents: () => {
    return db.prepare(`
      SELECT u.*, sc.current_code, sc.current_language
      FROM users u
      LEFT JOIN student_code sc ON u.id = sc.student_id
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `).all();
  },

  // 根據 ID 獲取用戶
  getById: (id) => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  // 根據名字獲取用戶
  getByName: (name, role) => {
    return db.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get(name, role);
  },

  // 創建學生
  createStudent: (name, classroomId = null) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, role, classroom_id, is_password_set)
      VALUES (?, ?, 'student', ?, 0)
    `).run(id, name, classroomId);
    
    // 創建學生代碼記錄
    db.prepare(`
      INSERT INTO student_code (student_id, current_code, current_language)
      VALUES (?, ?, 'python')
    `).run(id, `# ${name} 的程式碼\n# 請在這裡開始編寫...\n\nprint("Hello, World!")`);
    
    return userOperations.getById(id);
  },

  // 更新學生所屬教室
  updateStudentClassroom: (studentId, classroomId) => {
    db.prepare('UPDATE users SET classroom_id = ? WHERE id = ?').run(classroomId, studentId);
  },

  // 設置密碼
  setPassword: (id, password) => {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, is_password_set = 1 WHERE id = ?').run(hash, id);
  },

  // 驗證密碼
  verifyPassword: (id, password) => {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id);
    if (!user || !user.password_hash) return false;
    return bcrypt.compareSync(password, user.password_hash);
  },

  // 重置密碼（老師用）
  resetPassword: (id) => {
    db.prepare('UPDATE users SET password_hash = NULL, is_password_set = 0 WHERE id = ?').run(id);
  },

  // 更新在線狀態
  setOnlineStatus: (id, isOnline) => {
    db.prepare('UPDATE users SET is_online = ?, last_active = ? WHERE id = ?')
      .run(isOnline ? 1 : 0, Date.now(), id);
  },

  // 刪除學生
  deleteStudent: (id) => {
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(id, 'student');
  },

  // 獲取老師
  getTeacher: () => {
    return db.prepare('SELECT * FROM users WHERE role = ?').get('teacher');
  }
};

// 學生代碼操作
export const codeOperations = {
  // 更新代碼
  updateCode: (studentId, code, language) => {
    db.prepare(`
      INSERT INTO student_code (student_id, current_code, current_language)
      VALUES (?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        current_code = excluded.current_code,
        current_language = excluded.current_language
    `).run(studentId, code, language);
  },

  // 獲取代碼
  getCode: (studentId) => {
    return db.prepare('SELECT * FROM student_code WHERE student_id = ?').get(studentId);
  }
};

// 反饋操作
export const feedbackOperations = {
  // 創建反饋
  create: (studentId, message, fromTeacher = true) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO feedbacks (id, student_id, message, from_teacher)
      VALUES (?, ?, ?, ?)
    `).run(id, studentId, message, fromTeacher ? 1 : 0);
    return db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(id);
  },

  // 獲取學生的反饋
  getByStudent: (studentId) => {
    return db.prepare('SELECT * FROM feedbacks WHERE student_id = ? ORDER BY created_at ASC').all(studentId);
  },

  // 標記為已讀
  markAsRead: (studentId) => {
    db.prepare('UPDATE feedbacks SET is_read = 1 WHERE student_id = ?').run(studentId);
  },

  // 清空學生的所有對話
  clearByStudent: (studentId) => {
    db.prepare('DELETE FROM feedbacks WHERE student_id = ?').run(studentId);
  }
};

// 作業操作
export const assignmentOperations = {
  // 獲取所有作業
  getAll: () => {
    return db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all();
  },

  // 根據教室獲取作業
  getByClassroom: (classroomId) => {
    return db.prepare('SELECT * FROM assignments WHERE classroom_id = ? ORDER BY created_at DESC').all(classroomId);
  },

  // 創建作業
  create: (title, description, dueDate, classroomId = null) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO assignments (id, title, description, due_date, classroom_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, description, dueDate || null, classroomId);
    return db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  },

  // 更新作業開放狀態
  toggleOpen: (id) => {
    db.prepare('UPDATE assignments SET is_open = NOT is_open WHERE id = ?').run(id);
  },

  // 刪除作業
  delete: (id) => {
    db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  }
};

// 提交操作
export const submissionOperations = {
  // 創建提交
  create: (studentId, assignmentId, code, language) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO submissions (id, student_id, assignment_id, code, language)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, studentId, assignmentId, code, language);
    return db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  },

  // 獲取學生的提交
  getByStudent: (studentId) => {
    return db.prepare('SELECT * FROM submissions WHERE student_id = ? ORDER BY created_at DESC').all(studentId);
  },

  // 獲取作業的所有提交
  getByAssignment: (assignmentId) => {
    return db.prepare(`
      SELECT s.*, u.name as student_name
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      WHERE s.assignment_id = ?
      ORDER BY s.created_at DESC
    `).all(assignmentId);
  }
};

