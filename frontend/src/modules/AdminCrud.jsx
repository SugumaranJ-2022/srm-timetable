import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import DataGrid from '../components/DataGrid';
import { 
  Plus, Upload, ShieldAlert, Sparkles, GraduationCap, Home, BookOpen, Layers, 
  FileSpreadsheet, Download, Info, Database, ChevronDown, ChevronUp, Users, AlertTriangle
} from 'lucide-react';

const AdminCrud = () => {
  const [activeTab, setActiveTab] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Registry States
  const [staff, setStaff] = useState([]);
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [secSubs, setSecSubs] = useState([]);

  // File Upload State (Master & Legacies)
  const [masterFile, setMasterFile] = useState(null);
  const [uploadType, setUploadType] = useState('classrooms');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showLegacyImports, setShowLegacyImports] = useState(false);

  // Forms Toggle
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Inputs State
  const [classroomForm, setClassroomForm] = useState({ room_number: '', building: '', floor: 0, capacity: 40 });
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', credits: 3, semester: 1, department_id: 1 });
  const [sectionForm, setSectionForm] = useState({ name: '', semester: 1, strength: 40, class_advisor_id: '' });
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: 'Password123!', phone: '', subject_ids: [] });
  const [secSubForm, setSecSubForm] = useState({ section_id: '', subject_id: '', assigned_staff_id: '' });

  // Load resources
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [depts, listStaff, listStudents, listRooms, listSubs, listSecs, listSecSubs] = await Promise.all([
        adminApi.getDepartments(),
        adminApi.getStaff(),
        adminApi.getStudents(),
        adminApi.getClassrooms(),
        adminApi.getSubjects(),
        adminApi.getSections(),
        adminApi.getSectionSubjects()
      ]);
      setDepartments(depts);
      setStaff(listStaff);
      setStudents(listStudents);
      setClassrooms(listRooms);
      setSubjects(listSubs);
      setSections(listSecs);
      setSecSubs(listSecSubs);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data registries from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Initialize standard department if empty
  useEffect(() => {
    const checkDept = async () => {
      if (departments.length === 0 && !loading) {
        try {
          await adminApi.createDepartment("Computer Applications");
          loadData();
        } catch (e) {}
      }
    };
    checkDept();
  }, [departments]);

  // Master Excel Upload (Wipes, Imports, Auto-Solves)
  const handleMasterUpload = async (e) => {
    e.preventDefault();
    if (!masterFile) {
      setError('Please select a master Excel file to upload.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await adminApi.importMaster(masterFile);
      setSuccess(`${res.message} Generated timetables for ${res.generation_results?.length || 0} semesters.`);
      setMasterFile(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Master import failed. Please verify spreadsheet columns and sheet names.');
    } finally {
      setLoading(false);
    }
  };

  // Master Template Download
  const handleTemplateDownload = async () => {
    try {
      const blob = await adminApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'timetable_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setError('Failed to download the template file.');
    }
  };

  // Bulk Import (Single Resource type)
  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a CSV or Excel file to upload.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await adminApi.importData(uploadType, selectedFile);
      setSuccess(`Successfully imported ${res.count} records!`);
      setSelectedFile(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed. Check CSV/Excel format.');
    } finally {
      setLoading(false);
    }
  };

  // Form Submissions
  const handleAddClassroom = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createClassroom(classroomForm);
      setSuccess('Classroom registered successfully!');
      setShowAddForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Validation error');
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    try {
      const deptId = departments[0]?.id || 1;
      await adminApi.createSubject({ ...subjectForm, department_id: deptId });
      setSuccess('Subject registered successfully!');
      setShowAddForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Validation error');
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createStaff(staffForm);
      setSuccess('Staff profile created successfully!');
      setShowAddForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Validation error');
    }
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    try {
      const advId = sectionForm.class_advisor_id ? parseInt(sectionForm.class_advisor_id) : null;
      await adminApi.createSection({ ...sectionForm, class_advisor_id: advId });
      setSuccess('Section profile created successfully!');
      setShowAddForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Validation error');
    }
  };

  const handleAddSectionSubject = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createSectionSubject({
        section_id: parseInt(secSubForm.section_id),
        subject_id: parseInt(secSubForm.subject_id),
        assigned_staff_id: parseInt(secSubForm.assigned_staff_id)
      });
      setSuccess('Subject mapped to Section and Staff successfully!');
      setShowAddForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Validation error. Avoid duplicate mappings.');
    }
  };

  // Datagrid Column definitions
  const columnsMap = {
    staff: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'phone', header: 'Phone' },
      { key: 'status', header: 'Status', render: (row) => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
          row.status === 'Active' ? 'bg-green-500/10 text-green-650 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-550 dark:text-red-400'
        }`}>{row.status}</span>
      )}
    ],
    classrooms: [
      { key: 'id', header: 'ID' },
      { key: 'room_number', header: 'Room No' },
      { key: 'building', header: 'Building' },
      { key: 'floor', header: 'Floor' },
      { key: 'capacity', header: 'Capacity' },
      { key: 'is_available', header: 'Availability', render: (row) => (
        <span>{row.is_available ? 'Available' : 'Reserved'}</span>
      )}
    ],
    subjects: [
      { key: 'code', header: 'Subject Code' },
      { key: 'name', header: 'Subject Name' },
      { key: 'credits', header: 'Credits' },
      { key: 'semester', header: 'Semester' }
    ],
    sections: [
      { key: 'name', header: 'Section Name' },
      { key: 'semester', header: 'Semester' },
      { key: 'strength', header: 'Cohort Size' },
      { key: 'class_advisor_id', header: 'Class Advisor ID' }
    ],
    mappings: [
      { key: 'section_id', header: 'Section ID', render: (row) => sections.find(s => s.id === row.section_id)?.name || row.section_id },
      { key: 'subject_id', header: 'Subject Code', render: (row) => subjects.find(s => s.id === row.subject_id)?.code || row.subject_id },
      { key: 'assigned_staff_id', header: 'Faculty Teacher', render: (row) => staff.find(s => s.id === row.assigned_staff_id)?.name || row.assigned_staff_id }
    ]
  };

  const getGridData = () => {
    if (activeTab === 'staff') return staff;
    if (activeTab === 'classrooms') return classrooms;
    if (activeTab === 'subjects') return subjects;
    if (activeTab === 'sections') return sections;
    if (activeTab === 'mappings') return secSubs;
    return [];
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Database className="w-7 h-7 text-brand-500" />
            Institutional Registry
          </h2>
          <p className="text-slate-550 dark:text-slate-400 mt-1 text-sm md:text-base">
            Wipe, load master data, and configure classrooms, staff roster, courses, and schedules.
          </p>
        </div>
      </div>

      {/* KPI Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <div className="bg-brand-500/10 p-3 rounded-xl border border-brand-500/20 text-brand-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider">Faculty Staff</div>
            <div className="text-xl font-extrabold text-slate-850 dark:text-white mt-0.5">{staff.length}</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-500">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider">Classrooms</div>
            <div className="text-xl font-extrabold text-slate-850 dark:text-white mt-0.5">{classrooms.length}</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-500">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider font-semibold">Subjects</div>
            <div className="text-xl font-extrabold text-slate-850 dark:text-white mt-0.5">{subjects.length}</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 text-purple-500">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider">Active Cohorts</div>
            <div className="text-xl font-extrabold text-slate-850 dark:text-white mt-0.5">{sections.length}</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/30 flex items-center gap-3 text-green-700 dark:text-green-400 text-sm">
          <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid Layout: Master Upload left, Registries right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
        
        {/* LEFT COLUMN: Master Excel Control Panel */}
        <div className="space-y-6">
          
          {/* Master Upload Premium Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-brand-500/15 dark:border-brand-500/10 relative overflow-hidden bg-gradient-to-br from-white to-brand-500/5 dark:from-slate-900/30 dark:to-brand-600/5 shadow-md">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl"></div>
            
            <div className="flex items-center gap-2.5 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-brand-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Master Excel Console</h3>
            </div>
            
            <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed mb-5">
              Upload your complete multi-sheet workbook (`timetable_data.xlsx`) containing staff roster, departments, subjects, classrooms, slots, and student registries to instantly reload databases and re-solve timetables.
            </p>

            {/* Drag & Drop Styled Upload Card */}
            <form onSubmit={handleMasterUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800/80 hover:border-brand-500/40 dark:hover:border-brand-500/40 rounded-2xl p-6 transition-all duration-300 text-center relative group bg-slate-50/50 dark:bg-slate-950/20 cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  required
                  onChange={(e) => setMasterFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center gap-2.5">
                  <div className="bg-slate-200/50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-300/30 dark:border-slate-800 group-hover:scale-105 transition-transform duration-300 text-slate-550 dark:text-slate-400 group-hover:text-brand-500">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {masterFile ? masterFile.name : 'Select Master Sheet'}
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-500">
                    Supported: .xlsx, .xls (Excel files only)
                  </div>
                </div>
              </div>

              {/* Warning box */}
              <div className="p-3 bg-red-950/10 border border-red-500/20 rounded-xl flex gap-2.5 items-start text-[11px] text-red-750 dark:text-red-300 font-semibold leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase text-red-650 dark:text-red-400">Caution:</span> Uploading a master sheet will overwrite current database records and wipe generated timetables.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !masterFile}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all disabled:opacity-50 text-xs shadow-md"
                >
                  <Database className="w-4 h-4" />
                  Wipe & Reload
                </button>
                
                <button
                  type="button"
                  onClick={handleTemplateDownload}
                  title="Download Current Database Template"
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Legacy / Single Resource Import Drawer */}
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <button
              onClick={() => setShowLegacyImports(!showLegacyImports)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all"
            >
              <div className="flex items-center gap-2 text-slate-750 dark:text-slate-350">
                <Info className="w-4 h-4 text-slate-450" />
                <span className="text-xs font-bold uppercase tracking-wider">Single Resource Importers</span>
              </div>
              {showLegacyImports ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLegacyImports && (
              <div className="p-6 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/20 dark:bg-slate-950/10 space-y-4">
                <p className="text-[11px] text-slate-450 leading-relaxed">
                  Import files for individual resources to append records incrementally without resetting the database.
                </p>
                <form onSubmit={handleImport} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500 mb-1">Target Resource</label>
                    <select
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-brand-500 focus:outline-none text-xs"
                    >
                      <option value="classrooms">Classrooms</option>
                      <option value="departments">Departments</option>
                      <option value="subjects">Subjects</option>
                      <option value="sections">Sections</option>
                      <option value="staff">Staff Roster</option>
                      <option value="students">Students List</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500 mb-1">CSV/Excel File</label>
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="w-full text-slate-500 text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-750 hover:bg-slate-650 text-white font-semibold transition-all disabled:opacity-50 text-xs shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Single Resource
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Registries Browser */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Sub Navigation Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-slate-200/40 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/40 max-w-max">
              {['staff', 'classrooms', 'subjects', 'sections', 'mappings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab 
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/30' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
                  }`}
                >
                  {tab === 'mappings' ? 'Subject Maps' : tab}
                </button>
              ))}
            </div>

            {/* Add Record button */}
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-850 dark:hover:bg-slate-850 border border-slate-250 dark:border-slate-850 text-slate-100 dark:text-slate-200 hover:text-white font-semibold transition-all text-xs shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Single Record
            </button>
          </div>

          {/* Table registry */}
          <div className="glass-panel p-4 md:p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <DataGrid
              columns={columnsMap[activeTab]}
              data={getGridData()}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Modal Add Single Record */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="glass-panel p-6 md:p-8 rounded-3xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">Register New Resource</h3>
              <button 
                onClick={() => setShowAddForm(false)} 
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold uppercase"
              >
                Close
              </button>
            </div>

            {/* Custom Modal Form selectors depending on tab */}
            {activeTab === 'classrooms' && (
              <form onSubmit={handleAddClassroom} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    value={classroomForm.room_number}
                    onChange={(e) => setClassroomForm({ ...classroomForm, room_number: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Building</label>
                  <input
                    type="text"
                    required
                    value={classroomForm.building}
                    onChange={(e) => setClassroomForm({ ...classroomForm, building: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Floor</label>
                    <input
                      type="number"
                      required
                      value={classroomForm.floor}
                      onChange={(e) => setClassroomForm({ ...classroomForm, floor: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Capacity</label>
                    <input
                      type="number"
                      required
                      value={classroomForm.capacity}
                      onChange={(e) => setClassroomForm({ ...classroomForm, capacity: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-md">
                  Register Classroom
                </button>
              </form>
            )}

            {activeTab === 'subjects' && (
              <form onSubmit={handleAddSubject} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Subject Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MCA101"
                    required
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Credits (Hours/Week)</label>
                    <input
                      type="number"
                      required
                      value={subjectForm.credits}
                      onChange={(e) => setSubjectForm({ ...subjectForm, credits: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Semester</label>
                    <input
                      type="number"
                      required
                      value={subjectForm.semester}
                      onChange={(e) => setSubjectForm({ ...subjectForm, semester: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-md">
                  Register Subject
                </button>
              </form>
            )}

            {activeTab === 'staff' && (
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Institutional Email</label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-md">
                  Create Staff Profile
                </button>
              </form>
            )}

            {activeTab === 'sections' && (
              <form onSubmit={handleAddSection} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Section Name (e.g. MCA A)</label>
                  <input
                    type="text"
                    required
                    value={sectionForm.name}
                    onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Semester</label>
                    <input
                      type="number"
                      required
                      value={sectionForm.semester}
                      onChange={(e) => setSectionForm({ ...sectionForm, semester: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Section Strength</label>
                    <input
                      type="number"
                      required
                      value={sectionForm.strength}
                      onChange={(e) => setSectionForm({ ...sectionForm, strength: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Class Advisor Faculty</label>
                  <select
                    value={sectionForm.class_advisor_id}
                    onChange={(e) => setSectionForm({ ...sectionForm, class_advisor_id: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 text-sm"
                  >
                    <option value="">No Advisor Assigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-md">
                  Create Section
                </button>
              </form>
            )}

            {activeTab === 'mappings' && (
              <form onSubmit={handleAddSectionSubject} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Section</label>
                  <select
                    required
                    value={secSubForm.section_id}
                    onChange={(e) => setSecSubForm({ ...secSubForm, section_id: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 text-sm"
                  >
                    <option value="">Select Section</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Sem {s.semester})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Subject</label>
                  <select
                    required
                    value={secSubForm.subject_id}
                    onChange={(e) => setSecSubForm({ ...secSubForm, subject_id: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 text-sm"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.code} - {sub.name} (Sem {sub.semester})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Assigned Teacher</label>
                  <select
                    required
                    value={secSubForm.assigned_staff_id}
                    onChange={(e) => setSecSubForm({ ...secSubForm, assigned_staff_id: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 text-sm"
                  >
                    <option value="">Select Teacher</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-md">
                  Map Subject Allocation
                </button>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCrud;
