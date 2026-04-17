import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ?萄遣?豢?摨恍?
export const db = new Database('codeclass.db');
db.pragma('foreign_keys = ON');

// ????澈銵?
export function initDatabase() {
  console.log('Initializing database...');

  // ?恕銵?
  db.exec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      timer_title TEXT,
      timer_started_at INTEGER,
      timer_ends_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  try {
    db.exec('ALTER TABLE classrooms ADD COLUMN timer_title TEXT');
  } catch (e) {
    // Column already exists.
  }

  try {
    db.exec('ALTER TABLE classrooms ADD COLUMN timer_started_at INTEGER');
  } catch (e) {
    // Column already exists.
  }

  try {
    db.exec('ALTER TABLE classrooms ADD COLUMN timer_ends_at INTEGER');
  } catch (e) {
    // Column already exists.
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS classroom_note_folders (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES classroom_note_folders(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS classroom_notes (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL,
      folder_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES classroom_note_folders(id) ON DELETE SET NULL
    )
  `);

  // ?冽銵剁??葦?飛??
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

  // 瘛餃? classroom_id ??憒?銝??剁?
  try {
    db.exec('ALTER TABLE users ADD COLUMN classroom_id TEXT');
  } catch (e) {
    // ?歇摮嚗蕭?仿隤?
  }

  try {
    db.exec('ALTER TABLE users ADD COLUMN hand_raised INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists.
  }

  try {
    db.exec('ALTER TABLE users ADD COLUMN hand_raised_at INTEGER');
  } catch (e) {
    // Column already exists.
  }

  // 摮貊?隞?Ⅳ銵?
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_code (
      student_id TEXT PRIMARY KEY,
      current_code TEXT DEFAULT '',
      current_language TEXT DEFAULT 'python',
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ??/??銵?
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

  // 雿平銵?
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

  // 瘛餃? classroom_id ? assignments嚗???摮嚗?
  try {
    db.exec('ALTER TABLE assignments ADD COLUMN classroom_id TEXT');
  } catch (e) {
    // ?歇摮嚗蕭?仿隤?
  }

  // ?漱銵?
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS student_project_folders (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      is_teacher_managed INTEGER DEFAULT 0,
      source_note_folder_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES student_project_folders(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS student_projects (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'python',
      folder_id TEXT,
      source_assignment_id TEXT,
      is_read_only INTEGER DEFAULT 0,
      source_note_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES student_project_folders(id) ON DELETE SET NULL,
      FOREIGN KEY (source_assignment_id) REFERENCES assignments(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS student_ai_messages (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      context_url TEXT,
      attachment_name TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES student_projects(id) ON DELETE CASCADE
    )
  `);

  try {
    db.exec('ALTER TABLE student_projects ADD COLUMN folder_id TEXT');
  } catch (e) {
    // Column already exists.
  }

  try {
    db.exec('ALTER TABLE student_project_folders ADD COLUMN is_teacher_managed INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists.
  }

  try {
    db.exec('ALTER TABLE student_project_folders ADD COLUMN source_note_folder_id TEXT');
  } catch (e) {
    // Column already exists.
  }

  try {
    db.exec('ALTER TABLE student_projects ADD COLUMN is_read_only INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists.
  }

  try {
    db.exec('ALTER TABLE student_projects ADD COLUMN source_note_id TEXT');
  } catch (e) {
    // Column already exists.
  }

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

  // ?萄遣暺??恕
  const defaultClassroom = db.prepare('SELECT id FROM classrooms LIMIT 1').get();
  let defaultClassroomId;
  if (!defaultClassroom) {
    defaultClassroomId = uuidv4();
    db.prepare(`
      INSERT INTO classrooms (id, name, description)
      VALUES (?, ?, ?)
    `).run(defaultClassroomId, '預設教室', '系統預設教室');
    console.log('Created default classroom');
  } else {
    defaultClassroomId = defaultClassroom.id;
  }

  // ?萄遣暺??葦撣單
  const teacherExists = db.prepare('SELECT id FROM users WHERE role = ?').get('teacher');
  if (!teacherExists) {
    const passwordHash = bcrypt.hashSync('admin', 10);
    db.prepare(`
      INSERT INTO users (id, name, role, password_hash, is_password_set)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), '老師', 'teacher', passwordHash, 1);
    console.log('Created default teacher account (password: admin)');
  }

  // 撠?飛?宏?圈?閮剜?摰歹?憒?????classroom_id嚗?
  db.prepare('UPDATE users SET classroom_id = ? WHERE role = ? AND classroom_id IS NULL')
    .run(defaultClassroomId, 'student');

  // 撠??璆剔宏?圈?閮剜?摰歹?憒?????classroom_id嚗?
  db.prepare('UPDATE assignments SET classroom_id = ? WHERE classroom_id IS NULL')
    .run(defaultClassroomId);

  repairMojibakeStudentCode();

  console.log('Database initialized');
}

export function formatClassroomTimer(classroom) {
  if (!classroom || !classroom.timer_ends_at) return null;

  const endsAt = Number(classroom.timer_ends_at);
  const startedAt = classroom.timer_started_at ? Number(classroom.timer_started_at) : null;

  return {
    classroomId: classroom.id,
    title: classroom.timer_title || '課堂倒數',
    startedAt,
    endsAt,
    isActive: endsAt > Date.now()
  };
}

export const createDefaultStudentCode = (name) =>
  `# ${name} 的程式碼\n# 請在這裡開始寫你的程式...\n\nprint("Hello, World!")`;

export function repairMojibakeStudentCode() {
  const rows = db.prepare(`
    SELECT sc.student_id, sc.current_code, u.name
    FROM student_code sc
    JOIN users u ON u.id = sc.student_id
    WHERE sc.current_code LIKE '%??撘%'
       OR sc.current_code LIKE '%隢%'
  `).all();

  const update = db.prepare('UPDATE student_code SET current_code = ? WHERE student_id = ?');
  rows.forEach(row => update.run(createDefaultStudentCode(row.name), row.student_id));
}

function decorateClassroom(classroom) {
  if (!classroom) return null;

  return {
    ...classroom,
    studentCount: db.prepare('SELECT COUNT(*) as count FROM users WHERE classroom_id = ? AND role = ?').get(classroom.id, 'student').count,
    assignmentCount: db.prepare('SELECT COUNT(*) as count FROM assignments WHERE classroom_id = ?').get(classroom.id).count,
    timer: formatClassroomTimer(classroom)
  };
}

// ?恕??
export const classroomOperations = {
  // ?脣????摰?
  getAll: () => {
    const classrooms = db.prepare('SELECT * FROM classrooms ORDER BY created_at DESC').all();
    // ?箸???摰斗溶?飛???雿平?賊?
    return classrooms.map(decorateClassroom);
  },

  // ?寞? ID ?脣??恕
  getById: (id) => {
    const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id);
    return decorateClassroom(classroom);
  },

  // ?萄遣?恕
  create: (name, description) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO classrooms (id, name, description)
      VALUES (?, ?, ?)
    `).run(id, name, description || '');
    return classroomOperations.getById(id);
  },

  // ?湔?恕
  update: (id, name, description) => {
    db.prepare('UPDATE classrooms SET name = ?, description = ? WHERE id = ?')
      .run(name, description || '', id);
    return classroomOperations.getById(id);
  },

  setTimer: (id, title, durationMinutes) => {
    const startedAt = Date.now();
    const minutes = Math.max(1, Math.min(600, Math.ceil(Number(durationMinutes))));
    const endsAt = startedAt + minutes * 60 * 1000;

    db.prepare(`
      UPDATE classrooms
      SET timer_title = ?, timer_started_at = ?, timer_ends_at = ?
      WHERE id = ?
    `).run(String(title || '課堂倒數').trim(), startedAt, endsAt, id);

    return classroomOperations.getById(id);
  },

  clearTimer: (id) => {
    db.prepare(`
      UPDATE classrooms
      SET timer_title = NULL, timer_started_at = NULL, timer_ends_at = NULL
      WHERE id = ?
    `).run(id);

    return classroomOperations.getById(id);
  },

  // ?芷?恕
  delete: (id) => {
    // ??閰脫?摰斤?摮貊???璆剔宏??null
    db.prepare('UPDATE users SET classroom_id = NULL WHERE classroom_id = ?').run(id);
    db.prepare('UPDATE assignments SET classroom_id = NULL WHERE classroom_id = ?').run(id);
    // ?芷?恕
    db.prepare('DELETE FROM classrooms WHERE id = ?').run(id);
  },

  // ?脣??恕?飛??
  getStudents: (classroomId) => {
    return db.prepare(`
      SELECT u.*, sc.current_code, sc.current_language
      FROM users u
      LEFT JOIN student_code sc ON u.id = sc.student_id
      WHERE u.role = 'student' AND u.classroom_id = ?
      ORDER BY u.created_at DESC
    `).all(classroomId);
  },

  // ?脣??恕??璆?
  getAssignments: (classroomId) => {
    return db.prepare('SELECT * FROM assignments WHERE classroom_id = ? ORDER BY created_at DESC').all(classroomId);
  }
};

// ?冽?賊???
export const userOperations = {
  // ?脣???飛??
  getAllStudents: () => {
    return db.prepare(`
      SELECT u.*, sc.current_code, sc.current_language
      FROM users u
      LEFT JOIN student_code sc ON u.id = sc.student_id
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `).all();
  },

  getStudentCountByClassroom: (classroomId) => {
    if (!classroomId) {
      return db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('student').count;
    }
    return db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND classroom_id = ?').get('student', classroomId).count;
  },

  // ?寞? ID ?脣??冽
  getById: (id) => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  // ?寞????脣??冽
  getByName: (name, role) => {
    return db.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get(name, role);
  },

  // ?萄遣摮貊?
  createStudent: (name, classroomId = null) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, role, classroom_id, is_password_set)
      VALUES (?, ?, 'student', ?, 0)
    `).run(id, name, classroomId);
    
    // ?萄遣摮貊?隞?Ⅳ閮?
    db.prepare(`
      INSERT INTO student_code (student_id, current_code, current_language)
      VALUES (?, ?, 'python')
    `).run(id, createDefaultStudentCode(name));
    
    return userOperations.getById(id);
  },

  // ?湔摮貊??撅祆?摰?
  updateStudentClassroom: (studentId, classroomId) => {
    db.prepare('UPDATE users SET classroom_id = ? WHERE id = ?').run(classroomId, studentId);
  },

  // 閮剔蔭撖Ⅳ
  setPassword: (id, password) => {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, is_password_set = 1 WHERE id = ?').run(hash, id);
  },

  // 撽?撖Ⅳ
  verifyPassword: (id, password) => {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id);
    if (!user || !user.password_hash) return false;
    return bcrypt.compareSync(password, user.password_hash);
  },

  // ?蔭撖Ⅳ嚗葦?剁?
  resetPassword: (id) => {
    db.prepare('UPDATE users SET password_hash = NULL, is_password_set = 0 WHERE id = ?').run(id);
  },

  // ?湔?函????
  setOnlineStatus: (id, isOnline) => {
    db.prepare('UPDATE users SET is_online = ?, last_active = ? WHERE id = ?')
      .run(isOnline ? 1 : 0, Date.now(), id);
  },

  setHelpRequest: (id, isRaised) => {
    db.prepare('UPDATE users SET hand_raised = ?, hand_raised_at = ? WHERE id = ?')
      .run(isRaised ? 1 : 0, isRaised ? Date.now() : null, id);
    return userOperations.getById(id);
  },

  // ?芷摮貊?
  deleteStudent: (id) => {
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(id, 'student');
  },

  // ?脣??葦
  getTeacher: () => {
    return db.prepare('SELECT * FROM users WHERE role = ?').get('teacher');
  }
};

// 摮貊?隞?Ⅳ??
export const codeOperations = {
  // ?湔隞?Ⅳ
  updateCode: (studentId, code, language) => {
    db.prepare(`
      INSERT INTO student_code (student_id, current_code, current_language)
      VALUES (?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        current_code = excluded.current_code,
        current_language = excluded.current_language
    `).run(studentId, code, language);
  },

  // ?脣?隞?Ⅳ
  getCode: (studentId) => {
    return db.prepare('SELECT * FROM student_code WHERE student_id = ?').get(studentId);
  }
};

// ????
export const feedbackOperations = {
  // ?萄遣??
  create: (studentId, message, fromTeacher = true) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO feedbacks (id, student_id, message, from_teacher)
      VALUES (?, ?, ?, ?)
    `).run(id, studentId, message, fromTeacher ? 1 : 0);
    return db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(id);
  },

  // ?脣?摮貊???擖?
  getByStudent: (studentId) => {
    return db.prepare('SELECT * FROM feedbacks WHERE student_id = ? ORDER BY created_at ASC').all(studentId);
  },

  // 璅??箏歇霈
  markAsRead: (studentId) => {
    db.prepare('UPDATE feedbacks SET is_read = 1 WHERE student_id = ? AND from_teacher = 1').run(studentId);
  },

  // 皜征摮貊?????閰?
  clearByStudent: (studentId) => {
    db.prepare('DELETE FROM feedbacks WHERE student_id = ?').run(studentId);
  }
};

// 雿平??
export const assignmentOperations = {
  // ?脣????璆?
  getAll: () => {
    return db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all();
  },

  // ?寞??恕?脣?雿平
  getByClassroom: (classroomId) => {
    return db.prepare('SELECT * FROM assignments WHERE classroom_id = ? ORDER BY created_at DESC').all(classroomId);
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  },

  // ?萄遣雿平
  create: (title, description, dueDate, classroomId = null) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO assignments (id, title, description, due_date, classroom_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, description, dueDate || null, classroomId);
    return db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  },

  // ?湔雿平????
  toggleOpen: (id) => {
    db.prepare('UPDATE assignments SET is_open = NOT is_open WHERE id = ?').run(id);
  },

  // ?芷雿平
  delete: (id) => {
    db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  }
};

// ?漱??
export const submissionOperations = {
  // ?萄遣?漱
  saveLatest: (studentId, assignmentId, code, language) => {
    const existing = db.prepare(`
      SELECT *
      FROM submissions
      WHERE student_id = ? AND assignment_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(studentId, assignmentId);

    if (existing) {
      db.prepare(`
        UPDATE submissions
        SET code = ?, language = ?, status = 'submitted', created_at = ?
        WHERE id = ?
      `).run(code, language, Date.now(), existing.id);
      return db.prepare('SELECT * FROM submissions WHERE id = ?').get(existing.id);
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO submissions (id, student_id, assignment_id, code, language)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, studentId, assignmentId, code, language);
    return db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  },

  // ?脣?摮貊???鈭?
  getByStudent: (studentId) => {
    return db.prepare(`
      SELECT *
      FROM submissions s
      WHERE s.student_id = ?
        AND s.created_at = (
          SELECT MAX(s2.created_at)
          FROM submissions s2
          WHERE s2.assignment_id = s.assignment_id
            AND s2.student_id = s.student_id
        )
      ORDER BY s.created_at DESC
    `).all(studentId);
  },

  // ?脣?雿平????鈭?
  getByAssignment: (assignmentId) => {
    return db.prepare(`
      SELECT s.*, u.name as student_name
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      WHERE s.assignment_id = ?
        AND s.created_at = (
          SELECT MAX(s2.created_at)
          FROM submissions s2
          WHERE s2.assignment_id = s.assignment_id
            AND s2.student_id = s.student_id
        )
      ORDER BY s.created_at DESC
    `).all(assignmentId);
  }
};

export const folderOperations = {
  getByStudent: (studentId) => {
    return db.prepare(`
      SELECT *
      FROM student_project_folders
      WHERE student_id = ?
      ORDER BY name ASC
    `).all(studentId);
  },

  getById: (id, studentId) => {
    return db.prepare(`
      SELECT *
      FROM student_project_folders
      WHERE id = ? AND student_id = ?
    `).get(id, studentId);
  },

  create: (studentId, name, parentId = null) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO student_project_folders (id, student_id, name, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, studentId, name, parentId || null, now, now);
    return folderOperations.getById(id, studentId);
  },

  update: (id, studentId, { name, parentId }) => {
    const current = folderOperations.getById(id, studentId);
    if (!current) return null;

    db.prepare(`
      UPDATE student_project_folders
      SET name = ?, parent_id = ?, updated_at = ?
      WHERE id = ? AND student_id = ?
    `).run(
      name ?? current.name,
      parentId === undefined ? current.parent_id : parentId,
      Date.now(),
      id,
      studentId
    );

    return folderOperations.getById(id, studentId);
  },

  deleteEmpty: (id, studentId) => {
    const childCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM student_project_folders
      WHERE parent_id = ? AND student_id = ?
    `).get(id, studentId).count;

    const projectCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM student_projects
      WHERE folder_id = ? AND student_id = ?
    `).get(id, studentId).count;

    if (childCount || projectCount) {
      return { deleted: false, reason: 'not_empty' };
    }

    db.prepare('DELETE FROM student_project_folders WHERE id = ? AND student_id = ?').run(id, studentId);
    return { deleted: true };
  }
};

