import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const api = axios.create({
  baseURL: rawBaseURL.endsWith('/api/v1') ? rawBaseURL : `${rawBaseURL.replace(/\/$/, '')}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token in outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth endpoints
export const authApi = {
  login: async (email, password) => {
    // Standard OAuth2 form-data login
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
  },
  register: async (email, password, role = 'Student') => {
    const response = await api.post('/auth/register', { email, password, role });
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Admin CRUD endpoints
export const adminApi = {
  getTimeSlots: () => api.get('/admin/timeslots').then(res => res.data),
  getDepartments: () => api.get('/admin/departments').then(res => res.data),
  createDepartment: (name) => api.post('/admin/departments', { name }).then(res => res.data),
  
  getSubjects: () => api.get('/admin/subjects').then(res => res.data),
  createSubject: (data) => api.post('/admin/subjects', data).then(res => res.data),
  updateSubject: (id, data) => api.put(`/admin/subjects/${id}`, data).then(res => res.data),
  deleteSubject: (id) => api.delete(`/admin/subjects/${id}`).then(res => res.data),
  
  getClassrooms: () => api.get('/admin/classrooms').then(res => res.data),
  createClassroom: (data) => api.post('/admin/classrooms', data).then(res => res.data),
  updateClassroom: (id, data) => api.put(`/admin/classrooms/${id}`, data).then(res => res.data),
  deleteClassroom: (id) => api.delete(`/admin/classrooms/${id}`).then(res => res.data),
  
  getSections: () => api.get('/admin/sections').then(res => res.data),
  createSection: (data) => api.post('/admin/sections', data).then(res => res.data),
  updateSection: (id, data) => api.put(`/admin/sections/${id}`, data).then(res => res.data),
  deleteSection: (id) => api.delete(`/admin/sections/${id}`).then(res => res.data),
  
  getStaff: () => api.get('/admin/staff').then(res => res.data),
  createStaff: (data) => api.post('/admin/staff', data).then(res => res.data),
  updateStaff: (id, data) => api.put(`/admin/staff/${id}`, data).then(res => res.data),
  deleteStaff: (id) => api.delete(`/admin/staff/${id}`).then(res => res.data),
  
  getStudents: () => api.get('/admin/students').then(res => res.data),
  createStudent: (data) => api.post('/admin/students', data).then(res => res.data),

  getSectionSubjects: () => api.get('/admin/section-subjects').then(res => res.data),
  createSectionSubject: (data) => api.post('/admin/section-subjects', data).then(res => res.data),
  updateSectionSubject: (id, data) => api.put(`/admin/section-subjects/${id}`, data).then(res => res.data),
  deleteSectionSubject: (id) => api.delete(`/admin/section-subjects/${id}`).then(res => res.data),

  importData: (type, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/admin/import?type=${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
  },

  importMaster: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/import-master', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
  },

  downloadTemplate: () => {
    return api.get('/admin/download-template', { responseType: 'blob' }).then(res => res.data);
  },

  wipeAll: () => api.post('/admin/wipe-all').then(res => res.data)
};

// Timetable endpoints
export const timetableApi = {
  getPublicStaff: () => api.get('/timetables/public/staff').then(res => res.data),
  getPublicSections: () => api.get('/timetables/public/sections').then(res => res.data),
  generate: (academicYear, semester) => api.post('/timetables/generate', { academic_year: academicYear, semester }).then(res => res.data),
  getSectionTimetable: (sectionId, date = '') => api.get(`/timetables/section/${sectionId}${date ? `?date=${date}` : ''}`).then(res => res.data),
  getStaffTimetable: (staffId) => api.get(`/timetables/staff/${staffId}`).then(res => res.data),
  validateOverride: (timetableId, details) => api.post('/timetables/validate-override', { timetable_id: timetableId, details }).then(res => res.data),
  saveOverride: (timetableId, details) => api.put('/timetables/save-override', { timetable_id: timetableId, details }).then(res => res.data),
  wipe: () => api.post('/timetables/wipe').then(res => res.data),
  getLiveStatus: (date, time) => api.get(`/timetables/live-status?date=${date}&time=${time}`).then(res => res.data),
  getTeacherScheduleForAbsence: (staffId, date) => api.get(`/timetables/absence/schedule?staff_id=${staffId}&date=${date}`).then(res => res.data),
  createSubstitution: (data) => api.post('/timetables/substitution', data).then(res => res.data),
  deleteSubstitution: (subId) => api.delete(`/timetables/substitution/${subId}`).then(res => res.data),
  getSubstitutionsByDate: (date) => api.get(`/timetables/substitutions/date/${date}`).then(res => res.data),
  getStaffLoadAnalytics: () => api.get('/timetables/analytics/staff-load').then(res => res.data),
  
  getPreAllocatedSlots: (sectionId = null) => api.get(`/timetables/pre-allocated-slots${sectionId ? `?section_id=${sectionId}` : ''}`).then(res => res.data),
  createPreAllocatedSlot: (data) => api.post('/timetables/pre-allocated-slots', data).then(res => res.data),
  deletePreAllocatedSlot: (slotId) => api.delete(`/timetables/pre-allocated-slots/${slotId}`).then(res => res.data),
  clearAllPreAllocatedSlots: () => api.delete('/timetables/pre-allocated-slots-clear-all').then(res => res.data),
  publishTimetables: (isPublished, semester = null) => api.post('/timetables/publish', { is_published: isPublished, semester }).then(res => res.data),
  getPublishStatus: () => api.get('/timetables/publish-status').then(res => res.data),

  auditConflicts: () => api.get('/timetables/audit-conflicts').then(res => res.data),
  getClassroomUtilization: () => api.get('/timetables/classrooms/utilization').then(res => res.data),
  getSubjectProgress: () => api.get('/timetables/subjects/progress').then(res => res.data),
  submitAutoLeaveRequest: (staffId, date, reason) => api.post('/timetables/substitutions/auto-leave', { staff_id: staffId, date, reason }).then(res => res.data),

  getMasterMatrix: () => api.get('/timetables/master-matrix').then(res => res.data),
  generateExamSchedule: (payload) => api.post('/timetables/generate-exam-schedule', payload).then(res => res.data),
  getExamSchedules: () => api.get('/timetables/exam-schedules').then(res => res.data),
  createBroadcast: (payload) => api.post('/timetables/broadcasts', payload).then(res => res.data),
  getBroadcasts: () => api.get('/timetables/broadcasts').then(res => res.data),
  updateSolverSettings: (payload) => api.post('/timetables/solver-settings', payload).then(res => res.data),
  getSolverSettings: () => api.get('/timetables/solver-settings').then(res => res.data),

  getICalUrl: (role, targetId) => `${api.defaults.baseURL || '/api/v1'}/timetables/export/ical/${role}/${targetId}`,
  saveStaffPreferences: (payload) => api.post('/timetables/staff-preferences', payload).then(res => res.data),
  getStaffPreferences: (staffId) => api.get(`/timetables/staff-preferences/${staffId}`).then(res => res.data),
  getClassroomEquipmentAudit: () => api.get('/timetables/classrooms/equipment-audit').then(res => res.data),
  getOpenElectivePool: () => api.get('/timetables/electives/pool').then(res => res.data),
};

export const calendarApi = {
  getEvents: () => api.get('/admin/calendar-events').then(res => res.data),
  createEvent: (eventData) => api.post('/admin/calendar-events', eventData).then(res => res.data),
  deleteEvent: (eventId) => api.delete(`/admin/calendar-events/${eventId}`).then(res => res.data),
  clearEvents: () => api.delete('/admin/calendar-events-clear').then(res => res.data),
};

export default api;
