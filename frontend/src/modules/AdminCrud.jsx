import React, { useState, useEffect } from 'react';
import { adminApi, timetableApi } from '../services/api';
import DataGrid from '../components/DataGrid';
import { 
  Plus, Upload, ShieldAlert, CheckCircle, GraduationCap, Home, BookOpen, Layers, 
  FileSpreadsheet, Download, Info, Database, ChevronDown, ChevronUp, Users, AlertTriangle, Trash2, Calendar,
  Lock, Unlock, Send, Sparkles, Globe, Check, Pencil
} from 'lucide-react';

const AdminCrud = () => {
  const [activeTab, setActiveTab] = useState('ug_prealloc');
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
  const [timeslots, setTimeslots] = useState([]);
  
  // UG Pre-allocation & Publish States
  const [preAllocatedSlots, setPreAllocatedSlots] = useState([]);
  const [publishStatus, setPublishStatus] = useState({ is_published: false, published_count: 0, total_count: 0 });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', confirmText: 'Confirm', onConfirm: null });

  const triggerConfirm = (title, message, confirmText, onConfirmAction) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        onConfirmAction();
      }
    });
  };
  const [preAllocForm, setPreAllocForm] = useState({
    section_id: '',
    subject_id: '',
    staff_id: '',
    day_of_week: 'Monday',
    period_number: 1,
    classroom_id: ''
  });

  // Quick Add Other Dept Subject / Staff Modal States
  const [quickAddModal, setQuickAddModal] = useState(null); // 'subject' | 'staff' | null
  const [quickSubForm, setQuickSubForm] = useState({ code: '', name: '', credits: 3, semester: 1, department_name: '' });
  const [quickStaffForm, setQuickStaffForm] = useState({ name: '', email: '', password: 'Staff123!', department_id: '' });

  // Days and Timeslots helper map
  const TIMESLOT_MAP = {
    'Monday_1': 1, 'Monday_2': 2, 'Monday_3': 3, 'Monday_5': 5, 'Monday_6': 6,
    'Tuesday_1': 7, 'Tuesday_2': 8, 'Tuesday_3': 9, 'Tuesday_5': 11, 'Tuesday_6': 12,
    'Wednesday_1': 13, 'Wednesday_2': 14, 'Wednesday_3': 15, 'Wednesday_5': 17, 'Wednesday_6': 18,
    'Thursday_1': 19, 'Thursday_2': 20, 'Thursday_3': 21, 'Thursday_5': 23, 'Thursday_6': 24,
    'Friday_1': 25, 'Friday_2': 26, 'Friday_3': 27, 'Friday_5': 29, 'Friday_6': 30
  };

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
  const [sectionForm, setSectionForm] = useState({ name: '', semester: 1, strength: 40, class_advisor_id: '', classroom_id: '' });
  const [secSubForm, setSecSubForm] = useState({ section_id: '', subject_id: '', assigned_staff_id: '' });

  // Single Record Edit Modal State
  const [editModal, setEditModal] = useState({ isOpen: false, tab: '', item: null, form: {} });

  // Load resources
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [depts, listStaff, listStudents, listRooms, listSubs, listSecs, listSecSubs, listPreAlloc, pubStat, listSlots] = await Promise.all([
        adminApi.getDepartments(),
        adminApi.getStaff(),
        adminApi.getStudents(),
        adminApi.getClassrooms(),
        adminApi.getSubjects(),
        adminApi.getSections(),
        adminApi.getSectionSubjects(),
        timetableApi.getPreAllocatedSlots(),
        timetableApi.getPublishStatus(),
        adminApi.getTimeSlots()
      ]);
      setDepartments(depts);
      setStaff(listStaff);
      setStudents(listStudents);
      setClassrooms(listRooms);
      setSubjects(listSubs);
      setSections(listSecs);
      setSecSubs(listSecSubs);
      setPreAllocatedSlots(listPreAlloc);
      setPublishStatus(pubStat);
      setTimeslots(listSlots || []);
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

  // Save / Lock Manual UG Pre-Allocated Slot
  const handleCreatePreAllocSlot = async (e) => {
    e.preventDefault();
    if (!preAllocForm.section_id || !preAllocForm.subject_id || !preAllocForm.staff_id) {
      setError('Please select Section, Subject, and Staff member.');
      return;
    }
    const key = `${preAllocForm.day_of_week}_${preAllocForm.period_number}`;
    const foundTs = timeslots.find(t => t.day_of_week === preAllocForm.day_of_week && t.period_number === parseInt(preAllocForm.period_number));
    const timeslot_id = foundTs ? foundTs.id : (TIMESLOT_MAP[key] || 1);

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await timetableApi.createPreAllocatedSlot({
        section_id: parseInt(preAllocForm.section_id),
        subject_id: parseInt(preAllocForm.subject_id),
        staff_id: parseInt(preAllocForm.staff_id),
        timeslot_id: timeslot_id,
        classroom_id: preAllocForm.classroom_id ? parseInt(preAllocForm.classroom_id) : null
      });
      setSuccess('UG Subject slot pre-allocated and locked successfully! Auto-solver will respect this fixed period.');
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to lock pre-allocated UG slot.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Pre-Allocated Slot
  const handleDeletePreAllocSlot = (slotId) => {
    triggerConfirm(
      "Remove Pre-Allocated UG Slot",
      "Are you sure you want to remove this locked pre-allocated UG slot?",
      "Delete Slot",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await timetableApi.deletePreAllocatedSlot(slotId);
          setSuccess('Pre-allocated UG slot removed.');
          loadData();
        } catch (err) {
          setError('Failed to delete pre-allocated slot.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Clear All Pre-Allocated Slots
  const handleClearAllPreAllocSlots = () => {
    triggerConfirm(
      "Clear All Pre-Allocated Slots",
      "Are you sure you want to remove all manually locked pre-allocated slots?",
      "Clear All",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await timetableApi.clearAllPreAllocatedSlots();
          setSuccess('All pre-allocated UG slots cleared.');
          loadData();
        } catch (err) {
          setError('Failed to clear pre-allocated slots.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Quick Create External / Other Dept Subject
  const handleCreateQuickSubject = async (e) => {
    e.preventDefault();
    if (!quickSubForm.code || !quickSubForm.name) {
      setError('Please provide subject code and name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let deptId = null;
      const typedDeptName = (quickSubForm.department_name || '').trim();
      
      if (typedDeptName) {
        const existingDept = departments.find(
          d => d.name.toLowerCase() === typedDeptName.toLowerCase()
        );
        if (existingDept) {
          deptId = existingDept.id;
        } else {
          const newDept = await adminApi.createDepartment(typedDeptName);
          deptId = newDept.id;
        }
      } else {
        deptId = departments[0]?.id || 1;
      }

      const newSub = await adminApi.createSubject({
        code: quickSubForm.code.toUpperCase(),
        name: quickSubForm.name,
        credits: parseInt(quickSubForm.credits) || 3,
        semester: parseInt(quickSubForm.semester) || 1,
        department_id: deptId,
        is_project: false
      });
      setSuccess(`Subject added: ${newSub.code} - ${newSub.name} (${typedDeptName || 'External Dept'})`);
      setQuickAddModal(null);
      setQuickSubForm({ code: '', name: '', credits: 3, semester: 1, department_name: '' });
      await loadData();
      setPreAllocForm(prev => ({ ...prev, subject_id: newSub.id.toString() }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create subject.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Create External / Other Dept Staff
  const handleCreateQuickStaff = async (e) => {
    e.preventDefault();
    if (!quickStaffForm.name || !quickStaffForm.email) {
      setError('Please provide staff name and email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const newStaff = await adminApi.createStaff({
        name: quickStaffForm.name,
        email: quickStaffForm.email,
        password: quickStaffForm.password || 'Staff123!',
        subject_ids: []
      });
      setSuccess(`Staff member added: ${newStaff.name}`);
      setQuickAddModal(null);
      setQuickStaffForm({ name: '', email: '', password: 'Staff123!', department_id: '' });
      await loadData();
      setPreAllocForm(prev => ({ ...prev, staff_id: newStaff.id.toString() }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create staff member.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Master Publish Status
  const handleTogglePublish = async (newStatus) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await timetableApi.publishTimetables(newStatus);
      setSuccess(newStatus 
        ? 'Timetable completed & PUBLISHED! It is now live and visible under all Staff & Class login IDs.' 
        : 'Timetable UNPUBLISHED. It is now in draft mode and hidden from non-admin logins.'
      );
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update publication status.');
    } finally {
      setLoading(false);
    }
  };

  // Run Master Timetable Generator (Preserving Pre-allocated Slots)
  const handleGenerateTimetables = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await timetableApi.generate("2026-2027", 1);
      setSuccess(`${res.message} Auto-generator filled all free spaces around your locked UG subjects!`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Timetable generation failed.');
    } finally {
      setLoading(false);
    }
  };

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

  // Wipe only solved timetables
  const handleWipeTimetables = () => {
    triggerConfirm(
      "Wipe Timetables Only",
      "Are you sure you want to delete all generated timetables? This will permanently erase solved schedules and pre-allocated slots but keep your classrooms, staff, and subjects.",
      "Wipe Timetables",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          const res = await timetableApi.wipe();
          setSuccess(res.message || 'Successfully wiped all timetables.');
          loadData();
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to wipe timetables.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Wipe entire database (master registry + timetables)
  const handleWipeAll = () => {
    triggerConfirm(
      "Wipe Entire Database",
      "DANGER: Are you sure you want to wipe ALL database records? This will delete all staff, classrooms, subjects, sections, subject maps, and timetables from the system.",
      "Wipe Entire DB",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          const res = await adminApi.wipeAll();
          setSuccess(res.message || 'All database records (Master Registry & Timetables) have been wiped successfully.');
          loadData();
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to wipe database records.');
        } finally {
          setLoading(false);
        }
      }
    );
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
      const roomId = sectionForm.classroom_id ? parseInt(sectionForm.classroom_id) : null;
      await adminApi.createSection({ ...sectionForm, class_advisor_id: advId, classroom_id: roomId });
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

  // Error Message Formatting Helper (safely handles strings, arrays, objects from FastAPI)
  const getErrorMessage = (err, fallback = 'Operation failed.') => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map(d => `${d.loc ? d.loc.filter(x => x !== 'body').join('.') + ': ' : ''}${d.msg}`).join('; ');
    }
    if (typeof detail === 'object' && detail !== null) {
      return JSON.stringify(detail);
    }
    return err?.message || fallback;
  };

  // Single Record Deletion Handlers
  const handleDeleteStaff = (row) => {
    triggerConfirm(
      "Delete Staff Record",
      `Are you sure you want to delete staff member "${row.name}"? This will remove all their section mappings, pre-allocations, and login access.`,
      "Delete Staff",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await adminApi.deleteStaff(row.id);
          setSuccess(`Staff record for ${row.name} deleted successfully.`);
          loadData();
        } catch (err) {
          setError(getErrorMessage(err, 'Failed to delete staff record.'));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDeleteClassroom = (row) => {
    triggerConfirm(
      "Delete Classroom Record",
      `Are you sure you want to delete Classroom "${row.room_number}" (${row.building})?`,
      "Delete Classroom",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await adminApi.deleteClassroom(row.id);
          setSuccess(`Classroom ${row.room_number} deleted successfully.`);
          loadData();
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to delete classroom record.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDeleteSubject = (row) => {
    triggerConfirm(
      "Delete Subject Record",
      `Are you sure you want to delete Subject "${row.code} - ${row.name}"? This will also remove all mappings and pre-allocations for this subject.`,
      "Delete Subject",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await adminApi.deleteSubject(row.id);
          setSuccess(`Subject ${row.code} deleted successfully.`);
          loadData();
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to delete subject record.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDeleteSection = (row) => {
    triggerConfirm(
      "Delete Section Record",
      `Are you sure you want to delete Section "${row.name}"? This will remove its timetables, mappings, and student references.`,
      "Delete Section",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await adminApi.deleteSection(row.id);
          setSuccess(`Section ${row.name} deleted successfully.`);
          loadData();
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to delete section record.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDeleteSectionSubject = (row) => {
    triggerConfirm(
      "Delete Subject Mapping",
      "Are you sure you want to remove this Section-Subject-Staff mapping?",
      "Delete Mapping",
      async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await adminApi.deleteSectionSubject(row.id);
          setSuccess("Subject mapping removed successfully.");
          loadData();
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to delete subject mapping.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Open Edit Modal & Populate Form
  const openEditModal = (tab, item) => {
    let initialForm = {};
    if (tab === 'staff') {
      initialForm = { name: item.name || '', email: item.email || item.user?.email || '', phone: item.phone || '', status: item.status || 'Active' };
    } else if (tab === 'classrooms') {
      initialForm = { room_number: item.room_number || '', building: item.building || '', floor: item.floor || 0, capacity: item.capacity || 40, room_type: item.room_type || 'Lecture' };
    } else if (tab === 'subjects') {
      initialForm = { code: item.code || '', name: item.name || '', credits: item.credits || 3, semester: item.semester || 1, department_id: item.department_id || (departments[0]?.id || 1), is_project: item.is_project || false };
    } else if (tab === 'sections') {
      initialForm = { name: item.name || '', program: item.program || 'MCA', semester: item.semester || 1, strength: item.strength || 40, class_advisor_id: item.class_advisor_id || '', classroom_id: item.classroom_id || '', enable_zero_free_periods: item.enable_zero_free_periods !== false };
    } else if (tab === 'mappings') {
      initialForm = { section_id: item.section_id || '', subject_id: item.subject_id || '', assigned_staff_id: item.assigned_staff_id || '', weekly_periods: item.weekly_periods || 4 };
    }
    setEditModal({ isOpen: true, tab, item, form: initialForm });
  };

  // Handle Edit Submission
  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const { tab, item, form } = editModal;
    try {
      if (tab === 'staff') {
        const payload = {
          name: form.name,
          phone: form.phone || null,
          status: form.status || 'Active',
          subject_ids: []
        };
        if (form.email && form.email.trim()) {
          payload.email = form.email.trim();
        }
        await adminApi.updateStaff(item.id, payload);
        setSuccess(`Staff member ${form.name} updated successfully!`);
      } else if (tab === 'classrooms') {
        await adminApi.updateClassroom(item.id, {
          room_number: form.room_number,
          building: form.building,
          floor: parseInt(form.floor) || 0,
          capacity: parseInt(form.capacity) || 40,
          room_type: form.room_type || 'Lecture'
        });
        setSuccess(`Classroom ${form.room_number} updated successfully!`);
      } else if (tab === 'subjects') {
        await adminApi.updateSubject(item.id, {
          code: form.code,
          name: form.name,
          credits: parseInt(form.credits) || 3,
          semester: parseInt(form.semester) || 1,
          department_id: parseInt(form.department_id) || (departments[0]?.id || 1),
          is_project: Boolean(form.is_project)
        });
        setSuccess(`Subject ${form.code} updated successfully!`);
      } else if (tab === 'sections') {
        await adminApi.updateSection(item.id, {
          name: form.name,
          program: form.program || 'MCA',
          semester: parseInt(form.semester) || 1,
          strength: parseInt(form.strength) || 40,
          class_advisor_id: form.class_advisor_id ? parseInt(form.class_advisor_id) : null,
          classroom_id: form.classroom_id ? parseInt(form.classroom_id) : null,
          enable_zero_free_periods: Boolean(form.enable_zero_free_periods)
        });
        setSuccess(`Section ${form.name} updated successfully!`);
      } else if (tab === 'mappings') {
        await adminApi.updateSectionSubject(item.id, {
          section_id: parseInt(form.section_id),
          subject_id: parseInt(form.subject_id),
          assigned_staff_id: parseInt(form.assigned_staff_id),
          weekly_periods: parseInt(form.weekly_periods) || 4
        });
        setSuccess(`Subject mapping updated successfully!`);
      }
      setEditModal({ isOpen: false, tab: '', item: null, form: {} });
      loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update record.'));
    } finally {
      setLoading(false);
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
      )},
      { key: 'actions', header: 'Actions', sortable: false, render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal('staff', row)}
            className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
            title="Edit Staff Member"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteStaff(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete Staff Member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
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
      )},
      { key: 'actions', header: 'Actions', sortable: false, render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal('classrooms', row)}
            className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
            title="Edit Classroom"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClassroom(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete Classroom"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    ],
    subjects: [
      { key: 'code', header: 'Subject Code' },
      { key: 'name', header: 'Subject Name' },
      { key: 'credits', header: 'Credits' },
      { key: 'semester', header: 'Semester' },
      { key: 'actions', header: 'Actions', sortable: false, render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal('subjects', row)}
            className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
            title="Edit Subject"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteSubject(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete Subject"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    ],
    sections: [
      { key: 'name', header: 'Section Name' },
      { key: 'semester', header: 'Semester' },
      { key: 'strength', header: 'Cohort Size' },
      { key: 'classroom_id', header: 'Designated Room', render: (row) => classrooms.find(c => c.id === row.classroom_id)?.room_number || 'None' },
      { key: 'class_advisor_id', header: 'Class Advisor', render: (row) => staff.find(s => s.id === row.class_advisor_id)?.name || 'None' },
      { key: 'actions', header: 'Actions', sortable: false, render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal('sections', row)}
            className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
            title="Edit Section"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteSection(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete Section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    ],
    mappings: [
      { key: 'section_id', header: 'Section ID', render: (row) => sections.find(s => s.id === row.section_id)?.name || row.section_id },
      { key: 'subject_id', header: 'Subject Code', render: (row) => subjects.find(s => s.id === row.subject_id)?.code || row.subject_id },
      { key: 'assigned_staff_id', header: 'Faculty Teacher', render: (row) => staff.find(s => s.id === row.assigned_staff_id)?.name || row.assigned_staff_id },
      { key: 'actions', header: 'Actions', sortable: false, render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal('mappings', row)}
            className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
            title="Edit Mapping"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteSectionSubject(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete Mapping"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
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
          <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/30 flex items-center gap-3 text-green-700 dark:text-green-400 text-sm">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
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

          {/* Wipe System Data Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-red-500/15 dark:border-red-500/10 relative overflow-hidden bg-gradient-to-br from-white to-red-500/5 dark:from-slate-900/30 dark:to-red-650/5 shadow-md">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl"></div>
            
            <div className="flex items-center gap-2.5 mb-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Wipe & Reset System Data</h3>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleWipeAll}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all disabled:opacity-50 text-xs shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                Wipe Entire Database (All Master Data & Timetables)
              </button>

              <button
                type="button"
                onClick={handleWipeTimetables}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold transition-all disabled:opacity-50 text-xs"
              >
                <Calendar className="w-4 h-4" />
                Wipe Timetables Only
              </button>
            </div>
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
                      <option value="calendar">Academic Calendar</option>
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
              {['ug_prealloc', 'staff', 'classrooms', 'subjects', 'sections', 'mappings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === tab 
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/30' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
                  }`}
                >
                  {tab === 'ug_prealloc' && <Lock className="w-3 h-3 text-amber-500" />}
                  {tab === 'ug_prealloc' ? 'UG Pre-Alloc & Publish' : tab === 'mappings' ? 'Subject Maps' : tab}
                </button>
              ))}
            </div>

            {/* Add Record button */}
            {activeTab !== 'ug_prealloc' && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-850 dark:hover:bg-slate-850 border border-slate-250 dark:border-slate-850 text-slate-100 dark:text-slate-200 hover:text-white font-semibold transition-all text-xs shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Single Record
              </button>
            )}
          </div>

          {/* Render Tab Content */}
          {activeTab === 'ug_prealloc' ? (
            <div className="space-y-6">
              
              {/* Publication Status & Release Control Panel */}
              <div className={`p-6 rounded-3xl border transition-all duration-300 shadow-md ${
                publishStatus.is_published
                  ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-teal-950/30 border-emerald-500/30 dark:border-emerald-500/40'
                  : 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 dark:from-amber-950/40 dark:via-slate-900/60 dark:to-orange-950/30 border-amber-500/30 dark:border-amber-500/40'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Globe className={`w-5 h-5 ${publishStatus.is_published ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Timetable Release & Login Visibility</h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
                        publishStatus.is_published 
                          ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40' 
                          : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                      }`}>
                        {publishStatus.is_published ? <Check className="w-3.5 h-3.5 stroke-[3]"/> : <Lock className="w-3.5 h-3.5 stroke-[3]"/>}
                        {publishStatus.is_published ? 'PUBLISHED & LIVE' : 'DRAFT MODE (Admin Only)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1.5 leading-relaxed">
                      {publishStatus.is_published 
                        ? 'Timetables are currently PUBLISHED and visible to all Class & Staff logins.' 
                        : 'Timetable is currently being prepared by Admin. Non-admin logins see a status message until published.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {publishStatus.is_published ? (
                      <button
                        onClick={() => handleTogglePublish(false)}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02] cursor-pointer"
                      >
                        <Lock className="w-4 h-4" />
                        Unpublish to Draft Mode
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTogglePublish(true)}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 hover:scale-[1.02] cursor-pointer"
                      >
                        <Globe className="w-4 h-4" />
                        Complete & Publish Timetable to All Logins
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* UG Subject Manual Pre-Allocation Form */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-amber-500" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Pre-allocate & Lock UG Subjects</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Manually assign UG subjects (e.g., Tamil, English, Maths, Hindi taught by other department faculty) to fixed time periods before running the master solver.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCreatePreAllocSlot} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500 mb-1">Target Section / Class</label>
                    <select
                      required
                      value={preAllocForm.section_id}
                      onChange={(e) => setPreAllocForm({ ...preAllocForm, section_id: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Select Class --</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.program})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500">UG Subject</label>
                      <button
                        type="button"
                        onClick={() => setQuickAddModal('subject')}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                        title="Add Subject from External / Other Department"
                      >
                        <Plus className="w-3 h-3" /> Add Other Dept Subject
                      </button>
                    </div>
                    <select
                      required
                      value={preAllocForm.subject_id}
                      onChange={(e) => setPreAllocForm({ ...preAllocForm, subject_id: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Select Subject --</option>
                      {subjects.map(sub => {
                        const dept = departments.find(d => d.id === sub.department_id);
                        return (
                          <option key={sub.id} value={sub.id}>
                            {sub.code} - {sub.name} {dept ? `[${dept.name}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500">Assigned Faculty</label>
                      <button
                        type="button"
                        onClick={() => setQuickAddModal('staff')}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                        title="Add Faculty Member from External / Other Department"
                      >
                        <Plus className="w-3 h-3" /> Add Other Dept Staff
                      </button>
                    </div>
                    <select
                      required
                      value={preAllocForm.staff_id}
                      onChange={(e) => setPreAllocForm({ ...preAllocForm, staff_id: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Select Staff Member --</option>
                      {staff.map(stf => (
                        <option key={stf.id} value={stf.id}>
                          {stf.name} ({stf.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500 mb-1">Day of Week</label>
                    <select
                      value={preAllocForm.day_of_week}
                      onChange={(e) => setPreAllocForm({ ...preAllocForm, day_of_week: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500 mb-1">Period Hour</label>
                    <select
                      value={preAllocForm.period_number}
                      onChange={(e) => setPreAllocForm({ ...preAllocForm, period_number: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value={1}>Hour 1 (08:15 - 09:00)</option>
                      <option value={2}>Hour 2 (09:00 - 09:45)</option>
                      <option value={3}>Hour 3 (09:45 - 10:30)</option>
                      <option value={5}>Hour 4 (11:00 - 11:45)</option>
                      <option value={6}>Hour 5 (11:45 - 12:30)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-450 dark:text-slate-500 mb-1">Classroom Allocation</label>
                    <select
                      value={preAllocForm.classroom_id}
                      onChange={(e) => setPreAllocForm({ ...preAllocForm, classroom_id: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">Default Homeroom</option>
                      {classrooms.map(cr => (
                        <option key={cr.id} value={cr.id}>
                          {cr.room_number} ({cr.building})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md hover:scale-[1.01]"
                    >
                      <Lock className="w-4 h-4" />
                      Lock Pre-Allocated UG Slot
                    </button>
                  </div>
                </form>
              </div>

              {/* Table of Pre-Allocated Locked UG Slots */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    Current Locked Pre-Allocated Slots ({preAllocatedSlots.length})
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {preAllocatedSlots.length > 0 && (
                      <button
                        onClick={handleClearAllPreAllocSlots}
                        disabled={loading}
                        className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1.5 transition-all border border-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Clear All Locked Slots
                      </button>
                    )}
                    <button
                      onClick={handleGenerateTimetables}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Master Timetable (Fill Free Spaces)
                    </button>
                  </div>
                </div>

                {preAllocatedSlots.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    No UG subjects pre-allocated yet. Use the form above to lock fixed periods for Tamil, English, Maths, Hindi, etc.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800/60 text-slate-450 dark:text-slate-500 uppercase font-bold text-[10px]">
                          <th className="py-2.5 px-3">Class / Section</th>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3">Assigned Faculty</th>
                          <th className="py-2.5 px-3">Day & Period</th>
                          <th className="py-2.5 px-3">Classroom</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                        {preAllocatedSlots.map(slot => {
                          const subObj = subjects.find(s => s.id === slot.subject_id);
                          const deptObj = subObj ? departments.find(d => d.id === subObj.department_id) : null;
                          return (
                            <tr key={slot.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                              <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                                {slot.section_name}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{slot.subject_name}</span>
                                  {deptObj && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                                      {deptObj.name}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500">{slot.subject_code}</div>
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                                {slot.staff_name}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30 text-[11px]">
                                  {slot.day_of_week} Period {slot.period_number}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                                {slot.room_number || 'Homeroom'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => handleDeletePreAllocSlot(slot.id)}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                                  title="Delete Pre-Allocated Slot"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-4 md:p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
              <DataGrid
                columns={columnsMap[activeTab]}
                data={getGridData()}
                loading={loading}
              />
            </div>
          )}
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
                <div>
                  <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Designated Classroom</label>
                  <select
                    value={sectionForm.classroom_id}
                    onChange={(e) => setSectionForm({ ...sectionForm, classroom_id: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 text-sm"
                  >
                    <option value="">No Classroom Designated</option>
                    {classrooms.map(c => (
                      <option key={c.id} value={c.id}>{c.room_number} (Cap: {c.capacity})</option>
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

      {/* Custom Confirmation Modal Overlay */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Action confirmation required
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Add Other Dept Subject / Staff Modal */}
      {quickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                {quickAddModal === 'subject' ? 'Add External / Other Dept Subject' : 'Add External / Other Dept Staff'}
              </h3>
              <button
                type="button"
                onClick={() => setQuickAddModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {quickAddModal === 'subject' ? (
              <form onSubmit={handleCreateQuickSubject} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject Code (e.g. TAM101, ENG101, MAT101, HIN101)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TAM101"
                    value={quickSubForm.code}
                    onChange={(e) => setQuickSubForm({ ...quickSubForm, code: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject Name (e.g. Tamil I, Technical English, Maths, Hindi)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tamil I"
                    value={quickSubForm.name}
                    onChange={(e) => setQuickSubForm({ ...quickSubForm, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Department Name (e.g. Department of Tamil, Department of Hindi, Mathematics)</label>
                  <input
                    type="text"
                    placeholder="e.g. Department of Tamil"
                    value={quickSubForm.department_name}
                    onChange={(e) => setQuickSubForm({ ...quickSubForm, department_name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Credits / Hours</label>
                    <input
                      type="number"
                      value={quickSubForm.credits}
                      onChange={(e) => setQuickSubForm({ ...quickSubForm, credits: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                    <input
                      type="number"
                      value={quickSubForm.semester}
                      onChange={(e) => setQuickSubForm({ ...quickSubForm, semester: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setQuickAddModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md"
                  >
                    Add Subject
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateQuickStaff} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Faculty Full Name (e.g. Dr. Ramanathan / Prof. Priya)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Tamil Faculty"
                    value={quickStaffForm.name}
                    onChange={(e) => setQuickStaffForm({ ...quickStaffForm, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Faculty Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. faculty.external@srmist.edu.in"
                    value={quickStaffForm.email}
                    onChange={(e) => setQuickStaffForm({ ...quickStaffForm, email: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-750 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setQuickAddModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md"
                  >
                    Add Faculty Member
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="glass-panel p-6 md:p-8 rounded-3xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                <Pencil className="w-4 h-4 text-brand-500" />
                Modify {editModal.tab.toUpperCase()} Record
              </h3>
              <button 
                onClick={() => setEditModal({ isOpen: false, tab: '', item: null, form: {} })} 
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold uppercase"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4 text-xs">
              {editModal.tab === 'staff' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editModal.form.name || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Institutional Email</label>
                    <input
                      type="email"
                      value={editModal.form.email || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, email: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editModal.form.phone || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, phone: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Status</label>
                    <select
                      value={editModal.form.status || 'Active'}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, status: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </>
              )}

              {editModal.tab === 'classrooms' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Room Number</label>
                    <input
                      type="text"
                      required
                      value={editModal.form.room_number || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, room_number: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Building</label>
                    <input
                      type="text"
                      required
                      value={editModal.form.building || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, building: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Floor</label>
                      <input
                        type="number"
                        required
                        value={editModal.form.floor || 0}
                        onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, floor: e.target.value } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Capacity</label>
                      <input
                        type="number"
                        required
                        value={editModal.form.capacity || 40}
                        onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, capacity: e.target.value } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {editModal.tab === 'subjects' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Subject Code</label>
                    <input
                      type="text"
                      required
                      value={editModal.form.code || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, code: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Subject Name</label>
                    <input
                      type="text"
                      required
                      value={editModal.form.name || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Credits</label>
                      <input
                        type="number"
                        required
                        value={editModal.form.credits || 3}
                        onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, credits: e.target.value } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Semester</label>
                      <input
                        type="number"
                        required
                        value={editModal.form.semester || 1}
                        onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, semester: e.target.value } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {editModal.tab === 'sections' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Section Name</label>
                    <input
                      type="text"
                      required
                      value={editModal.form.name || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Semester</label>
                      <input
                        type="number"
                        required
                        value={editModal.form.semester || 1}
                        onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, semester: e.target.value } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Strength</label>
                      <input
                        type="number"
                        required
                        value={editModal.form.strength || 40}
                        onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, strength: e.target.value } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Class Advisor</label>
                    <select
                      value={editModal.form.class_advisor_id || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, class_advisor_id: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">No Advisor</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Designated Classroom</label>
                    <select
                      value={editModal.form.classroom_id || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, classroom_id: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">No Room Assigned</option>
                      {classrooms.map(c => (
                        <option key={c.id} value={c.id}>{c.room_number} ({c.building})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {editModal.tab === 'mappings' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Section</label>
                    <select
                      required
                      value={editModal.form.section_id || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, section_id: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select Section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Subject</label>
                    <select
                      required
                      value={editModal.form.subject_id || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, subject_id: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Assigned Teacher</label>
                    <select
                      required
                      value={editModal.form.assigned_staff_id || ''}
                      onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, assigned_staff_id: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select Teacher</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal({ isOpen: false, tab: '', item: null, form: {} })}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCrud;
