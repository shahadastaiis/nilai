import React, { useState, useEffect, useMemo } from 'react';
import { User, AcademicYear, StudentEnrollment, Role, GradeStatus, MasterSubject, SubjectView, UserStatus, Class, ClassSubject, ClassRecapRow, StudentGradeView } from '../types';
import { getAcademicYears, getAdminData, assignStudentToClass, bulkAssignStudentsToClass, createSubjectAssignment, bulkCreateSubjectAssignments, getSubjectsByYear, getEnrollmentsByYear, getClassEnrollments, toggleSemesterStatus, subscribeToData, createClass, getClassesByYear, getClassRecap, getMasterSubjects, bulkCreateUsers, bulkCreateMasterSubjects, removeSubjectAssignment, removeStudentFromClass, publishClassGrades, updateSubjectStatus, reloadSpecificData, normalizeGender, getStudentGrades, getAllStudentGrades, publishAllGradesInYear, isOfflineModeActive, getApiUrl } from '../services/mockData';
import { showSuccess, showError, confirmDelete, confirmAction } from '../utils/swal';
import SheetsConfigModal from './SheetsConfigModal';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  user: User;
  logoUrl?: string;
  onUpdateLogo?: (url: string) => void;
  activeMenu: string;
  onMenuChange: (menu: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, activeMenu, onMenuChange }) => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [reloading, setReloading] = useState(false);
  
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getAcademicYears().then(yrs => {
        setYears(yrs);
        const active = yrs.find(y => y.isActive) || yrs[0];
        if (active) setSelectedYear(active.id);
    });

    const unsubscribe = subscribeToData(() => setRefreshKey(prev => prev + 1));
    return () => unsubscribe();
  }, []);

  const handleReload = async () => {
      setReloading(true);
      try {
          let targets: string[] = [];
          switch(activeMenu) {
              case 'students':
              case 'lecturers': targets = ['users']; break;
              case 'subjects': targets = ['master_subjects']; break;
              case 'classes': targets = ['classes', 'class_subjects', 'student_enrollments', 'users']; break;
              case 'settings': targets = ['academic_years', 'classes', 'class_subjects']; break;
              case 'report':
              case 'khs': targets = ['classes', 'student_enrollments', 'class_subjects', 'grades', 'users', 'academic_years']; break;
              default: targets = ['academic_years'];
          }
          await reloadSpecificData(targets);
          showSuccess('تم تحديث البيانات بنجاح');
      } catch (e) {
          showError('فشل تحديث البيانات');
      } finally {
          setReloading(false);
      }
  };

  // --- HEADER SECTION ---
  const HeaderBlock = () => (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
            <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-[#064E3B] tracking-tight leading-tight">
                    {activeMenu === 'students' && 'الطلاب'}
                    {activeMenu === 'lecturers' && 'هيئة التدريس'}
                    {activeMenu === 'subjects' && 'المقررات'}
                    {activeMenu === 'classes' && 'الفصول'}
                    {activeMenu === 'settings' && 'إعدادات النظام'}
                    {activeMenu === 'report' && 'تقارير الدرجات'}
                    {activeMenu === 'khs' && 'سجل النتائج'}
                </h2>
                <p className="text-gray-400 font-bold text-xs mt-1">إدارة البيانات الأكاديمية</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                <button 
                    onClick={handleReload}
                    disabled={reloading}
                    className="p-2 rounded-lg text-gray-400 hover:text-[#064E3B] hover:bg-emerald-50 transition-all disabled:opacity-50"
                    title="تحديث البيانات"
                >
                    <svg className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>

                {activeMenu !== 'khs' && (
                    <div className="relative">
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="appearance-none bg-gray-50 hover:bg-gray-100 font-bold text-gray-700 text-xs py-2 pl-8 pr-3 rounded-lg outline-none cursor-pointer w-full min-w-[120px] transition-colors"
                        >
                            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                )}
            </div>
      </div>
  );

  const renderSubMenu = () => {
      let items: {id: string, label: string}[] = [];
      if (['students', 'lecturers', 'subjects'].includes(activeMenu)) {
          items = [
              {id: 'students', label: 'الطلاب'},
              {id: 'lecturers', label: 'المحاضرين'},
              {id: 'subjects', label: 'المواد'},
          ];
      } else if (['classes', 'report', 'khs'].includes(activeMenu)) {
          items = [
              {id: 'classes', label: 'الفصول'},
              {id: 'report', label: 'التقارير'},
              {id: 'khs', label: 'النتائج'},
          ];
      } else {
          return null;
      }

      return (
          <div className="md:hidden flex overflow-x-auto gap-2 mb-6 pb-1 no-scrollbar">
              {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onMenuChange(item.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeMenu === item.id 
                        ? 'bg-emerald-900 text-white shadow-md shadow-emerald-900/20' 
                        : 'bg-white text-gray-500 border border-gray-100'
                    }`}
                  >
                      {item.label}
                  </button>
              ))}
          </div>
      );
  };

  return (
    <div className="animate-fade-in pb-16">
        <HeaderBlock />
        {renderSubMenu()}

        <div className="min-h-[400px]">
            {activeMenu === 'students' && <MasterUserManager role={Role.STUDENT} />}
            {activeMenu === 'lecturers' && <MasterUserManager role={Role.LECTURER} />}
            {activeMenu === 'subjects' && <MasterSubjectManager />}
            {activeMenu === 'classes' && <ClassTransactionManager yearId={selectedYear} refreshKey={refreshKey} />}
            {activeMenu === 'settings' && <GradeSettingsManager yearId={selectedYear} refreshKey={refreshKey} />}
            {activeMenu === 'report' && <RecapManager yearId={selectedYear} />}
            {activeMenu === 'khs' && <KhsManager yearId={selectedYear} />}
        </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const MasterUserManager = ({ role }: { role: Role }) => {
    // ... (No changes to this component logic) ...
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [importing, setImporting] = useState(false);
    
    useEffect(() => {
        getAdminData().then(d => {
            setUsers(role === Role.STUDENT ? d.students : d.lecturers);
        });
    }, [role]);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[] = XLSX.utils.sheet_to_json(ws);

                const newUsers: User[] = data.map(row => {
                    return {
                        id: String(row['ID'] || row['id'] || row['الرقم'] || ''),
                        name: row['Name'] || row['name'] || row['الاسم'] || '',
                        role: role,
                        gender: normalizeGender(row['Gender'] || row['gender'] || row['الجنس']), 
                        status: UserStatus.ACTIVE,
                        password: '123' 
                    };
                });

                if(newUsers.length > 0) {
                    await bulkCreateUsers(newUsers);
                    showSuccess(`تم استيراد ${newUsers.length} مستخدم بنجاح`);
                }
            } catch(e) {
                showError('فشل استيراد الملف، تأكد من صحة التنسيق');
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        const data = [
            { ID: '1001', Name: 'اسم المستخدم الثلاثي', Gender: 'M' }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `${role === Role.STUDENT ? 'Students' : 'Lecturers'}_Template.xlsx`);
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.id.includes(searchTerm)
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between gap-3">
                 <div className="relative flex-1 max-w-lg">
                     <input 
                        type="text" 
                        placeholder={role === Role.STUDENT ? "بحث عن طالب..." : "بحث عن محاضر..."}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all text-sm font-medium text-gray-700"
                     />
                     <svg className="absolute right-3.5 top-3 w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                 </div>

                 <div className="flex gap-2">
                     <button onClick={downloadTemplate} disabled={importing} className="px-4 py-2.5 text-emerald-700 bg-white border border-emerald-100 hover:bg-emerald-50 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         نموذج
                     </button>
                     <label className={`bg-emerald-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-emerald-800 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/10 ${importing ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        {importing ? (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        )}
                        {importing ? 'جاري الرفع...' : 'استيراد'}
                        <input type="file" hidden accept=".xlsx" onChange={handleImport} disabled={importing} />
                    </label>
                 </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs md:text-sm">
                        <thead className="bg-gray-50/50 text-gray-400 font-bold border-b border-gray-50">
                            <tr>
                                <th className="p-3 font-medium">الرقم الجامعي / الوظيفي</th>
                                <th className="p-3 font-medium">الاسم الكامل</th>
                                <th className="p-3 font-medium">الجنس</th>
                                <th className="p-3 font-medium">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50/80 transition-colors group">
                                    <td className="p-2.5 font-mono text-emerald-900/70 font-semibold">{u.id}</td>
                                    <td className="p-2.5 font-bold text-gray-800">{u.name}</td>
                                    <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] md:text-xs font-bold flex w-fit items-center gap-1 ${u.gender === 'MALE' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                            {u.gender === 'MALE' ? 'ذكر' : 'أنثى'}
                                        </span>
                                    </td>
                                    <td className="p-2.5"><span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] md:text-xs font-bold">نشط</span></td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">لا توجد بيانات للعرض</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const MasterSubjectManager = () => {
    const [subjects, setSubjects] = useState<MasterSubject[]>([]);
    const [importing, setImporting] = useState(false);
    
    useEffect(() => {
        getMasterSubjects().then(setSubjects);
    }, []);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data: any[] = XLSX.utils.sheet_to_json(ws);
                const newSubs: MasterSubject[] = data.map(row => ({
                    id: String(row['Code'] || row['id'] || row['رمز المادة']),
                    name: row['Name'] || row['name'] || row['اسم المادة'],
                    sks: Number(row['SKS'] || row['sks'] || row['الوحدات'])
                }));
                if(newSubs.length > 0) {
                    await bulkCreateMasterSubjects(newSubs);
                    showSuccess(`تم استيراد ${newSubs.length} مادة`);
                }
            } catch(e) {
                showError('فشل استيراد المواد');
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        const data = [
            { Code: 'ARB101', Name: 'اللغة العربية', SKS: 2 }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `Template_Subjects.xlsx`);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                 <h3 className="text-lg font-bold text-gray-800 px-2">قائمة المواد الدراسية</h3>
                 <div className="flex gap-2">
                     <button onClick={downloadTemplate} disabled={importing} className="px-4 py-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-bold text-xs transition-colors disabled:opacity-50">
                         تحميل النموذج
                     </button>
                     <label className={`bg-emerald-900 text-white px-5 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-800 transition-all flex items-center gap-2 shadow-sm ${importing ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        {importing ? 'جاري العمل...' : 'استيراد Excel'}
                        <input type="file" hidden accept=".xlsx" onChange={handleImport} disabled={importing} />
                    </label>
                 </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map(s => (
                    <div key={s.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                        <div className="relative z-10 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 text-base group-hover:text-emerald-700 transition-colors">{s.name}</h3>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-bold shrink-0">{s.sks} وحدات</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ClassTransactionManager = ({ yearId, refreshKey }: { yearId: string, refreshKey: number }) => {
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const PREDEFINED_CLASSES = ["التمهيدية الأولى", "التمهيدية الثانية", "السنة الأولى", "السنة الثانية", "السنة الثالثة", "السنة الرابعة"];
    const [allStudents, setAllStudents] = useState<User[]>([]);
    const [enrolledStudents, setEnrolledStudents] = useState<StudentEnrollment[]>([]);
    const [allSubjects, setAllSubjects] = useState<MasterSubject[]>([]);
    const [allLecturers, setAllLecturers] = useState<User[]>([]);
    const [assignedSubjects, setAssignedSubjects] = useState<SubjectView[]>([]);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [assignmentRows, setAssignmentRows] = useState<{id: number, subjectId: string, lecturerId: string}[]>([]);

    const [selectedGender, setSelectedGender] = useState<'MALE' | 'FEMALE'>('MALE');

    const [activatingClassId, setActivatingClassId] = useState<string|null>(null);
    const [savingStudents, setSavingStudents] = useState(false);
    const [savingAssignments, setSavingAssignments] = useState(false);
    const [removingStudentId, setRemovingStudentId] = useState<string|null>(null);
    const [removingSubjectId, setRemovingSubjectId] = useState<string|null>(null);
    
    // NEW: States for granular publishing
    const [publishingClass, setPublishingClass] = useState(false);
    const [togglingSubjectId, setTogglingSubjectId] = useState<string | null>(null);

    useEffect(() => {
        if(yearId) {
            getClassesByYear(yearId).then(setClasses);
            getAdminData().then(d => { setAllStudents(d.students); setAllLecturers(d.lecturers); });
            getMasterSubjects().then(setAllSubjects);
        }
    }, [yearId, refreshKey]);

    useEffect(() => {
        const current = classes.find(c => c.id === selectedClass);
        if (current && current.gender !== selectedGender) {
            setSelectedClass('');
        }
    }, [selectedGender, classes]);

    useEffect(() => {
        if(selectedClass) {
            getClassEnrollments(selectedClass).then(enrs => setEnrolledStudents(enrs));
            getSubjectsByYear(yearId).then(subs => {
                setAssignedSubjects(subs.filter((s: any) => s.classId === selectedClass));
            });
        } else {
            setEnrolledStudents([]);
            setAssignedSubjects([]);
        }
    }, [selectedClass, classes, yearId, refreshKey]);

    const handleActivateClass = async (className: string) => {
        setActivatingClassId(className);
        try {
            const newClass = await createClass(className, yearId, selectedGender);
            setClasses(prev => [...prev, newClass]);
            setSelectedClass(newClass.id);
            showSuccess('تم تفعيل الفصل بنجاح');
        } catch(e) { showError('فشل التفعيل'); }
        finally { setActivatingClassId(null); }
    };

    const [validStudentsForModal, setValidStudentsForModal] = useState<User[]>([]);
    
    const openStudentModal = async () => {
        const targetClass = classes.find(c => c.id === selectedClass);
        if (!targetClass) return;

        const allEnrolls = await getEnrollmentsByYear(yearId);
        const enrolledIds = allEnrolls.map(e => e.studentId);
        
        const valid = allStudents.filter(s => 
            !enrolledIds.includes(s.id) && 
            s.gender === targetClass.gender
        );

        setValidStudentsForModal(valid);
        setSelectedStudentIds(new Set());
        setStudentSearchTerm('');
        setShowStudentModal(true);
    };

    const handleBulkAddStudents = async () => {
        if (selectedStudentIds.size === 0) return;
        setSavingStudents(true);
        try {
            await bulkAssignStudentsToClass(Array.from(selectedStudentIds), selectedClass);
            setShowStudentModal(false);
            showSuccess(`تم إضافة ${selectedStudentIds.size} طالب بنجاح`);
            const newEnr = await getClassEnrollments(selectedClass);
            setEnrolledStudents(newEnr);
        } catch (e: any) { showError('حدث خطأ أثناء الإضافة'); }
        finally { setSavingStudents(false); }
    };

    const handleRemoveStudent = async (studentId: string, classId: string) => {
        setRemovingStudentId(studentId);
        try {
            await removeStudentFromClass(studentId, classId);
        } catch(e) { showError('فشل حذف الطالب'); }
        finally { setRemovingStudentId(null); }
    };
    
    const toggleStudentSelection = (id: string) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedStudentIds(newSet);
    };
    const filteredModalStudents = validStudentsForModal.filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || s.id.includes(studentSearchTerm));

    const toggleSelectAllStudents = () => {
        const allIds = filteredModalStudents.map(s => s.id);
        const allSelected = allIds.length > 0 && allIds.every(id => selectedStudentIds.has(id));
        const newSet = new Set(selectedStudentIds);
        if (allSelected) {
            allIds.forEach(id => newSet.delete(id));
        } else {
            allIds.forEach(id => newSet.add(id));
        }
        setSelectedStudentIds(newSet);
    };

    const openAssignmentModal = () => { setAssignmentRows([{ id: Date.now(), subjectId: '', lecturerId: '' }]); setShowAssignmentModal(true); };
    const addAssignmentRow = () => { setAssignmentRows(prev => [...prev, { id: Date.now(), subjectId: '', lecturerId: '' }]); };
    const removeAssignmentRow = (id: number) => { setAssignmentRows(prev => prev.filter(r => r.id !== id)); };
    const updateAssignmentRow = (id: number, field: 'subjectId'|'lecturerId', value: string) => { setAssignmentRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r)); };
    
    const handleBulkSaveAssignments = async () => {
        const validRows = assignmentRows.filter(r => r.subjectId && r.lecturerId);
        if (validRows.length === 0) { showError('يرجى تعبئة صف واحد على الأقل'); return; }
        
        setSavingAssignments(true);
        const payload = validRows.map(r => ({ masterSubjectId: r.subjectId, lecturerId: r.lecturerId, classId: selectedClass }));
        try {
            await bulkCreateSubjectAssignments(payload);
            setShowAssignmentModal(false);
            showSuccess(`تم إضافة ${validRows.length} مادة بنجاح`);
            const newSubs = await getSubjectsByYear(yearId);
            setAssignedSubjects(newSubs.filter((s: any) => s.classId === selectedClass));
        } catch (e) { showError('حدث خطأ أثناء حفظ البيانات'); }
        finally { setSavingAssignments(false); }
    };

    const handleRemoveSubject = async (id: string) => {
        setRemovingSubjectId(id);
        try {
            await removeSubjectAssignment(id);
        } catch(e) { showError('فشل حذف المادة'); }
        finally { setRemovingSubjectId(null); }
    };

    // --- NEW: Publish Entire Class ---
    const handlePublishClass = async () => {
        if (!selectedClass) return;
        if (!await confirmAction('نشر نتائج الفصل', 'هل أنت متأكد من نشر جميع درجات المواد لهذا الفصل؟ سيتمكن الطلاب من رؤية النتائج.', 'نعم، انشر')) return;

        setPublishingClass(true);
        try {
            await publishClassGrades(selectedClass);
            // Optimistic Update
            setAssignedSubjects(prev => prev.map(s => ({ ...s, status: GradeStatus.PUBLISHED })));
            showSuccess('تم نشر جميع نتائج الفصل بنجاح');
        } catch (e) {
            showError('فشل نشر النتائج');
        } finally {
            setPublishingClass(false);
        }
    };

    // --- NEW: Toggle Individual Subject Status ---
    const handleToggleSubjectStatus = async (subjectId: string, currentStatus: GradeStatus) => {
        setTogglingSubjectId(subjectId);
        const newStatus = currentStatus === GradeStatus.PUBLISHED ? GradeStatus.DRAFT : GradeStatus.PUBLISHED;
        
        try {
            await updateSubjectStatus(subjectId, newStatus);
            // Optimistic update
            setAssignedSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, status: newStatus } : s));
            showSuccess(newStatus === GradeStatus.PUBLISHED ? 'تم نشر المادة' : 'تم إلغاء النشر');
        } catch (e) {
            showError('فشل تحديث الحالة');
        } finally {
            setTogglingSubjectId(null);
        }
    };

    const getAvailableSubjectsForRow = (currentRowId: number) => {
        const assignedDbIds = assignedSubjects.map(s => s.subjectCode);
        const selectedInOtherRows = assignmentRows.filter(r => r.id !== currentRowId && r.subjectId).map(r => r.subjectId);
        return allSubjects.filter(s => !assignedDbIds.includes(s.id) && !selectedInOtherRows.includes(s.id));
    };

    return (
        <div className="space-y-6">
             <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                    <h3 className="text-lg font-bold text-gray-900">
                        الفصول الدراسية
                    </h3>

                    {/* Gender Toggle Tabs */}
                    <div className="flex bg-gray-50 p-1 rounded-xl w-full md:w-auto border border-gray-100">
                        <button 
                            onClick={() => setSelectedGender('MALE')}
                            className={`flex-1 py-1.5 px-4 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${selectedGender === 'MALE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                        >
                            <span>بنين</span>
                        </button>
                        <button 
                            onClick={() => setSelectedGender('FEMALE')}
                            className={`flex-1 py-1.5 px-4 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${selectedGender === 'FEMALE' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                        >
                            <span>بنات</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {PREDEFINED_CLASSES.map(name => {
                        const existingClass = classes.find(c => c.name === name && c.gender === selectedGender);
                        const isActive = !!(existingClass && existingClass.id);
                        const isSelected = isActive && existingClass.id === selectedClass;
                        const isActivating = activatingClassId === name;
                        const genderColor = selectedGender === 'MALE' ? 'blue' : 'pink';
                        
                        return (
                            <div 
                                key={name} 
                                onClick={() => !isActivating && (isActive ? setSelectedClass(existingClass.id) : handleActivateClass(name))} 
                                className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center h-28 group ${isActive ? (isSelected ? `border-${genderColor}-500 bg-${genderColor}-50` : `border-gray-100 bg-white hover:border-${genderColor}-200 hover:shadow-md`) : 'border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100'} ${isActivating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isActivating ? (
                                     <svg className={`animate-spin h-5 w-5 text-${genderColor}-600 mb-2`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <>
                                        <span className={`font-bold text-xs mb-1.5 ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{name}</span>
                                        {isActive ? (
                                            <span className={`text-[10px] bg-${genderColor}-100 text-${genderColor}-700 px-2 py-0.5 rounded-md font-bold`}>نشط</span>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 mt-1">
                                                <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-300 group-hover:border-emerald-300 group-hover:text-emerald-500 transition-colors shadow-sm">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
             </div>
             
             {selectedClass && (
                 <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
                     <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col h-[500px]">
                         {/* ... (Existing Student List code) ... */}
                         <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                             <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                 </div>
                                 الطلاب المسجلين
                             </h4>
                             <span className="bg-gray-100 px-2 py-1 rounded-md text-[10px] text-gray-600 font-mono font-bold">{enrolledStudents.length}</span>
                         </div>
                         <div className="mb-3"><button onClick={openStudentModal} className="w-full bg-emerald-900 hover:bg-emerald-800 text-white px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>إضافة طلاب</button></div>
                         <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                             {enrolledStudents.map(e => {
                                 const s = allStudents.find(u => u.id === e.studentId);
                                 const displayName = s ? s.name : "بيانات غير متوفرة";
                                 const displayInitial = s && s.name ? s.name.charAt(0) : "?";
                                 const isMissing = !s;
                                 const isRemoving = removingStudentId === e.studentId;

                                 return (<div key={e.id} className="bg-gray-50/50 p-2.5 rounded-xl flex justify-between items-center group hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"><div className="flex items-center gap-2.5"><div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border border-white shadow-sm ${isMissing ? 'bg-red-100 text-red-500' : 'bg-white text-gray-500'}`}>{displayInitial}</div><div><div className={`text-xs font-bold ${isMissing ? 'text-red-500 italic' : 'text-gray-800'}`}>{displayName}</div><div className={`text-[10px] font-mono ${isMissing ? 'text-red-400 font-bold' : 'text-gray-400'}`}>{isMissing ? `ID: ${e.studentId}` : s?.id}</div></div></div>
                                 <button onClick={() => !isRemoving && handleRemoveStudent(e.studentId, e.classId)} disabled={isRemoving} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-100">
                                     {isRemoving ? <svg className="animate-spin h-3.5 w-3.5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                                 </button></div>)
                             })}
                             {enrolledStudents.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs opacity-60"><p>لا يوجد طلاب مسجلين</p></div>}
                         </div>
                     </div>
                     <div className="bg-gradient-to-b from-emerald-50/50 to-white rounded-2xl p-5 border border-emerald-100/50 flex flex-col h-[500px]">
                         <div className="flex justify-between items-center mb-4 pb-3 border-b border-emerald-100">
                             <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                 </div>
                                 المواد الدراسية
                             </h4>
                             {/* PUBLISH CLASS BUTTON */}
                             {assignedSubjects.length > 0 && (
                                <button 
                                    onClick={handlePublishClass} 
                                    disabled={publishingClass}
                                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5"
                                    title="نشر جميع نتائج الفصل"
                                >
                                    {publishingClass ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                    نشر النتائج
                                </button>
                             )}
                         </div>
                         <div className="mb-3"><button onClick={openAssignmentModal} className="w-full bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 hover:border-emerald-300 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>توزيع المواد (متعدد)</button></div>
                         <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                             {assignedSubjects.map(s => {
                                 const isRemoving = removingSubjectId === s.id;
                                 const isToggling = togglingSubjectId === s.id;
                                 const isPublished = s.status === GradeStatus.PUBLISHED;

                                 return (
                                     <div key={s.id} className="bg-white p-3 rounded-xl shadow-sm border border-emerald-50 hover:shadow-md transition-all relative group">
                                         <div className="flex justify-between items-start">
                                            <div className="font-bold text-gray-800 text-xs pr-2">{s.subjectName}</div>
                                            {/* STATUS TOGGLE */}
                                            <button 
                                                onClick={() => !isToggling && handleToggleSubjectStatus(s.id, s.status)}
                                                disabled={isToggling}
                                                className={`flex-shrink-0 text-[9px] px-2 py-0.5 rounded-md font-bold transition-all border ${isPublished ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'}`}
                                            >
                                                {isToggling ? '...' : (isPublished ? 'منشور' : 'مسودة')}
                                            </button>
                                         </div>
                                         <div className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-2">
                                             <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold border border-emerald-100">{s.sks} وحدات</span>
                                             <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>{allLecturers.find(l=>l.id===s.lecturerId)?.name || 'غير محدد'}</span>
                                         </div>
                                         {/* DELETE BUTTON */}
                                         <button onClick={() => !isRemoving && handleRemoveSubject(s.id)} disabled={isRemoving} className="absolute bottom-2 left-2 w-6 h-6 flex items-center justify-center rounded-lg bg-gray-50 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                                            {isRemoving ? <svg className="animate-spin h-3 w-3 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                                         </button>
                                     </div>
                                 )
                             })}
                             {assignedSubjects.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs opacity-60"><p>لا توجد مواد دراسية موزعة</p></div>}
                         </div>
                     </div>
                 </div>
             )}

             {/* ... (Existing Modals: Add Students & Add Subjects) ... */}
             {showStudentModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
                     <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh]">
                         <div className="bg-[#064E3B] px-6 py-4 flex justify-between items-center text-white">
                             <h3 className="font-bold text-base flex items-center gap-2">
                                 <svg className="w-5 h-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                 إضافة طلاب للفصل
                             </h3>
                             <button onClick={() => setShowStudentModal(false)} className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                         </div>
                         <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-3 items-center justify-between">
                             <div className="relative w-full">
                                 <input 
                                    type="text" 
                                    placeholder="بحث بالاسم أو الرقم الجامعي..." 
                                    value={studentSearchTerm}
                                    onChange={e => setStudentSearchTerm(e.target.value)}
                                    className="w-full pl-4 pr-9 py-2 text-xs border-0 bg-white shadow-sm ring-1 ring-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                 />
                                 <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                             </div>
                             <div className="flex gap-2 w-full md:w-auto shrink-0">
                                 <button onClick={toggleSelectAllStudents} className="px-4 py-2 text-xs font-bold bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">تحديد الكل</button>
                             </div>
                         </div>
                         <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                             <div className="grid grid-cols-1 gap-2">
                                 {filteredModalStudents.map(s => (
                                     <div key={s.id} onClick={() => toggleStudentSelection(s.id)} className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${selectedStudentIds.has(s.id) ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-gray-100 hover:border-emerald-200'}`}>
                                         <div className="flex items-center gap-3">
                                             <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedStudentIds.has(s.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                                                 {selectedStudentIds.has(s.id) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                             </div>
                                             <div>
                                                 <p className="font-bold text-gray-800 text-xs">{s.name}</p>
                                                 <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.id}</p>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                                 {filteredModalStudents.length === 0 && <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-2"><span className="text-4xl opacity-20">📂</span>لا يوجد طلاب متاحين للإضافة</div>}
                             </div>
                         </div>
                         <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-white">
                             <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">تم تحديد: {selectedStudentIds.size}</span>
                             <button onClick={handleBulkAddStudents} disabled={selectedStudentIds.size === 0 || savingStudents} className="bg-[#064E3B] hover:bg-emerald-800 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-900/10 disabled:opacity-50 flex items-center gap-2 transition-all">
                                 {savingStudents ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'إضافة المحدد'}
                             </button>
                         </div>
                     </div>
                 </div>
             )}

             {showAssignmentModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
                     <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]">
                         <div className="bg-[#064E3B] px-6 py-4 flex justify-between items-center text-white">
                             <h3 className="font-bold text-base flex items-center gap-2">
                                 <svg className="w-5 h-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                 توزيع المواد الدراسية
                             </h3>
                             <button onClick={() => setShowAssignmentModal(false)} className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                         </div>
                         
                         <div className="p-3 bg-amber-50 text-amber-800 text-[10px] font-bold border-b border-amber-100 flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             قم باختيار المادة والمحاضر المسؤول عنها. يمكنك إضافة صفوف متعددة للحفظ الجماعي.
                         </div>

                         <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
                             <div className="space-y-3">
                                 {assignmentRows.map((row, index) => {
                                     const availableSubjects = getAvailableSubjectsForRow(row.id);
                                     const currentSub = allSubjects.find(s => s.id === row.subjectId);
                                     const displaySubjects = currentSub ? [currentSub, ...availableSubjects] : availableSubjects;

                                     return (
                                         <div key={row.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-end md:items-center animate-fade-in relative hover:border-emerald-200 transition-colors">
                                             <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                                                 {index + 1}
                                             </div>
                                             
                                             <div className="flex-1 w-full">
                                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">المقرر الدراسي</label>
                                                 <select 
                                                    value={row.subjectId} 
                                                    onChange={e => updateAssignmentRow(row.id, 'subjectId', e.target.value)}
                                                    className="w-full bg-gray-50 border-0 ring-1 ring-gray-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                                                 >
                                                     <option value="">-- اختر المادة --</option>
                                                     {displaySubjects.map(s => (
                                                         <option key={s.id} value={s.id}>{s.name} ({s.sks} وحدات)</option>
                                                     ))}
                                                 </select>
                                             </div>

                                             <div className="flex-1 w-full">
                                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">المحاضر المسؤول</label>
                                                 <select 
                                                    value={row.lecturerId} 
                                                    onChange={e => updateAssignmentRow(row.id, 'lecturerId', e.target.value)}
                                                    className="w-full bg-gray-50 border-0 ring-1 ring-gray-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                                                 >
                                                     <option value="">-- اختر المحاضر --</option>
                                                     {allLecturers.map(l => (
                                                         <option key={l.id} value={l.id}>{l.name}</option>
                                                     ))}
                                                 </select>
                                             </div>

                                             <button onClick={() => removeAssignmentRow(row.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="حذف الصف">
                                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                             </button>
                                         </div>
                                     );
                                 })}
                             </div>
                             
                             <button onClick={addAssignmentRow} className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 text-xs">
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                 إضافة صف جديد
                             </button>
                         </div>

                         <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-white">
                             <button onClick={() => setShowAssignmentModal(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">إلغاء</button>
                             <button onClick={handleBulkSaveAssignments} disabled={savingAssignments} className="bg-[#064E3B] hover:bg-emerald-800 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-900/10 disabled:opacity-50 flex items-center gap-2 transition-all">
                                 {savingAssignments ? 'جاري الحفظ...' : 'حفظ الجدول'}
                             </button>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

const GradeSettingsManager = ({ yearId, refreshKey }: { yearId: string, refreshKey: number }) => {
    // ... (Keep existing GradeSettingsManager logic) ...
    const [year, setYear] = useState<AcademicYear | null>(null);
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        getAcademicYears().then(yrs => {
            const y = yrs.find(x => x.id === yearId);
            setYear(y || null);
        });
    }, [yearId, refreshKey]);

    const handleToggle = async (sem: 1 | 2, currentVal: boolean) => {
        try {
            await toggleSemesterStatus(yearId, sem, !currentVal);
            showSuccess('تم تحديث حالة الفصل الدراسي');
        } catch (e) {
            showError('فشل التحديث');
        }
    };

    const handlePublishAll = async () => {
        if (!await confirmAction('نشر جميع النتائج؟', 'سيتم إتاحة جميع الدرجات للطلاب في هذه السنة الدراسية بشكل نهائي.', 'نعم، انشرها', true)) return;
        
        setPublishing(true);
        try {
            await publishAllGradesInYear(yearId);
            showSuccess('تم نشر جميع النتائج بنجاح');
        } catch(e) {
            showError('حدث خطأ أثناء النشر');
        } finally {
            setPublishing(false);
        }
    };

    const [isConfigModalOpen, setConfigModalOpen] = useState(false);
    const isOffline = isOfflineModeActive();
    const currentApiUrl = getApiUrl();

    if (!year) return <div className="p-8 text-center text-gray-400">جاري تحميل البيانات...</div>;

    return (
        <div className="space-y-6">
            {/* Database & Cloud Sync Settings Card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6-8h6" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-800">إعدادات قاعدة البيانات والربط مع Google Sheets</h3>
                            <p className="text-xs text-gray-500">التحكم في مصدر البيانات والمزامنة السحابية لنظام STAI Imam Syafi'i</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isOffline ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {isOffline ? 'وضع قاعدة البيانات المحلية (Local Storage)' : 'متصل بـ Google Sheets'}
                        </span>
                        <button
                            onClick={() => setConfigModalOpen(true)}
                            className="bg-[#064E3B] hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>تعديل الرابط والإعدادات</span>
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between text-xs gap-2">
                    <div className="overflow-hidden">
                        <span className="text-gray-400 font-bold ml-2">رابط النشر الحالي:</span>
                        <span className="font-mono text-gray-700 truncate inline-block max-w-md align-middle" dir="ltr">
                            {currentApiUrl}
                        </span>
                    </div>
                    <span className="text-[11px] text-gray-400">يتم حفظ جميع التعديلات محلياً وتلقائياً</span>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">إعدادات السنة الدراسية: {year.name}</h3>
                        <p className="text-xs text-gray-500">التحكم في فتح وإغلاق الفصول الدراسية وإدخال الدرجات</p>
                    </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                    <div className={`p-5 rounded-xl border transition-all ${year.isSem1Active ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold text-sm ${year.isSem1Active ? 'text-emerald-800' : 'text-gray-600'}`}>الفصل الدراسي الأول</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={year.isSem1Active} onChange={() => handleToggle(1, year.isSem1Active)} />
                                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
                            </label>
                        </div>
                        <p className="text-xs opacity-70">
                            {year.isSem1Active ? 'النظام مفتوح لإدخال الدرجات' : 'النظام مغلق، لا يمكن للمحاضرين التعديل'}
                        </p>
                    </div>

                    <div className={`p-5 rounded-xl border transition-all ${year.isSem2Active ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold text-sm ${year.isSem2Active ? 'text-emerald-800' : 'text-gray-600'}`}>الفصل الدراسي الثاني</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={year.isSem2Active} onChange={() => handleToggle(2, year.isSem2Active)} />
                                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
                            </label>
                        </div>
                        <p className="text-xs opacity-70">
                            {year.isSem2Active ? 'النظام مفتوح لإدخال الدرجات' : 'النظام مغلق، لا يمكن للمحاضرين التعديل'}
                        </p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-50">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-xs uppercase tracking-wide opacity-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        منطقة الخطر
                    </h4>
                    <div className="flex flex-col md:flex-row items-center gap-4 p-4 bg-red-50/50 rounded-xl border border-red-100">
                        <div className="flex-1">
                            <h5 className="font-bold text-red-800 text-sm">نشر النتائج النهائية (الكل)</h5>
                            <p className="text-xs text-red-600/80 mt-1 leading-relaxed">
                                هذا الإجراء سيقوم باعتماد ونشر جميع الدرجات لجميع الفصول في السنة الحالية دفعة واحدة.
                            </p>
                        </div>
                        <button 
                            onClick={handlePublishAll} 
                            disabled={publishing}
                            className="bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-sm w-full md:w-auto justify-center"
                        >
                             {publishing ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>}
                             اعتماد ونشر الكل
                        </button>
                    </div>
                </div>
            </div>

            <SheetsConfigModal 
                isOpen={isConfigModalOpen} 
                onClose={() => setConfigModalOpen(false)} 
            />
        </div>
    );
};

// ... (Rest of the file remains unchanged: RecapManager, KhsManager) ...
// Ensuring the rest of the file is included correctly.

const RecapManager = ({ yearId }: { yearId: string }) => {
    // ... (Keep existing RecapManager logic) ...
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [recapData, setRecapData] = useState<{ subjects: MasterSubject[], rows: ClassRecapRow[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'SEM1' | 'SEM2' | 'COMBINED'>('SEM1');

    useEffect(() => {
        if(yearId) {
            getClassesByYear(yearId).then(setClasses);
            setSelectedClassId('');
            setRecapData(null);
        }
    }, [yearId]);

    useEffect(() => {
        if(selectedClassId) {
            setLoading(true);
            getClassRecap(selectedClassId).then(data => {
                setRecapData(data);
                setLoading(false);
            });
        }
    }, [selectedClassId]);

    const handleExport = () => {
        if (!recapData) return;
        
        let header: string[] = [];
        let body: any[][] = [];

        if (viewMode === 'COMBINED') {
            header = ["No", "رقم القيد", "الاسم"];
            recapData.subjects.forEach(s => {
                header.push(`${s.name} (ف1)`, `${s.name} (ف2)`, `${s.name} (المعدل)`);
            });
            header.push("معدل المجموع", "النتيجة النهائية");

            body = recapData.rows.map((r, i) => {
                const row = [i + 1, r.student.id, r.student.name];
                let totalAvgSum = 0;
                let count = 0;

                recapData.subjects.forEach(s => {
                    const g = r.grades[s.id];
                    if (g) {
                        row.push(g.sem1, g.sem2, parseFloat(g.avg.toFixed(2)));
                        totalAvgSum += g.avg;
                        count++;
                    } else {
                        row.push(0, 0, 0);
                    }
                });
                
                const finalAvg = count > 0 ? totalAvgSum / count : 0;
                row.push(parseFloat(totalAvgSum.toFixed(2)), parseFloat(finalAvg.toFixed(2)));
                return row;
            });

        } else {
            const suffix = viewMode === 'SEM1' ? '(فصل 1)' : '(فصل 2)';
            header = ["No", "رقم القيد", "الاسم", ...recapData.subjects.map(s => `${s.name} ${suffix}`), "المجموع", "المعدل"];
            
            body = recapData.rows.map((r, i) => {
                let rowSum = 0;
                let count = 0;
                const subjectScores = recapData.subjects.map(s => {
                    const g = r.grades[s.id];
                    const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
                    if(g) { rowSum += val; count++; }
                    return val;
                });
                const avg = count > 0 ? rowSum / count : 0;
                
                return [
                    i + 1,
                    r.student.id,
                    r.student.name,
                    ...subjectScores,
                    rowSum,
                    parseFloat(avg.toFixed(2))
                ];
            });
        }

        const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recap");
        const className = classes.find(c => c.id === selectedClassId)?.name || "Class";
        XLSX.writeFile(wb, `تقرير_${className}_${viewMode}.xlsx`);
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 flex flex-col md:flex-row gap-6 items-end justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                
                <div className="flex flex-col gap-6 w-full md:w-auto relative z-10">
                    <div>
                        <h3 className="text-xl font-extrabold text-gray-800 mb-1 flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            لوحة التحكم بالتقارير
                        </h3>
                        <p className="text-xs text-gray-400 font-medium">تصفية وتصدير البيانات الأكاديمية</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-64">
                            <label className="block text-[11px] font-bold text-gray-500 mb-2 mr-1">اختر الفصل الدراسي</label>
                            <div className="relative">
                                <select 
                                    value={selectedClassId} 
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 focus:bg-white transition-all appearance-none shadow-sm"
                                >
                                    <option value="">-- يرجى الاختيار --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.gender === 'MALE' ? 'بنين' : 'بنات'})</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-emerald-600">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-[11px] font-bold text-gray-500 mb-2 mr-1">نوع العرض</label>
                            <div className="relative">
                                <select 
                                    value={viewMode} 
                                    onChange={e => setViewMode(e.target.value as any)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 focus:bg-white transition-all appearance-none shadow-sm"
                                >
                                    <option value="SEM1">الفصل الأول</option>
                                    <option value="SEM2">الفصل الثاني</option>
                                    <option value="COMBINED">شامل (ف1 + ف2)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-emerald-600">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {recapData && (
                    <button onClick={handleExport} className="w-full md:w-auto bg-gradient-to-r from-[#064E3B] to-emerald-800 hover:to-emerald-900 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        تصدير Excel
                    </button>
                )}
            </div>

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium">جاري معالجة البيانات...</p>
                </div>
            ) : recapData ? (
                <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-xs text-center relative border-collapse">
                            <thead className="bg-white text-gray-500 font-bold sticky top-0 z-20 shadow-sm">
                                {/* ... (Header content remains same structure, just wrapped in new container) ... */}
                                {viewMode === 'COMBINED' ? (
                                    <>
                                        <tr>
                                            <th rowSpan={2} className="p-2 text-right bg-white min-w-[150px] sticky right-0 z-30 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">اسم الطالب</th>
                                            {recapData.subjects.map(s => (
                                                <th key={s.id} colSpan={3} className="p-1 text-center bg-gray-50/30 border-b border-gray-100 border-l border-gray-50">
                                                    <div className="truncate w-24 mx-auto text-emerald-900 text-[10px]" title={s.name}>{s.name}</div>
                                                </th>
                                            ))}
                                            <th colSpan={2} className="p-1 bg-emerald-50/50 text-emerald-900 border-b border-emerald-100">النتيجة النهائية</th>
                                        </tr>
                                        <tr>
                                            {recapData.subjects.map(s => (
                                                <React.Fragment key={s.id + '_sub'}>
                                                    <th className="p-1 text-[9px] bg-gray-50/30 min-w-[30px] text-gray-400 border-l border-gray-50">ف1</th>
                                                    <th className="p-1 text-[9px] bg-gray-50/30 min-w-[30px] text-gray-400 border-l border-gray-50">ف2</th>
                                                    <th className="p-1 text-[9px] bg-gray-100/50 min-w-[40px] font-extrabold text-gray-700 border-l border-gray-100">معدل</th>
                                                </React.Fragment>
                                            ))}
                                            <th className="p-1 text-[9px] bg-emerald-50/30 text-emerald-800 font-bold border-l border-emerald-100">المجموع</th>
                                            <th className="p-1 text-[9px] bg-emerald-100/50 text-emerald-900 font-extrabold border-l border-emerald-100">المعدل</th>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <th className="p-3 text-right bg-white z-10 min-w-[150px] sticky right-0 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">اسم الطالب</th>
                                        {recapData.subjects.map(s => (
                                            <th key={s.id} className="p-3 min-w-[100px] border-b border-gray-100 border-l border-gray-50">
                                                <div className="truncate w-24 mx-auto text-gray-800 text-[10px]" title={s.name}>{s.name}</div>
                                            </th>
                                        ))}
                                        <th className="p-3 bg-emerald-50/50 text-emerald-800 min-w-[60px] border-b border-emerald-100">المجموع</th>
                                        <th className="p-3 bg-emerald-100/50 text-emerald-900 min-w-[60px] border-b border-emerald-100">النسبة</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50 bg-white">
                                {recapData.rows.map((row, idx) => {
                                    let rowSum = 0;
                                    let count = 0;
                                    let rowFinalAvg = 0;

                                    if (viewMode === 'COMBINED') {
                                        recapData.subjects.forEach(s => {
                                            const g = row.grades[s.id];
                                            if(g) { rowSum += g.avg; count++; }
                                        });
                                    } else {
                                        recapData.subjects.forEach(s => {
                                            const g = row.grades[s.id];
                                            const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
                                            if(g) { rowSum += val; count++; }
                                        });
                                    }
                                    rowFinalAvg = count > 0 ? rowSum / count : 0;
                                    const isRowFailing = rowFinalAvg < 60;

                                    return (
                                        <tr key={row.student.id} className="hover:bg-gray-50 transition-colors">
                                            <td className={`p-2 text-right sticky right-0 bg-white z-10 font-bold border-l border-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] ${isRowFailing ? 'text-red-600' : 'text-gray-800'}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-normal text-gray-300 w-4">{idx + 1}</span>
                                                    <div>
                                                        <div className="text-[11px] truncate w-28">{row.student.name}</div>
                                                        <div className={`text-[9px] font-mono font-normal mt-0.5 ${isRowFailing ? 'text-red-400' : 'text-gray-400'}`}>{row.student.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            {recapData.subjects.map(s => {
                                                const g = row.grades[s.id];
                                                
                                                if (viewMode === 'COMBINED') {
                                                    const s1 = g?.sem1 || 0;
                                                    const s2 = g?.sem2 || 0;
                                                    const avg = g?.avg || 0;
                                                    return (
                                                        <React.Fragment key={s.id}>
                                                            <td className={`p-1 text-[10px] border-l border-gray-50 ${s1 < 60 ? 'text-red-600 font-bold bg-red-50/10' : 'text-gray-400'}`}>{g ? s1 : '-'}</td>
                                                            <td className={`p-1 text-[10px] border-l border-gray-50 ${s2 < 60 ? 'text-red-600 font-bold bg-red-50/10' : 'text-gray-400'}`}>{g ? s2 : '-'}</td>
                                                            <td className={`p-1 bg-gray-50/30 border-l border-gray-100 font-bold text-[10px] ${avg < 60 ? 'text-red-600' : 'text-gray-800'}`}>{g ? avg.toFixed(1) : '-'}</td>
                                                        </React.Fragment>
                                                    );
                                                } else {
                                                    const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
                                                    return (
                                                        <td key={s.id} className="p-2 border-l border-gray-50">
                                                            {g ? (
                                                                <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${val < 60 ? 'bg-red-50 text-red-600' : 'text-gray-700'}`}>
                                                                    {val}
                                                                </span>
                                                            ) : <span className="text-gray-300 text-[10px]">-</span>}
                                                        </td>
                                                    );
                                                }
                                            })}

                                            <td className="p-1.5 bg-emerald-50/20 font-bold text-emerald-800 text-[10px] border-l border-emerald-50">
                                                {viewMode === 'COMBINED' ? rowSum.toFixed(1) : rowSum}
                                            </td>
                                            <td className={`p-1.5 bg-emerald-50/40 font-extrabold text-[10px] border-l border-emerald-100 ${isRowFailing ? 'text-red-600' : 'text-emerald-900'}`}>
                                                {rowFinalAvg.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400 border border-dashed border-gray-300 rounded-[2rem] bg-gray-50/20">
                    <svg className="w-16 h-16 mb-4 opacity-30 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="font-bold text-base text-gray-500">يرجى اختيار طالب من القائمة لعرض كشف الدرجات</p>
                </div>
            )}
        </div>
    );
};

interface GroupedGrade {
    name: string;
    avgScore: number;
    count: number;
    totalSum: number;
    predicate: string;
}

const KhsManager = ({ yearId }: { yearId: string }) => {
    const [students, setStudents] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [groupedGrades, setGroupedGrades] = useState<GroupedGrade[]>([]);
    const [overallAvg, setOverallAvg] = useState<{score: number, predicate: string}>({ score: 0, predicate: '-' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch ALL students (ignore year filtering for the student list in KHS)
        getAdminData().then(d => setStudents(d.students));
    }, []);

    const getPredicate = (score: number): string => {
        if (score >= 90) return 'ممتاز';
        if (score >= 80) return 'جيد جدا';
        if (score >= 70) return 'جيد';
        if (score >= 60) return 'مقبول';
        return ''; // Blank for < 60 as per typical KHS formatting, or 'راسب'
    };

    useEffect(() => {
        if (selectedStudent) {
            setLoading(true);
            // Fetch CUMULATIVE grades (all years)
            getAllStudentGrades(selectedStudent.id).then(allGrades => {
                
                // Grouping Logic
                const groupedMap = new Map<string, { total: number, count: number }>();

                allGrades.forEach(g => {
                    // Only consider published grades or draft? Ideally published.
                    // For now, we take all but prioritize published status logic if needed.
                    // Using Subject Name as key (ignoring code differences across years if name is same)
                    const key = g.subjectName.trim();
                    const current = groupedMap.get(key) || { total: 0, count: 0 };
                    
                    // Value is the final_average of that subject instance
                    current.total += g.final_average;
                    current.count += 1;
                    groupedMap.set(key, current);
                });

                const processed: GroupedGrade[] = [];
                let grandTotal = 0;
                let grandCount = 0;

                groupedMap.forEach((val, key) => {
                    const avg = val.total / val.count;
                    processed.push({
                        name: key,
                        avgScore: avg,
                        count: val.count,
                        totalSum: val.total,
                        predicate: getPredicate(avg)
                    });
                    grandTotal += avg; // Average of averages
                    grandCount++; 
                });

                setGroupedGrades(processed);
                
                const finalAvgScore = grandCount > 0 ? grandTotal / grandCount : 0;
                setOverallAvg({
                    score: finalAvgScore,
                    predicate: getPredicate(finalAvgScore)
                });

                setLoading(false);
            });
        } else {
            setGroupedGrades([]);
            setOverallAvg({ score: 0, predicate: '-' });
        }
    }, [selectedStudent]);

    const filteredStudents = useMemo(() => {
         return students.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.id.includes(searchTerm)
        );
    }, [students, searchTerm]);

    return (
        <div className="space-y-4">
             <div className="relative">
                 <input 
                    type="text" 
                    placeholder="ابحث عن الطالب بالاسم أو رقم القيد..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-6 pr-12 py-3 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                 />
                 <svg className="absolute right-5 top-3.5 w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>

             <div className="grid md:grid-cols-12 gap-6 h-[600px]">
                 {/* Student List Sidebar */}
                 <div className="md:col-span-4 bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                     <div className="p-4 bg-gray-50/50 border-b border-gray-100 font-bold text-gray-700 flex justify-between items-center text-sm">
                         <span>قائمة الطلاب</span>
                         <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600">{filteredStudents.length}</span>
                     </div>
                     <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1.5">
                         {filteredStudents.slice(0, 50).map(s => (
                             <div 
                                key={s.id} 
                                onClick={() => setSelectedStudent(s)}
                                className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${selectedStudent?.id === s.id ? 'bg-emerald-50 border border-emerald-500 shadow-sm' : 'bg-white hover:bg-gray-50 border border-transparent hover:border-gray-100'}`}
                             >
                                 <div className="flex items-center gap-3">
                                     <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedStudent?.id === s.id ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                         {s.name.charAt(0)}
                                     </div>
                                     <div>
                                         <div className={`font-bold text-xs ${selectedStudent?.id === s.id ? 'text-emerald-900' : 'text-gray-800'}`}>{s.name}</div>
                                         <div className="text-[10px] text-gray-400 font-mono mt-0.5">{s.id}</div>
                                     </div>
                                 </div>
                                 {selectedStudent?.id === s.id && <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                             </div>
                         ))}
                         {filteredStudents.length === 0 && <div className="p-8 text-center text-gray-400 text-xs">لا توجد نتائج مطابقة</div>}
                     </div>
                 </div>

                 {/* Results Area */}
                 <div className="md:col-span-8 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative flex flex-col">
                     {selectedStudent ? (
                         <>
                             <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-50">
                                 <div>
                                     <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedStudent.name}</h3>
                                     <div className="flex items-center gap-3 text-xs text-gray-500">
                                         <span className="font-mono bg-gray-50 px-2 py-0.5 rounded">ID: {selectedStudent.id}</span>
                                         <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                         <span>{selectedStudent.gender === 'MALE' ? 'طالب' : 'طالبة'}</span>
                                     </div>
                                 </div>
                             </div>

                             {loading ? (
                                 <div className="flex-1 flex flex-col items-center justify-center">
                                     <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                                     <p className="text-gray-400 text-sm">جاري جلب الدرجات التراكمية...</p>
                                 </div>
                             ) : groupedGrades.length > 0 ? (
                                 <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 pr-4">
                                     <table className="w-full text-sm text-right border-collapse">
                                         <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0">
                                             <tr>
                                                 <th className="py-3 px-3 border-b border-gray-200 w-12 text-center">#</th>
                                                 <th className="py-3 px-3 border-b border-gray-200">المادة الدراسية</th>
                                                 <th className="py-3 px-3 border-b border-gray-200 text-center w-24">الدرجة</th>
                                                 <th className="py-3 px-3 border-b border-gray-200 text-center w-32">التقدير</th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-gray-100">
                                             {groupedGrades.map((g, idx) => (
                                                 <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                     <td className="py-3 px-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                                                     <td className="py-3 px-3 font-bold text-gray-800">{g.name}</td>
                                                     <td className="py-3 px-3 text-center font-bold text-gray-700">{g.avgScore.toFixed(0)}</td>
                                                     <td className="py-3 px-3 text-center">
                                                         <span className={`px-3 py-1 rounded-full text-xs font-bold ${g.avgScore < 60 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                                             {g.predicate}
                                                         </span>
                                                     </td>
                                                 </tr>
                                             ))}
                                             {/* FINAL ROW: GRAND TOTAL */}
                                             <tr className="bg-emerald-50/30 border-t-2 border-emerald-100">
                                                 <td colSpan={2} className="py-4 px-4 text-left font-bold text-emerald-900">المعدل التراكمي العام</td>
                                                 <td className="py-4 px-3 text-center font-extrabold text-lg text-emerald-900">{overallAvg.score.toFixed(2)}</td>
                                                 <td className="py-4 px-3 text-center">
                                                     <span className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                                                         {overallAvg.predicate}
                                                     </span>
                                                 </td>
                                             </tr>
                                         </tbody>
                                     </table>
                                 </div>
                             ) : (
                                 <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-gray-400">
                                     <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                         <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                     </div>
                                     <p className="text-sm">لا توجد سجلات أكاديمية لهذا الطالب</p>
                                 </div>
                             )}
                         </>
                     ) : (
                         <div className="flex-1 flex flex-col items-center justify-center h-full text-gray-400">
                             <svg className="w-20 h-20 mb-4 opacity-10 text-[#064E3B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                             <p className="text-sm font-medium text-gray-400">يرجى اختيار طالب من القائمة لعرض كشف الدرجات</p>
                         </div>
                     )}
                 </div>
             </div>
        </div>
    );
};

export default AdminDashboard;