export const classroomNoteFolderOperations = {
  getByClassroom: (classroomId) => {
    return db.prepare(`
      SELECT *
      FROM classroom_note_folders
      WHERE classroom_id = ?
      ORDER BY name ASC
    `).all(classroomId);
  },

  getById: (id, classroomId) => {
    return db.prepare(`
      SELECT *
      FROM classroom_note_folders
      WHERE id = ? AND classroom_id = ?
    `).get(id, classroomId);
  },

  create: (classroomId, name, parentId = null) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO classroom_note_folders (id, classroom_id, name, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, classroomId, name, parentId || null, now, now);
    return classroomNoteFolderOperations.getById(id, classroomId);
  },

  update: (id, classroomId, { name, parentId }) => {
    const current = classroomNoteFolderOperations.getById(id, classroomId);
    if (!current) return null;

    db.prepare(`
      UPDATE classroom_note_folders
      SET name = ?, parent_id = ?, updated_at = ?
      WHERE id = ? AND classroom_id = ?
    `).run(
      name ?? current.name,
      parentId === undefined ? current.parent_id : parentId,
      Date.now(),
      id,
      classroomId
    );

    return classroomNoteFolderOperations.getById(id, classroomId);
  },

  deleteEmpty: (id, classroomId) => {
    const childCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM classroom_note_folders
      WHERE parent_id = ? AND classroom_id = ?
    `).get(id, classroomId).count;

    const noteCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM classroom_notes
      WHERE folder_id = ? AND classroom_id = ?
    `).get(id, classroomId).count;

    if (childCount || noteCount) {
      return { deleted: false, reason: 'not_empty' };
    }

    db.prepare('DELETE FROM classroom_note_folders WHERE id = ? AND classroom_id = ?').run(id, classroomId);
    return { deleted: true };
  },

  deleteTree: (id, classroomId) => {
    const root = classroomNoteFolderOperations.getById(id, classroomId);
    if (!root) return { deleted: false, reason: 'not_found' };

    const folders = db.prepare(`
      SELECT *
      FROM classroom_note_folders
      WHERE classroom_id = ?
    `).all(classroomId);
    const descendants = new Set([id]);
    let changed = true;

    while (changed) {
      changed = false;
      folders.forEach(folder => {
        if (folder.parent_id && descendants.has(folder.parent_id) && !descendants.has(folder.id)) {
          descendants.add(folder.id);
          changed = true;
        }
      });
    }

    const ids = [...descendants];
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM classroom_notes WHERE classroom_id = ? AND folder_id IN (${placeholders})`)
      .run(classroomId, ...ids);
    db.prepare(`DELETE FROM classroom_note_folders WHERE classroom_id = ? AND id IN (${placeholders})`)
      .run(classroomId, ...ids);

    return { deleted: true };
  }
};

export const classroomNoteOperations = {
  getByClassroom: (classroomId) => {
    return db.prepare(`
      SELECT *
      FROM classroom_notes
      WHERE classroom_id = ?
      ORDER BY updated_at DESC
    `).all(classroomId);
  },

  getById: (id, classroomId) => {
    return db.prepare(`
      SELECT *
      FROM classroom_notes
      WHERE id = ? AND classroom_id = ?
    `).get(id, classroomId);
  },

  create: (classroomId, title, content = '', folderId = null) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO classroom_notes (id, classroom_id, folder_id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, classroomId, folderId || null, title, content || '', now, now);
    return classroomNoteOperations.getById(id, classroomId);
  },

  update: (id, classroomId, { title, content, folderId }) => {
    const current = classroomNoteOperations.getById(id, classroomId);
    if (!current) return null;

    db.prepare(`
      UPDATE classroom_notes
      SET title = ?, content = ?, folder_id = ?, updated_at = ?
      WHERE id = ? AND classroom_id = ?
    `).run(
      title ?? current.title,
      content ?? current.content,
      folderId === undefined ? current.folder_id : folderId,
      Date.now(),
      id,
      classroomId
    );

    return classroomNoteOperations.getById(id, classroomId);
  },

  delete: (id, classroomId) => {
    return db.prepare('DELETE FROM classroom_notes WHERE id = ? AND classroom_id = ?').run(id, classroomId);
  }
};

export const classroomNoteSyncOperations = {
  syncClassroomToStudentProjects: (classroomId) => {
    const students = db.prepare(`
      SELECT id
      FROM users
      WHERE role = 'student' AND classroom_id = ?
    `).all(classroomId);
    const noteFolders = db.prepare(`
      SELECT *
      FROM classroom_note_folders
      WHERE classroom_id = ?
      ORDER BY created_at ASC
    `).all(classroomId);
    const notes = db.prepare(`
      SELECT *
      FROM classroom_notes
      WHERE classroom_id = ?
      ORDER BY created_at ASC
    `).all(classroomId);

    const syncOneStudent = db.transaction((studentId) => {
      const now = Date.now();
      const folderIds = new Set(noteFolders.map(folder => folder.id));
      const noteIds = new Set(notes.map(note => note.id));
      const folderMap = new Map();
      const getOrCreateStudentFolder = () => {
        const existing = db.prepare(`
          SELECT *
          FROM student_project_folders
          WHERE student_id = ? AND parent_id IS NULL AND name = ? AND IFNULL(is_teacher_managed, 0) = 0
          LIMIT 1
        `).get(studentId, '學生資料夾');

        if (existing) return existing.id;

        const id = uuidv4();
        db.prepare(`
          INSERT INTO student_project_folders
            (id, student_id, name, parent_id, is_teacher_managed, source_note_folder_id, created_at, updated_at)
          VALUES (?, ?, ?, NULL, 0, NULL, ?, ?)
        `).run(id, studentId, '學生資料夾', now, now);
        return id;
      };
      let pending = [...noteFolders];

      while (pending.length > 0) {
        const nextPending = [];
        let progressed = false;

        for (const folder of pending) {
          const parentStudentFolderId = folder.parent_id ? folderMap.get(folder.parent_id) : null;
          if (folder.parent_id && !parentStudentFolderId) {
            nextPending.push(folder);
            continue;
          }

          const existing = db.prepare(`
            SELECT *
            FROM student_project_folders
            WHERE student_id = ? AND source_note_folder_id = ?
          `).get(studentId, folder.id);

          if (existing) {
            db.prepare(`
              UPDATE student_project_folders
              SET name = ?, parent_id = ?, is_teacher_managed = 1, updated_at = ?
              WHERE id = ? AND student_id = ?
            `).run(folder.name, parentStudentFolderId || null, now, existing.id, studentId);
            folderMap.set(folder.id, existing.id);
          } else {
            const id = uuidv4();
            db.prepare(`
              INSERT INTO student_project_folders
                (id, student_id, name, parent_id, is_teacher_managed, source_note_folder_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            `).run(id, studentId, folder.name, parentStudentFolderId || null, folder.id, now, now);
            folderMap.set(folder.id, id);
          }

          progressed = true;
        }

        if (!progressed) break;
        pending = nextPending;
      }

      notes.forEach(note => {
        const folderId = note.folder_id ? folderMap.get(note.folder_id) || null : null;
        const existing = db.prepare(`
          SELECT *
          FROM student_projects
          WHERE student_id = ? AND source_note_id = ?
        `).get(studentId, note.id);

        if (existing) {
          db.prepare(`
            UPDATE student_projects
            SET name = ?, code = ?, language = 'markdown', folder_id = ?, is_read_only = 1, updated_at = ?
            WHERE id = ? AND student_id = ?
          `).run(note.title, note.content || '', folderId, now, existing.id, studentId);
        } else {
          db.prepare(`
            INSERT INTO student_projects
              (id, student_id, name, code, language, folder_id, source_assignment_id, is_read_only, source_note_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'markdown', ?, NULL, 1, ?, ?, ?)
          `).run(uuidv4(), studentId, note.title, note.content || '', folderId, note.id, now, now);
        }
      });

      db.prepare(`
        DELETE FROM student_projects
        WHERE student_id = ? AND source_note_id IS NOT NULL
          AND source_note_id NOT IN (${noteIds.size ? [...noteIds].map(() => '?').join(',') : "''"})
      `).run(studentId, ...noteIds);

      const managedFolders = db.prepare(`
        SELECT *
        FROM student_project_folders
        WHERE student_id = ? AND source_note_folder_id IS NOT NULL
      `).all(studentId);

      const managedFolderMap = new Map(managedFolders.map(folder => [folder.id, folder]));
      const getManagedFolderDepth = (folder) => {
        let depth = 0;
        let current = folder;
        while (current?.parent_id && managedFolderMap.has(current.parent_id)) {
          depth += 1;
          current = managedFolderMap.get(current.parent_id);
        }
        return depth;
      };

      managedFolders
        .sort((a, b) => getManagedFolderDepth(b) - getManagedFolderDepth(a))
        .forEach(folder => {
        if (folderIds.has(folder.source_note_folder_id)) return;

        const fallbackFolderId = getOrCreateStudentFolder();

        db.prepare(`
          UPDATE student_project_folders
          SET parent_id = ?, updated_at = ?
          WHERE parent_id = ? AND student_id = ? AND IFNULL(is_teacher_managed, 0) = 0
        `).run(fallbackFolderId, now, folder.id, studentId);

        db.prepare(`
          UPDATE student_projects
          SET folder_id = ?, updated_at = ?
          WHERE folder_id = ? AND student_id = ? AND IFNULL(is_read_only, 0) = 0
        `).run(fallbackFolderId, now, folder.id, studentId);

        db.prepare('DELETE FROM student_projects WHERE folder_id = ? AND student_id = ? AND IFNULL(is_read_only, 0) = 1')
          .run(folder.id, studentId);

        const childCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM student_project_folders
          WHERE parent_id = ? AND student_id = ?
        `).get(folder.id, studentId).count;
        const projectCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM student_projects
          WHERE folder_id = ? AND student_id = ?
        `).get(folder.id, studentId).count;

        if (!childCount && !projectCount) {
          db.prepare('DELETE FROM student_project_folders WHERE id = ? AND student_id = ?').run(folder.id, studentId);
          return;
        }

        db.prepare(`
          UPDATE student_project_folders
          SET is_teacher_managed = 0, source_note_folder_id = NULL, parent_id = ?, updated_at = ?
          WHERE id = ? AND student_id = ?
        `).run(fallbackFolderId, now, folder.id, studentId);
      });
    });

    students.forEach(student => syncOneStudent(student.id));
  }
};

export const projectOperations = {
  getByStudent: (studentId) => {
    return db.prepare(`
      SELECT *
      FROM student_projects
      WHERE student_id = ?
      ORDER BY updated_at DESC
    `).all(studentId);
  },

  getById: (id, studentId) => {
    return db.prepare(`
      SELECT *
      FROM student_projects
      WHERE id = ? AND student_id = ?
    `).get(id, studentId);
  },

  create: (studentId, name, code, language, sourceAssignmentId = null, folderId = null) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO student_projects (id, student_id, name, code, language, folder_id, source_assignment_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, studentId, name, code || '', language || 'python', folderId || null, sourceAssignmentId || null, now, now);
    return db.prepare('SELECT * FROM student_projects WHERE id = ?').get(id);
  },

  update: (id, studentId, { name, code, language, folderId }) => {
    const current = projectOperations.getById(id, studentId);
    if (!current) return null;

    db.prepare(`
      UPDATE student_projects
      SET name = ?, code = ?, language = ?, folder_id = ?, updated_at = ?
      WHERE id = ? AND student_id = ?
    `).run(
      name ?? current.name,
      code ?? current.code,
      language ?? current.language,
      folderId === undefined ? current.folder_id : folderId,
      Date.now(),
      id,
      studentId
    );

    return projectOperations.getById(id, studentId);
  },

  delete: (id, studentId) => {
    return db.prepare('DELETE FROM student_projects WHERE id = ? AND student_id = ?').run(id, studentId);
  }
};

export const aiMessageOperations = {
  getByProject: (studentId, projectId, limit = 40) => {
    return db.prepare(`
      SELECT *
      FROM (
        SELECT *
        FROM student_ai_messages
        WHERE student_id = ? AND project_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
      ORDER BY created_at ASC
    `).all(studentId, projectId, limit);
  },

  create: (studentId, projectId, role, content, metadata = {}) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO student_ai_messages (id, student_id, project_id, role, content, context_url, attachment_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      studentId,
      projectId,
      role,
      content,
      metadata.contextUrl || null,
      metadata.attachmentName || null,
      Date.now()
    );
    return db.prepare('SELECT * FROM student_ai_messages WHERE id = ?').get(id);
  }
};
