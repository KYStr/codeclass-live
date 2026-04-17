import express from 'express';
import { userOperations, codeOperations, feedbackOperations, submissionOperations, assignmentOperations, folderOperations, projectOperations, aiMessageOperations, classroomOperations, formatClassroomTimer, classroomNoteSyncOperations, createDefaultStudentCode } from '../database.js';
import { generateTutorHint } from '../services/kimiTutor.js';

export const studentRoutes = express.Router();

const formatProject = (project) => ({
  id: project.id,
  studentId: project.student_id,
  name: project.name,
  code: project.code,
  language: project.language,
  folderId: project.folder_id,
  sourceAssignmentId: project.source_assignment_id,
  readOnly: !!project.is_read_only,
  sourceNoteId: project.source_note_id,
  createdAt: project.created_at,
  updatedAt: project.updated_at
});

const formatFolder = (folder) => ({
  id: folder.id,
  studentId: folder.student_id,
  name: folder.name,
  parentId: folder.parent_id,
  isTeacherManaged: !!folder.is_teacher_managed,
  sourceNoteFolderId: folder.source_note_folder_id,
  createdAt: folder.created_at,
  updatedAt: folder.updated_at
});

const formatAiMessage = (message) => ({
  id: message.id,
  studentId: message.student_id,
  projectId: message.project_id,
  role: message.role,
  content: message.content,
  contextUrl: message.context_url,
  attachmentName: message.attachment_name,
  createdAt: message.created_at
});

const formatHelpRequest = (student) => ({
  studentId: student.id,
  studentName: student.name,
  handRaised: !!student.hand_raised,
  handRaisedAt: student.hand_raised_at || null
});

const getClassroomTimerForStudent = (classroomId) => {
  if (!classroomId) return null;
  return formatClassroomTimer(classroomOperations.getById(classroomId));
};

// ?脣???飛???葦?剁?
studentRoutes.get('/', (req, res) => {
  const students = userOperations.getAllStudents();
  
  const result = students.map(student => {
    const feedbacks = feedbackOperations.getByStudent(student.id);
    const submissions = submissionOperations.getByStudent(student.id);
    
    return {
      id: student.id,
      name: student.name,
      classroomId: student.classroom_id,
      currentCode: student.current_code || '',
      currentLanguage: student.current_language || 'python',
      isOnline: !!student.is_online,
      isPasswordSet: !!student.is_password_set,
      lastActive: student.last_active,
      handRaised: !!student.hand_raised,
      handRaisedAt: student.hand_raised_at || null,
      classroomTimer: getClassroomTimerForStudent(student.classroom_id),
      feedbacks: feedbacks.map(f => ({
        id: f.id,
        message: f.message,
        timestamp: f.created_at,
        isRead: !!f.is_read,
        fromTeacher: !!f.from_teacher
      })),
      submissions: submissions.map(s => ({
        id: s.id,
        assignmentId: s.assignment_id,
        code: s.code,
        language: s.language,
        timestamp: s.created_at,
        status: s.status
      }))
    };
  });
  
  res.json(result);
});

// ?脣??桀飛?底??
studentRoutes.get('/:id', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  if (student.classroom_id) {
    classroomNoteSyncOperations.syncClassroomToStudentProjects(student.classroom_id);
  }
  
  const code = codeOperations.getCode(student.id);
  const feedbacks = feedbackOperations.getByStudent(student.id);
  const submissions = submissionOperations.getByStudent(student.id);
  
  res.json({
    id: student.id,
    name: student.name,
    classroomId: student.classroom_id,
    currentCode: code?.current_code || '',
    currentLanguage: code?.current_language || 'python',
    isOnline: !!student.is_online,
    isPasswordSet: !!student.is_password_set,
    lastActive: student.last_active,
    handRaised: !!student.hand_raised,
    handRaisedAt: student.hand_raised_at || null,
    classroomTimer: getClassroomTimerForStudent(student.classroom_id),
    feedbacks: feedbacks.map(f => ({
      id: f.id,
      message: f.message,
      timestamp: f.created_at,
      isRead: !!f.is_read,
      fromTeacher: !!f.from_teacher
    })),
    submissions: submissions.map(s => ({
      id: s.id,
      assignmentId: s.assignment_id,
      code: s.code,
      language: s.language,
      timestamp: s.created_at,
      status: s.status
    }))
  });
});

// ?萄遣?啣飛??
studentRoutes.post('/', (req, res) => {
  const { name, classroomId } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Request failed' });
  }
  
  // 瑼Ｘ???臬撌脣???
  const existing = userOperations.getByName(name.trim(), 'student');
  if (existing) {
    return res.status(400).json({ error: 'Request failed' });
  }
  
  const student = userOperations.createStudent(name.trim(), classroomId);
  if (student.classroom_id) {
    classroomNoteSyncOperations.syncClassroomToStudentProjects(student.classroom_id);
  }
  
  // ???恥?嗥垢
  req.io.emit('student:created', {
    id: student.id,
    name: student.name,
    classroomId: student.classroom_id
  });
  
  res.json({
    id: student.id,
    name: student.name,
    classroomId: student.classroom_id,
    currentCode: createDefaultStudentCode(student.name),
    currentLanguage: 'python',
    isOnline: false,
    isPasswordSet: false,
    handRaised: false,
    handRaisedAt: null,
    classroomTimer: getClassroomTimerForStudent(student.classroom_id),
    feedbacks: [],
    submissions: []
  });
});

