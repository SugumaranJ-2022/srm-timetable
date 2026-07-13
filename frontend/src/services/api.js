import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
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
  getDepartments: () => api.get('/admin/departments').then(res => res.data),
  createDepartment: (name) => api.post('/admin/departments', { name }).then(res => res.data),
  
  getSubjects: () => api.get('/admin/subjects').then(res => res.data),
  createSubject: (data) => api.post('/admin/subjects', data).then(res => res.data),
  
  getClassrooms: () => api.get('/admin/classrooms').then(res => res.data),
  createClassroom: (data) => api.post('/admin/classrooms', data).then(res => res.data),
  
  getSections: () => api.get('/admin/sections').then(res => res.data),
  createSection: (data) => api.post('/admin/sections', data).then(res => res.data),
  
  getStaff: () => api.get('/admin/staff').then(res => res.data),
  createStaff: (data) => api.post('/admin/staff', data).then(res => res.data),
  
  getStudents: () => api.get('/admin/students').then(res => res.data),
  createStudent: (data) => api.post('/admin/students', data).then(res => res.data),

  getSectionSubjects: () => api.get('/admin/section-subjects').then(res => res.data),
  createSectionSubject: (data) => api.post('/admin/section-subjects', data).then(res => res.data),

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
  }
};

// Timetable endpoints
export const timetableApi = {
  generate: (academicYear, semester) => api.post('/timetables/generate', { academic_year: academicYear, semester }).then(res => res.data),
  getSectionTimetable: (sectionId) => api.get(`/timetables/section/${sectionId}`).then(res => res.data),
  getStaffTimetable: (staffId) => api.get(`/timetables/staff/${staffId}`).then(res => res.data),
  validateOverride: (timetableId, details) => api.post('/timetables/validate-override', { timetable_id: timetableId, details }).then(res => res.data),
  saveOverride: (timetableId, details) => api.put('/timetables/save-override', { timetable_id: timetableId, details }).then(res => res.data),
};

export default api;