// ?湔摮貊??撅祆?摰?
studentRoutes.put('/:id/classroom', (req, res) => {
  const { classroomId } = req.body;
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }
  
  userOperations.updateStudentClassroom(req.params.id, classroomId);
  
  // ???恥?嗥垢
  req.io.emit('student:updated', {
    studentId: req.params.id,
    classroomId
  });
  
  res.json({ success: true });
});

// ?芷摮貊?
studentRoutes.delete('/:id', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }
  
  userOperations.deleteStudent(req.params.id);
  
  // ???恥?嗥垢
  req.io.emit('student:deleted', { studentId: req.params.id });
  
  res.json({ success: true });
});

// ?蔭摮貊?撖Ⅳ
studentRoutes.post('/:id/reset-password', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }
  
  userOperations.resetPassword(req.params.id);
  
  res.json({ success: true, message: '撖Ⅳ撌脤?蝵殷?摮貊?銝活?餃???閮剔蔭' });
});

// ?潮?擖策摮貊?
studentRoutes.post('/:id/feedback', (req, res) => {
  const { message } = req.body;
  
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Request failed' });
  }
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }
  
  const feedback = feedbackOperations.create(req.params.id, message.trim());
  
  const formattedFeedback = {
    id: feedback.id,
    message: feedback.message,
    timestamp: feedback.created_at,
    isRead: false,
    fromTeacher: true
  };
  
  // ?單??潮策摮貊?
  req.io.to(`student:${req.params.id}`).emit('feedback:new', formattedFeedback);
  
  res.json(formattedFeedback);
});

// ?湔摮貊?隞?Ⅳ
studentRoutes.put('/:id/code', (req, res) => {
  const { code, language } = req.body;
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }
  
  codeOperations.updateCode(req.params.id, code, language);
  userOperations.setOnlineStatus(req.params.id, true);
  
  // ?單?撱?蝯西葦
  req.io.to('teacher').emit('student:code-update', {
    studentId: req.params.id,
    code,
    language,
    lastActive: Date.now()
  });
  
  res.json({ success: true });
});

// 蝺渡?撠?

studentRoutes.post('/:id/help-request', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const updatedStudent = userOperations.setHelpRequest(req.params.id, true);
  const payload = formatHelpRequest(updatedStudent);

  req.io.to('teacher').emit('student:help-request', payload);
  req.io.to(`student:${req.params.id}`).emit('student:help-status', payload);

  res.json(payload);
});

studentRoutes.post('/:id/help-request/clear', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const updatedStudent = userOperations.setHelpRequest(req.params.id, false);
  const payload = formatHelpRequest(updatedStudent);

  req.io.to('teacher').emit('student:help-cleared', payload);
  req.io.to(`student:${req.params.id}`).emit('student:help-status', payload);

  res.json(payload);
});

studentRoutes.get('/:id/project-folders', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  if (student.classroom_id) {
    classroomNoteSyncOperations.syncClassroomToStudentProjects(student.classroom_id);
  }

  res.json(folderOperations.getByStudent(req.params.id).map(formatFolder));
});

studentRoutes.post('/:id/project-folders', (req, res) => {
  const { name, parentId } = req.body;
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Request failed' });
  }

  if (parentId && !folderOperations.getById(parentId, req.params.id)) {
    return res.status(404).json({ error: 'Request failed' });
  }

  res.json(formatFolder(folderOperations.create(req.params.id, name.trim(), parentId || null)));
});

studentRoutes.put('/:id/project-folders/:folderId', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const existingFolder = folderOperations.getById(req.params.folderId, req.params.id);
  if (existingFolder?.is_teacher_managed) {
    return res.status(403).json({ error: 'Request failed' });
  }

  const folder = folderOperations.update(req.params.folderId, req.params.id, req.body);
  if (!folder) {
    return res.status(404).json({ error: 'Request failed' });
  }

  res.json(formatFolder(folder));
});

studentRoutes.delete('/:id/project-folders/:folderId', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const existingFolder = folderOperations.getById(req.params.folderId, req.params.id);
  if (existingFolder?.is_teacher_managed) {
    return res.status(403).json({ error: 'Request failed' });
  }

  const result = folderOperations.deleteEmpty(req.params.folderId, req.params.id);
  if (!result.deleted && result.reason === 'not_empty') {
    return res.status(400).json({ error: 'Request failed' });
  }

  res.json({ success: true });
});

studentRoutes.get('/:id/projects', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  if (student.classroom_id) {
    classroomNoteSyncOperations.syncClassroomToStudentProjects(student.classroom_id);
  }

  res.json(projectOperations.getByStudent(req.params.id).map(formatProject));
});

studentRoutes.post('/:id/projects', (req, res) => {
  const { name, code, language, sourceAssignmentId, folderId } = req.body;
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Request failed' });
  }

  if (folderId && !folderOperations.getById(folderId, req.params.id)) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const project = projectOperations.create(
    req.params.id,
    name.trim(),
    code || '',
    language || 'python',
    sourceAssignmentId || null,
    folderId || null
  );

  res.json(formatProject(project));
});

studentRoutes.put('/:id/projects/:projectId', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  if (req.body.folderId && !folderOperations.getById(req.body.folderId, req.params.id)) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const existingProject = projectOperations.getById(req.params.projectId, req.params.id);
  if (existingProject?.is_read_only) {
    return res.status(403).json({ error: 'Request failed' });
  }

  const project = projectOperations.update(req.params.projectId, req.params.id, req.body);
  if (!project) {
    return res.status(404).json({ error: 'Request failed' });
  }

  res.json(formatProject(project));
});

studentRoutes.delete('/:id/projects/:projectId', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const existingProject = projectOperations.getById(req.params.projectId, req.params.id);
  if (existingProject?.is_read_only) {
    return res.status(403).json({ error: 'Request failed' });
  }

  projectOperations.delete(req.params.projectId, req.params.id);
  res.json({ success: true });
});

// ?漱雿平
studentRoutes.get('/:id/projects/:projectId/ai/messages', (req, res) => {
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const project = projectOperations.getById(req.params.projectId, req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Request failed' });
  }

  res.json(aiMessageOperations.getByProject(req.params.id, req.params.projectId).map(formatAiMessage));
});

studentRoutes.post('/:id/projects/:projectId/ai/messages', async (req, res) => {
  const { message, language, code, assignmentDescription, contextUrl, screenshot } = req.body;
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }

  const project = projectOperations.getById(req.params.projectId, req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Request failed' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Request failed' });
  }

  const existingMessages = aiMessageOperations.getByProject(req.params.id, req.params.projectId);
  const isFirstMessage = existingMessages.length === 0;
  if (isFirstMessage && !contextUrl?.trim() && !screenshot?.dataUrl) {
    return res.status(400).json({ error: 'Request failed' });
  }

  if (screenshot?.dataUrl && screenshot.dataUrl.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Request failed' });
  }

  try {
    const result = await generateTutorHint({
      history: existingMessages,
      message: message.trim(),
      language: language || project.language || 'python',
      code: code ?? project.code ?? '',
      assignmentDescription: assignmentDescription || '',
      contextUrl: contextUrl?.trim() || '',
      screenshot
    });

    const userMessage = aiMessageOperations.create(
      req.params.id,
      req.params.projectId,
      'user',
      message.trim(),
      {
        contextUrl: contextUrl?.trim(),
        attachmentName: screenshot?.name
      }
    );

    const assistantMessage = aiMessageOperations.create(
      req.params.id,
      req.params.projectId,
      'assistant',
      result.content,
      {}
    );

    res.json({
      userMessage: formatAiMessage(userMessage),
      assistantMessage: formatAiMessage(assistantMessage),
      thinkingSummary: result.thinkingSummary || ''
    });
  } catch (err) {
    console.error('Kimi tutor error:', err);
    res.status(500).json({ error: 'Request failed' });
  }
});

studentRoutes.post('/:id/submit', (req, res) => {
  const { assignmentId, code, language } = req.body;
  
  if (!assignmentId || !code) {
    return res.status(400).json({ error: 'Request failed' });
  }
  
  const student = userOperations.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Request failed' });
  }
  
  const assignment = assignmentOperations.getById(assignmentId);
  if (!assignment) {
    return res.status(404).json({ error: 'Request failed' });
  }
  if (!assignment.is_open) {
    return res.status(400).json({ error: 'Request failed' });
  }
  if (assignment.due_date && Date.now() > assignment.due_date) {
    return res.status(400).json({ error: 'Request failed' });
  }

  const submission = submissionOperations.saveLatest(
    req.params.id,
    assignmentId,
    code,
    language || 'python'
  );
  
  const formattedSubmission = {
    id: submission.id,
    assignmentId: submission.assignment_id,
    code: submission.code,
    language: submission.language,
    timestamp: submission.created_at,
    status: submission.status
  };
  
  // ??葦??漱
  req.io.to('teacher').emit('submission:new', {
    studentId: req.params.id,
    studentName: student.name,
    submission: formattedSubmission
  });
  
  res.json(formattedSubmission);
});

// 璅????箏歇霈
studentRoutes.post('/:id/feedback/read', (req, res) => {
  feedbackOperations.markAsRead(req.params.id);
  res.json({ success: true });
});

