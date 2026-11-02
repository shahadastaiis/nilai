import React, { useState, useEffect, useMemo } from 'react';
import { User, AcademicYear, StudentEnrollment, Role, GradeStatus, MasterSubject, SubjectView, UserStatus, Class, ClassSubject, ClassRecapRow, ClassRemidiRecapRow, StudentGradeView, GradeEditRequest, RemidiRecord, RemidiSettings, StudentAcademicHistory } from '../types';
import { getAcademicYears, getAdminData, assignStudentToClass, bulkAssignStudentsToClass, createSubjectAssignment, bulkCreateSubjectAssignments, getSubjectsByYear, getEnrollmentsByYear, getClassEnrollments, toggleSemesterStatus, getSemesterUninputtedSubjectsByClass, SemesterCompletenessReport, subscribeToData, createClass, getClassesByYear, getClassRecap, getClassRemidiRecap, getMasterSubjects, bulkCreateUsers, bulkCreateMasterSubjects, removeSubjectAssignment, removeStudentFromClass, publishClassGrades, updateSubjectStatus, reloadSpecificData, normalizeGender, getStudentGrades, getAllStudentGrades, getKhsEnrolledStudents, getStudentAcademicHistory, getAcademicPredicate, compareAcademicYearsAsc, generatePdf, publishAllGradesInYear, unpublishAllGradesInYear, getGradeEditRequests, respondGradeEditRequest, updateUser, updateMasterSubject, deleteGradeEditRequest, getRemidiSettings, toggleRemidiInputStatus, toggleRemidiPublishStatus, syncAndGetRemidiCandidates, toggleRemidiEligibility, bulkSetRemidiEligibility, saveRemidiScore } from '../services/mockData';
import { showSuccess, showError, confirmDelete, confirmAction } from '../utils/swal';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

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
              case 'settings': targets = ['academic_years', 'classes', 'class_subjects', 'student_enrollments', 'grades', 'grade_edit_requests', 'users', 'master_subjects']; break;
              case 'remidi': targets = ['remidi_settings', 'remidi_records', 'grade_edit_requests', 'classes', 'student_enrollments', 'class_subjects', 'grades', 'users', 'academic_years', 'master_subjects']; break;
              case 'report':
              case 'khs': targets = ['classes', 'student_enrollments', 'class_subjects', 'grades', 'users', 'academic_years', 'master_subjects', 'remidi_settings', 'remidi_records']; break;
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
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2.5 mb-3.5 sm:mb-5">
            <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                    {activeMenu === 'students' && 'سجل الطلاب'}
                    {activeMenu === 'lecturers' && 'أعضاء هيئة التدريس'}
                    {activeMenu === 'subjects' && 'المقررات الدراسية'}
                    {activeMenu === 'classes' && 'الفصول والشعب'}
                    {activeMenu === 'remidi' && 'إدارة الاختبار التكميلي'}
                    {activeMenu === 'settings' && 'إعدادات النظام والرصد'}
                    {activeMenu === 'report' && 'تقارير وكشوف الدرجات'}
                    {activeMenu === 'khs' && 'السجل الأكاديمي التراكمي'}
                </h2>
                <p className="text-slate-400 font-bold text-[10px] sm:text-xs mt-0.5 truncate">لوحة التحكم الأكاديمية</p>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
                {activeMenu !== 'khs' && (
                    <div className="bg-slate-50 h-9 px-2.5 rounded-xl border border-slate-200/80 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap hidden sm:inline">العام:</span>
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-transparent font-extrabold text-[#064E3B] text-xs outline-none cursor-pointer tabular-nums"
                            aria-label="العام الدراسي"
                        >
                            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                    </div>
                )}

                <button 
                    onClick={handleReload}
                    disabled={reloading}
                    className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 hover:text-[#064E3B] hover:bg-emerald-50 hover:border-emerald-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
                    title="تحديث البيانات"
                    aria-label="تحديث البيانات"
                >
                    <svg className={`w-4 h-4 ${reloading ? 'animate-spin text-[#064E3B]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>
      </div>
  );

  const renderSubMenu = () => {
      let items: {id: string, label: string}[] = [];
      if (['students', 'lecturers', 'subjects'].includes(activeMenu)) {
          items = [
              {id: 'students', label: 'الطلاب'},
              {id: 'lecturers', label: 'المحاضرون'},
              {id: 'subjects', label: 'المقررات'},
          ];
      } else if (['classes', 'remidi', 'report', 'khs'].includes(activeMenu)) {
          items = [
              {id: 'classes', label: 'الفصول'},
              {id: 'remidi', label: 'التكميلي'},
              {id: 'report', label: 'التقارير'},
              {id: 'khs', label: 'السجل التراكمي'},
          ];
      } else {
          return null;
      }

      return (
          <div className="lg:hidden flex overflow-x-auto gap-1.5 mb-4 pb-1 no-scrollbar">
              {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onMenuChange(item.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                        activeMenu === item.id 
                        ? 'bg-[#064E3B] text-white shadow-sm' 
                        : 'bg-white text-slate-500 border border-slate-200/80'
                    }`}
                  >
                      {item.label}
                  </button>
              ))}
          </div>
      );
  };

  const isFemaleAdmin = user.role === Role.ADMIN_PUTRI;

  return (
    <div className="animate-fade-in pb-16">
        <HeaderBlock />
        {renderSubMenu()}

        <div className="min-h-[400px]">
            {activeMenu === 'students' && <MasterUserManager role={Role.STUDENT} isFemaleAdmin={isFemaleAdmin} />}
            {activeMenu === 'lecturers' && <MasterUserManager role={Role.LECTURER} isFemaleAdmin={isFemaleAdmin} />}
            {activeMenu === 'subjects' && <MasterSubjectManager />}
            {activeMenu === 'classes' && <ClassTransactionManager yearId={selectedYear} refreshKey={refreshKey} isFemaleAdmin={isFemaleAdmin} />}
            {activeMenu === 'remidi' && <RemidiAdminManager yearId={selectedYear} refreshKey={refreshKey} isFemaleAdmin={isFemaleAdmin} />}
            {activeMenu === 'settings' && <GradeSettingsManager yearId={selectedYear} refreshKey={refreshKey} isFemaleAdmin={isFemaleAdmin} />}
            {activeMenu === 'report' && <RecapManager yearId={selectedYear} years={years} isFemaleAdmin={isFemaleAdmin} />}
            {activeMenu === 'khs' && (
              <KhsManager
                yearId={selectedYear}
                years={years}
                onYearChange={setSelectedYear}
                refreshKey={refreshKey}
                isFemaleAdmin={isFemaleAdmin}
              />
            )}
        </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const MasterUserManager = ({ role, isFemaleAdmin }: { role: Role, isFemaleAdmin?: boolean }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [importing, setImporting] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    
    useEffect(() => {
        getAdminData().then(d => {
            let list = role === Role.STUDENT ? d.students : d.lecturers;
            if (isFemaleAdmin) {
                list = list.filter(u => u.gender === 'FEMALE');
            }
            setUsers(list);
        });
    }, [role, isFemaleAdmin]);

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
                        gender: isFemaleAdmin ? 'FEMALE' : normalizeGender(row['Gender'] || row['gender'] || row['الجنس']), 
                        status: UserStatus.ACTIVE,
                        password: '123' 
                    };
                });

                if(newUsers.length > 0) {
                    await bulkCreateUsers(newUsers);
                    showSuccess(`تم استيراد ${newUsers.length} سجل بنجاح`);
                    const d = await getAdminData();
                    let list = role === Role.STUDENT ? d.students : d.lecturers;
                    if (isFemaleAdmin) list = list.filter(u => u.gender === 'FEMALE');
                    setUsers(list);
                }
            } catch(e) {
                showError('فشل استيراد الملف، تأكد من صحة التنسيق');
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        try {
            await updateUser(editingUser);
            showSuccess('تم تحديث البيانات بنجاح');
            const d = await getAdminData();
            let list = role === Role.STUDENT ? d.students : d.lecturers;
            if (isFemaleAdmin) list = list.filter(u => u.gender === 'FEMALE');
            setUsers(list);
            setEditingUser(null);
        } catch (err: any) {
            showError(err.message || 'فشل تحديث البيانات');
        }
    };

    const downloadTemplate = () => {
        const data = [
            { 'الرقم': '1001', 'الاسم': 'الاسم الثلاثي', 'الجنس': 'ذكر' }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "نموذج");
        XLSX.writeFile(wb, `${role === Role.STUDENT ? 'نموذج_الطلاب' : 'نموذج_المحاضرين'}.xlsx`);
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.id.includes(searchTerm)
    );

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                 <div className="relative flex-1 max-w-md">
                     <input 
                        type="text" 
                        placeholder={role === Role.STUDENT ? "بحث بالاسم أو الرقم الأكاديمي..." : "بحث بالاسم أو الرقم الوظيفي..."}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/15 focus:border-[#064E3B] outline-none transition-all text-xs font-bold text-slate-800"
                     />
                     <svg className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                 </div>

                 <div className="flex items-center justify-between md:justify-end gap-2">
                     <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl tabular-nums">
                         الإجمالي: {filteredUsers.length}
                     </span>
                     <button onClick={downloadTemplate} disabled={importing} className="px-3.5 py-2 text-[#064E3B] bg-emerald-50 border border-emerald-200/70 hover:bg-emerald-100 rounded-xl font-extrabold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         <span>نموذج</span>
                     </button>
                     <label className={`bg-[#064E3B] text-white px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer hover:bg-emerald-800 transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap ${importing ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        {importing ? (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        )}
                        <span>{importing ? 'جاري الرفع...' : 'استيراد'}</span>
                        <input type="file" hidden accept=".xlsx" onChange={handleImport} disabled={importing} />
                    </label>
                 </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-right text-xs">
                        <thead className="bg-slate-50/80 text-slate-500 font-extrabold border-b border-slate-200/70">
                            <tr>
                                <th className="py-3.5 px-4">{role === Role.STUDENT ? 'الرقم الأكاديمي' : 'الرقم الوظيفي'}</th>
                                <th className="py-3.5 px-4">الاسم الكامل</th>
                                <th className="py-3.5 px-4">الجنس</th>
                                <th className="py-3.5 px-4">الحالة</th>
                                <th className="py-3.5 px-4 text-center w-20">تعديل</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="py-3 px-4 font-mono tabular-nums text-[#064E3B] font-bold">{u.id}</td>
                                    <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center ${u.gender === 'MALE' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                                            {u.gender === 'MALE' ? 'ذكر' : 'أنثى'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-md text-[11px] font-bold">نشط</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <button 
                                            onClick={() => setEditingUser({ ...u })}
                                            className="text-slate-400 hover:text-[#064E3B] bg-slate-50 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors border border-slate-200/80"
                                            title="تعديل"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400 font-bold">لا توجد سجلات مطابقة</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* EDIT USER MODAL */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" dir="rtl">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
                        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                            <h3 className="text-base font-extrabold text-slate-900">
                                تعديل بيانات {role === Role.STUDENT ? 'الطالب' : 'المحاضر'}
                            </h3>
                            <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{role === Role.STUDENT ? 'الرقم الأكاديمي' : 'الرقم الوظيفي'}</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={editingUser.id} 
                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono tabular-nums text-slate-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">الاسم الكامل</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={editingUser.name} 
                                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#064E3B]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">الجنس</label>
                                <select 
                                    value={editingUser.gender} 
                                    onChange={e => setEditingUser({ ...editingUser, gender: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#064E3B]"
                                >
                                    {!isFemaleAdmin && <option value="MALE">ذكر</option>}
                                    <option value="FEMALE">أنثى</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={editingUser.password} 
                                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono tabular-nums font-bold text-slate-800 focus:outline-none focus:border-[#064E3B]"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button 
                                    type="submit"
                                    className="px-5 py-2 bg-[#064E3B] text-white hover:bg-emerald-800 rounded-xl text-xs font-extrabold shadow-xs transition-all"
                                >
                                    حفظ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const MasterSubjectManager = () => {
    const [subjects, setSubjects] = useState<MasterSubject[]>([]);
    const [importing, setImporting] = useState(false);
    const [editingSubject, setEditingSubject] = useState<MasterSubject | null>(null);
    
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
                    id: String(row['Code'] || row['id'] || row['رمز المادة'] || row['الرمز']),
                    name: row['Name'] || row['name'] || row['اسم المادة'] || row['المقرر'],
                    sks: Number(row['SKS'] || row['sks'] || row['الوحدات'] || row['الساعات'])
                }));
                if(newSubs.length > 0) {
                    await bulkCreateMasterSubjects(newSubs);
                    showSuccess(`تم استيراد ${newSubs.length} مقرر`);
                    getMasterSubjects().then(setSubjects);
                }
            } catch(e) {
                showError('فشل استيراد المقررات');
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveSubjectEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSubject) return;
        try {
            await updateMasterSubject(editingSubject);
            showSuccess('تم تحديث بيانات المقرر بنجاح');
            getMasterSubjects().then(setSubjects);
            setEditingSubject(null);
        } catch (err: any) {
            showError(err.message || 'فشل تحديث بيانات المقرر');
        }
    };

    const downloadTemplate = () => {
        const data = [
            { 'رمز المادة': 'ARB101', 'اسم المادة': 'اللغة العربية', 'الوحدات': 2 }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "نموذج");
        XLSX.writeFile(wb, `نموذج_المقررات.xlsx`);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80">
                 <div className="flex items-center gap-2">
                     <h3 className="text-sm md:text-base font-extrabold text-slate-900">قائمة المقررات</h3>
                     <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg tabular-nums">{subjects.length}</span>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={downloadTemplate} disabled={importing} className="px-3.5 py-2 text-[#064E3B] bg-emerald-50 border border-emerald-200/70 hover:bg-emerald-100 rounded-xl font-extrabold text-xs transition-colors disabled:opacity-50">
                         نموذج
                     </button>
                     <label className={`bg-[#064E3B] text-white px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer hover:bg-emerald-800 transition-all flex items-center gap-2 shadow-xs ${importing ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        {importing ? 'جاري الرفع...' : 'استيراد'}
                        <input type="file" hidden accept=".xlsx" onChange={handleImport} disabled={importing} />
                    </label>
                 </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {subjects.map((s, idx) => (
                    <div key={`${s.id}_${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-emerald-500/40 transition-all flex justify-between items-center gap-2 group">
                        <div className="min-w-0">
                            <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-[#064E3B] transition-colors truncate" title={s.name}>{s.name}</h3>
                            {s.id && s.id.trim() !== s.name.trim() && (
                                <span className="text-[11px] font-mono tabular-nums text-slate-400 block mt-0.5">{s.id}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-[#064E3B] bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-md font-bold tabular-nums">{s.sks} ساعات</span>
                            <button 
                                onClick={() => setEditingSubject({ ...s })}
                                className="text-slate-400 hover:text-[#064E3B] bg-slate-50 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors border border-slate-200/80"
                                title="تعديل"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* EDIT SUBJECT MODAL */}
            {editingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" dir="rtl">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
                        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                            <h3 className="text-base font-extrabold text-slate-900">تعديل بيانات المقرر</h3>
                            <button onClick={() => setEditingSubject(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveSubjectEdit} className="mt-4 space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">رمز المقرر</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={editingSubject.id} 
                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono tabular-nums text-slate-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">اسم المقرر</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={editingSubject.name} 
                                    onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#064E3B]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">الساعات المعتمدة</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    max="10"
                                    required 
                                    value={editingSubject.sks} 
                                    onChange={e => setEditingSubject({ ...editingSubject, sks: parseInt(e.target.value, 10) || 0 })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold tabular-nums text-slate-800 focus:outline-none focus:border-[#064E3B]"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingSubject(null)}
                                    className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button 
                                    type="submit"
                                    className="px-5 py-2 bg-[#064E3B] text-white hover:bg-emerald-800 rounded-xl text-xs font-extrabold shadow-xs transition-all"
                                >
                                    حفظ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const ClassTransactionManager = ({ yearId, refreshKey, isFemaleAdmin }: { yearId: string, refreshKey: number, isFemaleAdmin?: boolean }) => {
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

    const [selectedGender, setSelectedGender] = useState<'MALE' | 'FEMALE'>(isFemaleAdmin ? 'FEMALE' : 'MALE');

    const [activatingClassId, setActivatingClassId] = useState<string|null>(null);
    const [savingStudents, setSavingStudents] = useState(false);
    const [savingAssignments, setSavingAssignments] = useState(false);
    const [removingStudentId, setRemovingStudentId] = useState<string|null>(null);
    const [removingSubjectId, setRemovingSubjectId] = useState<string|null>(null);
    
    const [publishingClass, setPublishingClass] = useState(false);
    const [togglingSubjectId, setTogglingSubjectId] = useState<string | null>(null);

    useEffect(() => {
        if (isFemaleAdmin) setSelectedGender('FEMALE');
    }, [isFemaleAdmin]);

    useEffect(() => {
        if(yearId) {
            getClassesByYear(yearId).then(clsList => {
                const filtered = isFemaleAdmin ? clsList.filter(c => c.gender === 'FEMALE') : clsList;
                setClasses(filtered);
            });
            getAdminData().then(d => { 
                const students = isFemaleAdmin ? d.students.filter(s => s.gender === 'FEMALE') : d.students;
                const lecturers = isFemaleAdmin ? d.lecturers.filter(l => l.gender === 'FEMALE') : d.lecturers;
                setAllStudents(students); 
                setAllLecturers(lecturers); 
            });
            getMasterSubjects().then(setAllSubjects);
        }
    }, [yearId, refreshKey, isFemaleAdmin]);

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
        const s = allStudents.find(u => u.id === studentId);
        const confirmed = await confirmDelete('حذف الطالب من الفصل؟', `هل أنت متأكد من إزالة الطالب "${s?.name || studentId}" من هذا الفصل؟`);
        if (!confirmed) return;
        setRemovingStudentId(studentId);
        try {
            await removeStudentFromClass(studentId, classId);
            setEnrolledStudents(prev => prev.filter(e => e.studentId !== studentId));
            showSuccess('تم إزالة الطالب من الفصل');
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
            showSuccess(`تم إسناد ${validRows.length} مقرر بنجاح`);
            const newSubs = await getSubjectsByYear(yearId);
            setAssignedSubjects(newSubs.filter((s: any) => s.classId === selectedClass));
        } catch (e) { showError('حدث خطأ أثناء حفظ البيانات'); }
        finally { setSavingAssignments(false); }
    };

    const handleRemoveSubject = async (id: string) => {
        const sub = assignedSubjects.find(s => s.id === id);
        const confirmed = await confirmDelete('حذف المقرر من الفصل؟', `هل أنت متأكد من إلغاء إسناد مقرر "${sub?.subjectName || ''}" من هذا الفصل؟`);
        if (!confirmed) return;
        setRemovingSubjectId(id);
        try {
            await removeSubjectAssignment(id);
            setAssignedSubjects(prev => prev.filter(s => s.id !== id));
            showSuccess('تم حذف المقرر من الفصل');
        } catch(e) { showError('فشل حذف المقرر'); }
        finally { setRemovingSubjectId(null); }
    };

    const handlePublishClass = async () => {
        if (!selectedClass) return;
        if (!await confirmAction('نشر نتائج الفصل', 'هل أنت متأكد من نشر جميع درجات المقررات لهذا الفصل؟', 'نشر')) return;

        setPublishingClass(true);
        try {
            await publishClassGrades(selectedClass);
            setAssignedSubjects(prev => prev.map(s => ({ ...s, status: GradeStatus.PUBLISHED })));
            showSuccess('تم نشر نتائج الفصل بنجاح');
        } catch (e) {
            showError('فشل نشر النتائج');
        } finally {
            setPublishingClass(false);
        }
    };

    const handleToggleSubjectStatus = async (subjectId: string, currentStatus: GradeStatus) => {
        setTogglingSubjectId(subjectId);
        const newStatus = currentStatus === GradeStatus.PUBLISHED ? GradeStatus.DRAFT : GradeStatus.PUBLISHED;
        
        try {
            await updateSubjectStatus(subjectId, newStatus);
            setAssignedSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, status: newStatus } : s));
            showSuccess(newStatus === GradeStatus.PUBLISHED ? 'تم نشر المقرر' : 'تم إلغاء النشر');
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
        <div className="space-y-5">
             <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200/80">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
                    <h3 className="text-base font-extrabold text-slate-900">
                        المستويات والفصول الدراسية
                    </h3>

                    <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto border border-slate-200/60">
                        {!isFemaleAdmin && (
                            <button 
                                onClick={() => setSelectedGender('MALE')}
                                className={`flex-1 py-1.5 px-5 rounded-lg font-extrabold text-xs transition-all ${selectedGender === 'MALE' ? 'bg-white text-[#064E3B] shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                بنين
                            </button>
                        )}
                        <button 
                            onClick={() => setSelectedGender('FEMALE')}
                            className={`flex-1 py-1.5 px-5 rounded-lg font-extrabold text-xs transition-all ${selectedGender === 'FEMALE' ? 'bg-white text-[#064E3B] shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            بنات
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {PREDEFINED_CLASSES.map(name => {
                        const existingClass = classes.find(c => c.name === name && c.gender === selectedGender);
                        const isActive = !!(existingClass && existingClass.id);
                        const isSelected = isActive && existingClass.id === selectedClass;
                        const isActivating = activatingClassId === name;
                        
                        return (
                            <div 
                                key={name} 
                                onClick={() => !isActivating && (isActive ? setSelectedClass(existingClass.id) : handleActivateClass(name))} 
                                className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center h-24 group ${
                                    isActive
                                        ? (isSelected ? 'border-[#064E3B] bg-emerald-50/70 ring-2 ring-emerald-500/15' : 'border-slate-200/80 bg-white hover:border-emerald-400 hover:shadow-xs')
                                        : 'border-dashed border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                                } ${isActivating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isActivating ? (
                                     <svg className="animate-spin h-5 w-5 text-[#064E3B]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <>
                                        <span className={`font-extrabold text-xs mb-1.5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{name}</span>
                                        {isActive ? (
                                            <span className="text-[10px] bg-emerald-100 text-[#064E3B] px-2 py-0.5 rounded-md font-bold">مفعل</span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 group-hover:text-[#064E3B] font-bold">+ تفعيل</span>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
             </div>
             
             {selectedClass && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                     <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col h-[420px] sm:h-[480px]">
                         <div className="flex flex-wrap justify-between items-center gap-2 mb-3.5 pb-3 border-b border-slate-100">
                             <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                                 <span>الطلاب المسجلون</span>
                                 <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs text-slate-700 font-mono tabular-nums font-bold">{enrolledStudents.length}</span>
                             </h4>
                             <button onClick={openStudentModal} className="bg-[#064E3B] hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap">
                                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                 <span>إضافة طلاب</span>
                             </button>
                         </div>
                         <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                             {enrolledStudents.map(e => {
                                 const s = allStudents.find(u => u.id === e.studentId);
                                 const displayName = s ? s.name : "غير متوفر";
                                 const displayInitial = s && s.name ? s.name.charAt(0) : "؟";
                                 const isMissing = !s;
                                 const isRemoving = removingStudentId === e.studentId;

                                 return (
                                     <div key={e.id} className="bg-slate-50/70 p-2.5 rounded-xl flex justify-between items-center hover:bg-slate-100/80 transition-colors border border-slate-200/50 gap-2">
                                         <div className="flex items-center gap-2.5 min-w-0">
                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border border-white shadow-2xs shrink-0 ${isMissing ? 'bg-red-100 text-red-600' : 'bg-white text-slate-600'}`}>
                                                 {displayInitial}
                                             </div>
                                             <div className="min-w-0">
                                                 <div className={`text-xs font-bold truncate ${isMissing ? 'text-red-600' : 'text-slate-900'}`}>{displayName}</div>
                                                 <div className="text-[10px] font-mono tabular-nums text-slate-400">{e.studentId}</div>
                                             </div>
                                         </div>
                                         <button onClick={() => !isRemoving && handleRemoveStudent(e.studentId, e.classId)} disabled={isRemoving} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-slate-200/70 shrink-0" title="حذف">
                                             {isRemoving ? <svg className="animate-spin h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                                         </button>
                                     </div>
                                 );
                             })}
                             {enrolledStudents.length === 0 && <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">لا يوجد طلاب مسجلون</div>}
                         </div>
                     </div>

                     <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col h-[420px] sm:h-[480px]">
                         <div className="flex flex-wrap justify-between items-center gap-2 mb-3.5 pb-3 border-b border-slate-100">
                             <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                                 <span>المقررات الدراسية</span>
                                 <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs text-slate-700 font-mono tabular-nums font-bold">{assignedSubjects.length}</span>
                             </h4>
                             <div className="flex items-center gap-1.5">
                                 {assignedSubjects.length > 0 && (
                                    <button 
                                        onClick={handlePublishClass} 
                                        disabled={publishingClass}
                                        className="bg-emerald-50 hover:bg-emerald-100 text-[#064E3B] border border-emerald-200/70 text-xs px-3 py-1.5 rounded-xl font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                        <span>نشر الكل</span>
                                    </button>
                                 )}
                                 <button onClick={openAssignmentModal} className="bg-[#064E3B] hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap">
                                     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                     <span>إسناد مقررات</span>
                                 </button>
                             </div>
                         </div>
                         <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                             {assignedSubjects.map(s => {
                                 const isRemoving = removingSubjectId === s.id;
                                 const isToggling = togglingSubjectId === s.id;
                                 const isPublished = s.status === GradeStatus.PUBLISHED;

                                 return (
                                     <div key={s.id} className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 flex justify-between items-center gap-2">
                                         <div className="min-w-0">
                                             <div className="font-bold text-slate-900 text-xs truncate">{s.subjectName}</div>
                                             <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                                 <span className="bg-white text-[#064E3B] px-2 py-0.5 rounded border border-slate-200/80 font-bold tabular-nums text-[10px]">{s.sks} ساعات</span>
                                                 <span className="truncate">{allLecturers.find(l=>l.id===s.lecturerId)?.name || 'غير محدد'}</span>
                                             </div>
                                         </div>
                                         <div className="flex items-center gap-1.5 shrink-0">
                                             <button 
                                                 onClick={() => !isToggling && handleToggleSubjectStatus(s.id, s.status)}
                                                 disabled={isToggling}
                                                 className={`text-[10px] px-2.5 py-1 rounded-lg font-extrabold transition-all border whitespace-nowrap ${isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}
                                             >
                                                 {isToggling ? '...' : (isPublished ? 'منشور' : 'مسودة')}
                                             </button>
                                             <button onClick={() => !isRemoving && handleRemoveSubject(s.id)} disabled={isRemoving} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-slate-200/80">
                                                {isRemoving ? <svg className="animate-spin h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                                             </button>
                                         </div>
                                     </div>
                                 );
                             })}
                             {assignedSubjects.length === 0 && <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">لا توجد مقررات مسندة</div>}
                         </div>
                     </div>
                 </div>
             )}

             {showStudentModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                     <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh] border border-slate-200">
                         <div className="bg-[#064E3B] px-5 py-4 flex justify-between items-center text-white">
                             <h3 className="font-extrabold text-sm">إضافة طلاب للفصل</h3>
                             <button onClick={() => setShowStudentModal(false)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                         </div>
                         <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex gap-2 items-center justify-between">
                             <div className="relative flex-1">
                                 <input 
                                    type="text" 
                                    placeholder="بحث بالاسم أو الرقم الأكاديمي..." 
                                    value={studentSearchTerm}
                                    onChange={e => setStudentSearchTerm(e.target.value)}
                                    className="w-full pl-4 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-[#064E3B]"
                                 />
                                 <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                             </div>
                             <button onClick={toggleSelectAllStudents} className="px-3.5 py-2 text-xs font-extrabold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 whitespace-nowrap">تحديد الكل</button>
                         </div>
                         <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                             {filteredModalStudents.map(s => (
                                 <div key={s.id} onClick={() => toggleStudentSelection(s.id)} className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${selectedStudentIds.has(s.id) ? 'bg-emerald-50 border-[#064E3B]' : 'bg-white border-slate-200/70 hover:border-emerald-200'}`}>
                                     <div className="flex items-center gap-3">
                                         <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedStudentIds.has(s.id) ? 'bg-[#064E3B] border-[#064E3B] text-white' : 'border-slate-300 bg-white'}`}>
                                             {selectedStudentIds.has(s.id) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                         </div>
                                         <div>
                                             <p className="font-bold text-slate-900 text-xs">{s.name}</p>
                                             <p className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">{s.id}</p>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             {filteredModalStudents.length === 0 && <div className="text-center py-12 text-slate-400 text-xs font-bold">لا يوجد طلاب متاحون للإضافة</div>}
                         </div>
                         <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white">
                             <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg tabular-nums">المحدد: {selectedStudentIds.size}</span>
                             <button onClick={handleBulkAddStudents} disabled={selectedStudentIds.size === 0 || savingStudents} className="bg-[#064E3B] hover:bg-emerald-800 text-white px-6 py-2 rounded-xl font-extrabold text-xs disabled:opacity-50 transition-all">
                                 {savingStudents ? 'جاري الإضافة...' : 'إضافة'}
                             </button>
                         </div>
                     </div>
                 </div>
             )}

             {showAssignmentModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                     <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] border border-slate-200">
                         <div className="bg-[#064E3B] px-5 py-4 flex justify-between items-center text-white">
                             <h3 className="font-extrabold text-sm">إسناد المقررات الدراسية</h3>
                             <button onClick={() => setShowAssignmentModal(false)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                         </div>
                         
                         <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 space-y-3">
                             {assignmentRows.map((row, index) => {
                                 const availableSubjects = getAvailableSubjectsForRow(row.id);
                                 const currentSub = allSubjects.find(s => s.id === row.subjectId);
                                 const displaySubjects = currentSub
                                     ? [currentSub, ...availableSubjects.filter(s => s.id !== currentSub.id)]
                                     : availableSubjects;

                                 return (
                                     <div key={row.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex flex-col md:flex-row gap-3 items-end md:items-center">
                                         <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#064E3B] flex items-center justify-center font-extrabold text-xs shrink-0 tabular-nums">
                                             {index + 1}
                                         </div>
                                         
                                         <div className="flex-1 w-full">
                                             <label className="block text-[10px] font-bold text-slate-500 mb-1">المقرر</label>
                                             <select 
                                                value={row.subjectId} 
                                                onChange={e => updateAssignmentRow(row.id, 'subjectId', e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#064E3B]"
                                             >
                                                 <option value="">— اختر المقرر —</option>
                                                 {displaySubjects.map((s, sIdx) => (
                                                     <option key={`${s.id}_${sIdx}`} value={s.id}>{s.name} ({s.sks} ساعات)</option>
                                                 ))}
                                             </select>
                                         </div>

                                         <div className="flex-1 w-full">
                                             <label className="block text-[10px] font-bold text-slate-500 mb-1">المحاضر</label>
                                             <select 
                                                value={row.lecturerId} 
                                                onChange={e => updateAssignmentRow(row.id, 'lecturerId', e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#064E3B]"
                                             >
                                                 <option value="">— اختر المحاضر —</option>
                                                 {allLecturers.map((l, lIdx) => (
                                                     <option key={`${l.id}_${lIdx}`} value={l.id}>{l.name}</option>
                                                 ))}
                                             </select>
                                         </div>

                                         <button onClick={() => removeAssignmentRow(row.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                         </button>
                                     </div>
                                 );
                             })}
                             
                             <button onClick={addAssignmentRow} className="w-full py-2.5 border border-dashed border-slate-300 rounded-xl text-slate-600 font-extrabold hover:border-[#064E3B] hover:text-[#064E3B] hover:bg-emerald-50/40 transition-all flex items-center justify-center gap-1.5 text-xs">
                                 <span>+ إضافة مقرر آخر</span>
                             </button>
                         </div>

                         <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-white">
                             <button onClick={() => setShowAssignmentModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
                             <button onClick={handleBulkSaveAssignments} disabled={savingAssignments} className="bg-[#064E3B] hover:bg-emerald-800 text-white px-6 py-2 rounded-xl font-extrabold text-xs disabled:opacity-50">
                                 {savingAssignments ? 'جاري الحفظ...' : 'حفظ'}
                             </button>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

const GradeSettingsManager = ({ yearId, refreshKey, isFemaleAdmin }: { yearId: string, refreshKey: number, isFemaleAdmin?: boolean }) => {
    const [year, setYear] = useState<AcademicYear | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [unpublishing, setUnpublishing] = useState(false);
    const [togglingSem, setTogglingSem] = useState<1 | 2 | null>(null);

    const [requests, setRequests] = useState<GradeEditRequest[]>([]);
    const [allLecturers, setAllLecturers] = useState<User[]>([]);
    const [subjects, setSubjects] = useState<SubjectView[]>([]);
    const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'>('PENDING');
    const [semesterFilter, setSemesterFilter] = useState<'ALL' | '1' | '2' | 'REMIDI'>('ALL');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const [sem1Report, setSem1Report] = useState<SemesterCompletenessReport | null>(null);
    const [sem2Report, setSem2Report] = useState<SemesterCompletenessReport | null>(null);
    const [activeCompletenessSem, setActiveCompletenessSem] = useState<1 | 2>(1);

    const loadData = async () => {
        const [yrs, reqs, adminD, subs, clsList] = await Promise.all([
            getAcademicYears(),
            getGradeEditRequests(yearId),
            getAdminData(),
            getSubjectsByYear(yearId),
            getClassesByYear(yearId)
        ]);

        const y = yrs.find(x => x.id === yearId);
        setYear(y || null);
        if (isFemaleAdmin) {
            const femaleClassIds = clsList.filter(c => c.gender === 'FEMALE').map(c => c.id);
            const femaleSubs = subs.filter(s => femaleClassIds.includes(s.classId));
            const femaleSubIds = femaleSubs.map(s => s.id);
            setRequests(reqs.filter(r => femaleSubIds.includes(r.classSubjectId)));
            setSubjects(femaleSubs);
        } else {
            setRequests(reqs);
            setSubjects(subs);
        }
        setAllLecturers(adminD.lecturers);

        const rep1 = getSemesterUninputtedSubjectsByClass(yearId, 1, isFemaleAdmin);
        const rep2 = getSemesterUninputtedSubjectsByClass(yearId, 2, isFemaleAdmin);
        setSem1Report(rep1);
        setSem2Report(rep2);
    };

    useEffect(() => {
        loadData();
    }, [yearId, refreshKey, isFemaleAdmin]);

    const handleToggle = async (sem: 1 | 2, currentVal: boolean) => {
        const nextVal = !currentVal;
        const semName = sem === 1 ? 'الفصل الأول' : 'الفصل الثاني';
        const report = sem === 1 ? sem1Report : sem2Report;

        // Jika Admin ingin MENUTUP akses penginputan nilai (currentVal === true -> nextVal === false)
        // Wajib pastikan seluruh mata kuliah sudah terinput nilainya!
        if (!nextVal && report) {
            setActiveCompletenessSem(sem);
            if (report.totalSubjectsCount === 0) {
                showError(`لا يمكن إغلاق رصد ${semName} لعدم وجود مقررات دراسية مسندة لطلاب في هذا العام.`);
                return;
            }
            if (!report.isComplete) {
                showError(
                    `تنبيه: لا يمكن إغلاق رصد ${semName}! لا يزال هناك (${report.missingSubjectsCount}) مقرر دراسي في (${report.uninputtedByClass.length}) فصل لم يتم إدخال درجاته بعد. يرجى مراجعة قائمة المقررات والمحاضرين أدناه أولاً.`
                );
                const warningEl = document.getElementById('completeness-warning-section');
                if (warningEl) {
                    warningEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
        }

        const actionTitle = nextVal ? `فتح رصد ${semName}` : `إغلاق رصد ${semName}`;
        const actionText = nextVal 
            ? (report && report.inputtedSubjectsCount > 0
                ? `هل تريد إعادة فتح ${semName}؟ بما أن الدرجات قد رُصدت مسبقاً، فسيتمكن المحاضرون من تعديل الدرجات فقط عبر تقديم طلب تعديل للإدارة.`
                : `هل تريد فتح رصد الدرجات لـ ${semName} ليتمكن المحاضرون من إدخال الدرجات؟`)
            : `جميع المقررات الدراسية (${report?.inputtedSubjectsCount || 0}) مكتملة الرصد. هل تريد إغلاق رصد الدرجات لـ ${semName} نهائياً؟`;

        const confirmed = await confirmAction(
            actionTitle,
            actionText,
            nextVal ? 'فتح الرصد' : 'إغلاق الرصد',
            !nextVal
        );

        if (!confirmed) return;

        setTogglingSem(sem);
        try {
            await toggleSemesterStatus(yearId, sem, nextVal);
            await loadData();
            showSuccess(`تم ${nextVal ? 'فتح' : 'إغلاق'} رصد ${semName}`);
        } catch (e: any) {
            showError(e.message || 'فشل تحديث الحالة');
        } finally {
            setTogglingSem(null);
        }
    };

    const handlePublishAll = async () => {
        if (!await confirmAction('نشر النتائج للطلاب؟', 'سيتم إعلان جميع الدرجات للطلاب في هذا العام الدراسي.', 'نشر', true)) return;
        
        setPublishing(true);
        try {
            await publishAllGradesInYear(yearId);
            await loadData();
            showSuccess('تم نشر جميع النتائج للطلاب');
        } catch(e) {
            showError('حدث خطأ أثناء النشر');
        } finally {
            setPublishing(false);
        }
    };

    const handleUnpublishAll = async () => {
        if (!await confirmAction('إلغاء نشر النتائج؟', 'سيتم حجب الدرجات عن الطلاب وإعادتها لوضع المسودة.', 'إلغاء النشر', true)) return;
        
        setUnpublishing(true);
        try {
            await unpublishAllGradesInYear(yearId);
            await loadData();
            showSuccess('تم إلغاء نشر النتائج');
        } catch(e) {
            showError('حدث خطأ أثناء إلغاء النشر');
        } finally {
            setUnpublishing(false);
        }
    };

    const handleApprove = async (req: GradeEditRequest) => {
        const sub = subjects.find(s => s.id === req.classSubjectId);
        const lecturer = allLecturers.find(l => l.id === req.lecturerId);
        
        const confirmed = await confirmAction(
            'قبول طلب التعديل؟',
            `هل توافق على فتح تعديل درجات مقرر "${sub?.subjectName || ''}" للمحاضر "${lecturer?.name || req.lecturerId}"؟`,
            'قبول'
        );

        if (!confirmed) return;

        setActionLoadingId(req.id);
        try {
            await respondGradeEditRequest(req.id, 'APPROVED');
            showSuccess('تم قبول الطلب');
            await loadData();
        } catch (e: any) {
            showError(e.message || 'فشل قبول الطلب');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleReject = async (req: GradeEditRequest) => {
        const sub = subjects.find(s => s.id === req.classSubjectId);

        const confirmed = await confirmAction(
            'رفض طلب التعديل؟',
            `هل أنت متأكد من رفض طلب تعديل مقرر "${sub?.subjectName || ''}"؟`,
            'رفض',
            true
        );

        if (!confirmed) return;

        setActionLoadingId(req.id);
        try {
            await respondGradeEditRequest(req.id, 'REJECTED');
            showSuccess('تم رفض الطلب');
            await loadData();
        } catch (e: any) {
            showError(e.message || 'فشل رفض الطلب');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDeleteRequest = async (req: GradeEditRequest) => {
        const confirmed = await confirmDelete('حذف الطلب؟', 'هل أنت متأكد من حذف هذا الطلب نهائياً؟');
        if (!confirmed) return;
        setActionLoadingId(req.id);
        try {
            await deleteGradeEditRequest(req.id);
            showSuccess('تم حذف الطلب');
            await loadData();
        } catch (e: any) {
            showError(e.message || 'فشل حذف الطلب');
        } finally {
            setActionLoadingId(null);
        }
    };

    const pendingCount = requests.filter(r => r.status === 'PENDING').length;

    const filteredRequests = useMemo(() => {
        let res = requests;
        if (requestFilter !== 'ALL') {
            res = res.filter(r => r.status === requestFilter);
        }
        if (semesterFilter === '1') {
            res = res.filter(r => !r.isRemidi && r.semester === 1);
        } else if (semesterFilter === '2') {
            res = res.filter(r => !r.isRemidi && r.semester === 2);
        } else if (semesterFilter === 'REMIDI') {
            res = res.filter(r => Boolean(r.isRemidi));
        }
        return res;
    }, [requests, requestFilter, semesterFilter]);

    const isPublished = useMemo(() => {
        if (subjects.length === 0) return false;
        return subjects.some(s => s.status === GradeStatus.PUBLISHED);
    }, [subjects]);

    if (!year) return <div className="p-8 text-center text-slate-400 font-bold">جاري تحميل الإعدادات...</div>;

    const activeReport = activeCompletenessSem === 1 ? sem1Report : sem2Report;

    return (
        <div className="space-y-5">
            {/* 1. SEMESTER ACCESS & PUBLISH */}
            <div className="grid md:grid-cols-3 gap-4">
                <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${year.isSem1Active ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200/80'}`}>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-extrabold text-sm text-slate-900">الفصل الدراسي الأول</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${year.isSem1Active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                {year.isSem1Active ? 'مفتوح' : 'مغلق'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                            {year.isSem1Active ? 'الرصد متاح للمحاضرين' : 'الرصد مقفل حالياً'}
                        </p>
                        {sem1Report && (
                            <div className={`mb-3.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between ${
                                sem1Report.isComplete
                                    ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
                                    : 'bg-amber-50 border-amber-200/80 text-amber-900'
                            }`}>
                                <span>حالة رصد المقررات:</span>
                                <span className="font-extrabold tabular-nums">
                                    {sem1Report.inputtedSubjectsCount} / {sem1Report.totalSubjectsCount} مكتمل
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => handleToggle(1, year.isSem1Active)}
                        disabled={togglingSem === 1}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            year.isSem1Active 
                            ? (sem1Report?.isComplete
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-amber-600 hover:bg-amber-700 text-white')
                            : 'bg-[#064E3B] hover:bg-emerald-800 text-white'
                        } disabled:opacity-50`}
                    >
                        {togglingSem === 1
                            ? 'جاري التنفيذ...'
                            : year.isSem1Active
                                ? (sem1Report && !sem1Report.isComplete
                                    ? `إغلاق الرصد (متبقي ${sem1Report.missingSubjectsCount} مقرر)`
                                    : 'إغلاق الرصد')
                                : 'فتح الرصد'}
                    </button>
                </div>

                <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${year.isSem2Active ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200/80'}`}>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-extrabold text-sm text-slate-900">الفصل الدراسي الثاني</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${year.isSem2Active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                {year.isSem2Active ? 'مفتوح' : 'مغلق'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                            {year.isSem2Active ? 'الرصد متاح للمحاضرين' : 'الرصد مقفل حالياً'}
                        </p>
                        {sem2Report && (
                            <div className={`mb-3.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between ${
                                sem2Report.isComplete
                                    ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
                                    : 'bg-amber-50 border-amber-200/80 text-amber-900'
                            }`}>
                                <span>حالة رصد المقررات:</span>
                                <span className="font-extrabold tabular-nums">
                                    {sem2Report.inputtedSubjectsCount} / {sem2Report.totalSubjectsCount} مكتمل
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => handleToggle(2, year.isSem2Active)}
                        disabled={togglingSem === 2}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            year.isSem2Active 
                            ? (sem2Report?.isComplete
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-amber-600 hover:bg-amber-700 text-white')
                            : 'bg-[#064E3B] hover:bg-emerald-800 text-white'
                        } disabled:opacity-50`}
                    >
                        {togglingSem === 2
                            ? 'جاري التنفيذ...'
                            : year.isSem2Active
                                ? (sem2Report && !sem2Report.isComplete
                                    ? `إغلاق الرصد (متبقي ${sem2Report.missingSubjectsCount} مقرر)`
                                    : 'إغلاق الرصد')
                                : 'فتح الرصد'}
                    </button>
                </div>

                <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${isPublished ? 'bg-red-50/40 border-red-200' : 'bg-emerald-50/40 border-emerald-200'}`}>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-extrabold text-sm text-slate-900">نشر النتائج للطلاب</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${isPublished ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {isPublished ? 'منشورة' : 'غير منشورة'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            {isPublished ? 'النتائج معلنة في حسابات الطلاب' : 'النتائج محجوبة عن الطلاب حالياً'}
                        </p>
                    </div>
                    {isPublished ? (
                        <button 
                            onClick={handleUnpublishAll} 
                            disabled={publishing || unpublishing}
                            className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all disabled:opacity-50"
                        >
                            {unpublishing ? 'جاري الإلغاء...' : 'إلغاء النشر'}
                        </button>
                    ) : (
                        <button 
                            onClick={handlePublishAll} 
                            disabled={publishing || unpublishing}
                            className="w-full bg-[#064E3B] hover:bg-emerald-800 text-white py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all disabled:opacity-50"
                        >
                            {publishing ? 'جاري النشر...' : 'نشر'}
                        </button>
                    )}
                </div>
            </div>

            {/* 1B. PRE-CLOSURE COMPLETENESS WARNING CLASSIFIED BY CLASS IN COLUMNS */}
            <div id="completeness-warning-section" className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                                التحقق من اكتمال رصد المقررات قبل إغلاق الرصد
                            </h3>
                            {activeReport && !activeReport.isComplete && (
                                <span className="bg-amber-500 text-white text-[10px] px-2.5 py-0.5 rounded-full font-extrabold tabular-nums">
                                    متبقي {activeReport.missingSubjectsCount} مقرر
                                </span>
                            )}
                            {activeReport && activeReport.isComplete && (
                                <span className="bg-emerald-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-extrabold">
                                    مكتمل 100%
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                            لا يمكن إغلاق رصد الفصل الدراسي إلا بعد التأكد من إدخال درجات جميع المقررات في كافة الفصول الدراسية.
                        </p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-extrabold gap-1 shrink-0 self-start sm:self-auto">
                        <button
                            onClick={() => setActiveCompletenessSem(1)}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeCompletenessSem === 1 ? 'bg-white text-[#064E3B] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>الفصل الأول</span>
                            {sem1Report && (
                                <span className={`px-1.5 py-0.2 rounded text-[10px] tabular-nums ${
                                    sem1Report.isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {sem1Report.missingSubjectsCount === 0 ? 'مكتمل' : `متبقي ${sem1Report.missingSubjectsCount}`}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveCompletenessSem(2)}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeCompletenessSem === 2 ? 'bg-white text-[#064E3B] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>الفصل الثاني</span>
                            {sem2Report && (
                                <span className={`px-1.5 py-0.2 rounded text-[10px] tabular-nums ${
                                    sem2Report.isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {sem2Report.missingSubjectsCount === 0 ? 'مكتمل' : `متبقي ${sem2Report.missingSubjectsCount}`}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {activeReport && activeReport.totalSubjectsCount === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                        لا توجد مقررات مسندة لفصول بها طلاب في هذا العام الدراسي.
                    </div>
                ) : activeReport && activeReport.isComplete ? (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-xs sm:text-sm font-extrabold text-emerald-950">
                                    جميع المقررات الدراسية في {activeCompletenessSem === 1 ? 'الفصل الأول' : 'الفصل الثاني'} تم رصد درجاتها بالكامل ({activeReport.inputtedSubjectsCount} من {activeReport.totalSubjectsCount})
                                </h4>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    يمكن للإدارة الآن إغلاق رصد الدرجات لهذا الفصل الدراسي بأمان.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : activeReport ? (
                    <div className="space-y-3">
                        <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3 text-amber-950 text-xs flex items-start gap-2.5">
                            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <span className="font-extrabold block">
                                    تنبيه: يوجد ({activeReport.missingSubjectsCount}) مقرر دراسي لم يتم إدخال درجاته في {activeCompletenessSem === 1 ? 'الفصل الأول' : 'الفصل الثاني'}!
                                </span>
                                <span className="text-[11px] text-amber-800 block mt-0.5">
                                    فيما يلي قائمة المقررات غير المرصودة وأسماء المحاضرين مصنفة في أعمدة حسب كل فصل دراسي:
                                </span>
                            </div>
                        </div>

                        {/* Multi-Column Table Where Each Column Is a Class */}
                        <div className="overflow-x-auto pb-2">
                            <div className="inline-grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 min-w-full">
                                {activeReport.uninputtedByClass.map((col) => (
                                    <div
                                        key={col.classObj.id}
                                        className="bg-slate-50/70 rounded-xl border border-slate-200/90 overflow-hidden flex flex-col"
                                    >
                                        {/* Column Header: Class Name */}
                                        <div className="bg-[#064E3B] text-white px-3.5 py-2.5 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-extrabold text-xs sm:text-sm truncate">
                                                    {col.classObj.name}
                                                </div>
                                                <div className="text-[10px] text-emerald-100 flex items-center gap-1.5 mt-0.5">
                                                    <span>{col.classObj.gender === 'FEMALE' ? 'بنات' : 'بنين'}</span>
                                                    <span>•</span>
                                                    <span className="tabular-nums">{col.studentCount} طالب</span>
                                                </div>
                                            </div>
                                            <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 tabular-nums">
                                                متبقي {col.missingSubjects.length}
                                            </span>
                                        </div>

                                        {/* Column Body: List of Uninputted Subjects & Assigned Lecturers */}
                                        <div className="p-2.5 space-y-2 flex-1 divide-y divide-slate-100">
                                            {col.missingSubjects.map((sub, sIdx) => (
                                                <div
                                                    key={sub.classSubjectId}
                                                    className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs space-y-1"
                                                >
                                                    <div className="flex items-start justify-between gap-1.5">
                                                        <span className="font-extrabold text-xs text-slate-900 leading-snug">
                                                            {sIdx + 1}. {sub.subjectName}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0 tabular-nums">
                                                            {sub.gradedCount}/{sub.totalStudents}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-50/70 px-2 py-1 rounded-md border border-amber-200/60">
                                                        <svg className="w-3.5 h-3.5 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        <span className="font-bold truncate" title={sub.lecturerName}>
                                                            {sub.lecturerName}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* 2. GRADE EDIT REQUEST MANAGEMENT */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 sm:mb-5">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-extrabold text-slate-900">طلبات تعديل الدرجات</h3>
                        {pendingCount > 0 && (
                            <span className="bg-amber-500 text-white text-[11px] px-2.5 py-0.5 rounded-full font-extrabold tabular-nums">
                                {pendingCount} جديد
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-extrabold gap-1 overflow-x-auto max-w-full no-scrollbar">
                            <button onClick={() => setSemesterFilter('ALL')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${semesterFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}>الكل</button>
                            <button onClick={() => setSemesterFilter('1')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${semesterFilter === '1' ? 'bg-white text-[#064E3B] shadow-2xs' : 'text-slate-500'}`}>الأول</button>
                            <button onClick={() => setSemesterFilter('2')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${semesterFilter === '2' ? 'bg-white text-[#064E3B] shadow-2xs' : 'text-slate-500'}`}>الثاني</button>
                            <button onClick={() => setSemesterFilter('REMIDI')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${semesterFilter === 'REMIDI' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-500'}`}>التكميلي</button>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-extrabold gap-1 overflow-x-auto max-w-full no-scrollbar">
                            <button onClick={() => setRequestFilter('PENDING')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'PENDING' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-500'}`}>المعلقة ({pendingCount})</button>
                            <button onClick={() => setRequestFilter('APPROVED')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'APPROVED' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-500'}`}>المقبولة</button>
                            <button onClick={() => setRequestFilter('REJECTED')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'REJECTED' ? 'bg-white text-red-800 shadow-2xs' : 'text-slate-500'}`}>المرفوضة</button>
                            <button onClick={() => setRequestFilter('COMPLETED')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'COMPLETED' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'}`}>المكتملة</button>
                            <button onClick={() => setRequestFilter('ALL')} className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}>الجميع</button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/70">
                    <table className="w-full min-w-[640px] text-right text-xs">
                        <thead className="bg-slate-50/80 text-slate-500 font-extrabold border-b border-slate-200/70">
                            <tr>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3">المحاضر</th>
                                <th className="p-3">المقرر والفصل</th>
                                <th className="p-3 text-center">النطاق</th>
                                <th className="p-3 text-center">التاريخ</th>
                                <th className="p-3 text-center">الحالة</th>
                                <th className="p-3 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRequests.map((req, idx) => {
                                const sub = subjects.find(s => s.id === req.classSubjectId);
                                const lecturer = allLecturers.find(l => l.id === req.lecturerId);
                                const isLoading = actionLoadingId === req.id;

                                return (
                                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3 text-center text-slate-400 font-mono tabular-nums">{idx + 1}</td>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-900">{lecturer?.name || req.lecturerId}</div>
                                            <div className="text-[10px] text-slate-400 font-mono tabular-nums">{req.lecturerId}</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold text-[#064E3B]">{sub?.subjectName || req.classSubjectId}</div>
                                            <div className="text-[10px] text-slate-500">{sub?.className || '—'}</div>
                                            {req.notes && <div className="text-[10px] text-amber-800 mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded inline-block">{req.notes}</div>}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                                                req.isRemidi ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {req.isRemidi ? 'التكميلي' : (req.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني')}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center text-slate-500 text-[11px] tabular-nums">
                                            {new Date(req.requestedAt).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold inline-flex items-center gap-1 ${
                                                req.status === 'PENDING' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                                req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                                req.status === 'REJECTED' ? 'bg-red-50 text-red-800 border border-red-200' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {req.status === 'PENDING' ? 'قيد المراجعة' :
                                                 req.status === 'APPROVED' ? 'مقبول' :
                                                 req.status === 'REJECTED' ? 'مرفوض' :
                                                 'مكتمل'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {req.status === 'PENDING' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleApprove(req)}
                                                            disabled={isLoading}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-extrabold text-[11px] transition-all disabled:opacity-50"
                                                        >
                                                            قبول
                                                        </button>
                                                        <button 
                                                            onClick={() => handleReject(req)}
                                                            disabled={isLoading}
                                                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg font-extrabold text-[11px] transition-all disabled:opacity-50"
                                                        >
                                                            رفض
                                                        </button>
                                                    </>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteRequest(req)}
                                                    disabled={isLoading}
                                                    className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-slate-200/80"
                                                    title="حذف"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredRequests.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 font-bold text-xs">
                                        لا توجد طلبات تعديل في هذا القسم
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ... (Rest of the file remains unchanged: RecapManager, KhsManager) ...
// Ensuring the rest of the file is included correctly.

const RecapManager = ({ yearId, years, isFemaleAdmin }: { yearId: string, years?: AcademicYear[], isFemaleAdmin?: boolean }) => {
    const [recapType, setRecapType] = useState<'REGULAR' | 'REMIDI'>('REGULAR');
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [recapData, setRecapData] = useState<{ subjects: MasterSubject[], rows: ClassRecapRow[] } | null>(null);
    const [remidiRecapData, setRemidiRecapData] = useState<{ subjects: MasterSubject[], rows: ClassRemidiRecapRow[] } | null>(null);
    const [onlyRemidiStudents, setOnlyRemidiStudents] = useState(false);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'SEM1' | 'SEM2' | 'COMBINED'>('SEM1');
    const [exportingExcel, setExportingExcel] = useState(false);

    useEffect(() => {
        if(yearId) {
            getClassesByYear(yearId).then(clsList => {
                setClasses(isFemaleAdmin ? clsList.filter(c => c.gender === 'FEMALE') : clsList);
            });
            setSelectedClassId('');
            setRecapData(null);
            setRemidiRecapData(null);
        }
    }, [yearId, isFemaleAdmin]);

    useEffect(() => {
        if(selectedClassId && yearId) {
            setLoading(true);
            if (recapType === 'REGULAR') {
                getClassRecap(selectedClassId).then(data => {
                    setRecapData(data);
                    setLoading(false);
                });
            } else {
                getClassRemidiRecap(selectedClassId, yearId).then(data => {
                    setRemidiRecapData(data);
                    setLoading(false);
                });
            }
        }
    }, [selectedClassId, recapType, yearId]);

    const currentClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
    const className = currentClass ? `${currentClass.name} (${currentClass.gender === 'MALE' ? 'بنين' : 'بنات'})` : "الفصل الدراسي";
    const currentYearName = years?.find(y => y.id === yearId)?.name || "العام الدراسي";
    const modeLabel = viewMode === 'COMBINED' ? 'شامل (الفصل الأول + الثاني)' : (viewMode === 'SEM1' ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني');

    // Filter remidi rows if onlyRemidiStudents is active
    const displayedRemidiRows = useMemo(() => {
        if (!remidiRecapData) return [];
        if (onlyRemidiStudents) {
            return remidiRecapData.rows.filter(r => r.hasRemidi);
        }
        return remidiRecapData.rows;
    }, [remidiRecapData, onlyRemidiStudents]);

    const remidiStudentCount = useMemo(() => {
        if (!remidiRecapData) return 0;
        return remidiRecapData.rows.filter(r => r.hasRemidi).length;
    }, [remidiRecapData]);

    // --- EXCEL EXPORT (ExcelJS with RTL & soft color fills) ---
    const handleExportExcel = async () => {
        if (!selectedClassId) return;
        if (recapType === 'REGULAR' && !recapData) return;
        if (recapType === 'REMIDI' && !remidiRecapData) return;

        setExportingExcel(true);
        try {
            const currentDate = new Date().toLocaleDateString('ar-EG');
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "جامعة الإمام الشافعي";
            workbook.created = new Date();

            workbook.views = [
                {
                    x: 0,
                    y: 0,
                    width: 10000,
                    height: 20000,
                    firstSheet: 0,
                    activeTab: 0,
                    visibility: 'visible'
                }
            ];

            const sheetName = recapType === 'REMIDI' ? "كشف درجات التكميلي الأصلية" : "كشف الدرجات";
            const worksheet = workbook.addWorksheet(sheetName);
            worksheet.views = [
                {
                    state: 'normal',
                    rightToLeft: true,
                    tabSelected: true,
                    activeCell: 'A1'
                }
            ];

            const activeSubjects = recapType === 'REMIDI' ? remidiRecapData!.subjects : recapData!.subjects;
            const activeRows = recapType === 'REMIDI' ? displayedRemidiRows : recapData!.rows;

            // Determine total columns
            let totalCols = 0;
            if (viewMode === 'COMBINED') {
                totalCols = 3 + (activeSubjects.length * 3) + 2;
            } else {
                totalCols = 3 + activeSubjects.length + 2;
            }

            // Row 1: Main Title
            worksheet.mergeCells(1, 1, 1, totalCols);
            const titleRow = worksheet.getRow(1);
            titleRow.height = 36;
            const titleCell = worksheet.getCell(1, 1);
            titleCell.value = recapType === 'REMIDI' 
                ? "جامعة الإمام الشافعي - كشف درجات الاختبار التكميلي (الدرجات الأصلية المعتمدة)"
                : "جامعة الإمام الشافعي - كشف درجات الطلاب العام";
            titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };

            // Row 2: Subtitle / Metadata
            worksheet.mergeCells(2, 1, 2, totalCols);
            const metaRow = worksheet.getRow(2);
            metaRow.height = 26;
            const metaCell = worksheet.getCell(2, 1);
            metaCell.value = `الفصل: ${className}   |   العام الجامعي: ${currentYearName}   |   نوع التقرير: ${modeLabel}${recapType === 'REMIDI' ? ' (درجات أصلية)' : ''}   |   تاريخ الاستخراج: ${currentDate}`;
            metaCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF064E3B' } };
            metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
            metaCell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };

            // Row 3: Spacer / Explanatory Note for Remidi
            worksheet.getRow(3).height = recapType === 'REMIDI' ? 20 : 10;
            if (recapType === 'REMIDI') {
                worksheet.mergeCells(3, 1, 3, totalCols);
                const noteCell = worksheet.getCell(3, 1);
                noteCell.value = "* تنبيه: يتضمن هذا الكشف الدرجات الأصلية الكاملة المرصودة في الاختبار التكميلي لأغراض الأرشفة والتقييم الداخلي.";
                noteCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF047857' } };
                noteCell.alignment = { vertical: 'middle', horizontal: 'right', readingOrder: 'rtl' };
            }

            const cellBorder: Partial<ExcelJS.Borders> = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };

            let startDataRow = 5;

            if (viewMode === 'COMBINED') {
                const r4 = worksheet.getRow(4);
                const r5 = worksheet.getRow(5);
                r4.height = 28;
                r5.height = 24;

                worksheet.mergeCells(4, 1, 5, 1);
                worksheet.getCell(4, 1).value = "م";
                worksheet.mergeCells(4, 2, 5, 2);
                worksheet.getCell(4, 2).value = "رقم القيد";
                worksheet.mergeCells(4, 3, 5, 3);
                worksheet.getCell(4, 3).value = "اسم الطالب";

                let colIdx = 4;
                activeSubjects.forEach(s => {
                    worksheet.mergeCells(4, colIdx, 4, colIdx + 2);
                    worksheet.getCell(4, colIdx).value = s.name;
                    worksheet.getCell(5, colIdx).value = "ف1";
                    worksheet.getCell(5, colIdx + 1).value = "ف2";
                    worksheet.getCell(5, colIdx + 2).value = "المعدل";
                    colIdx += 3;
                });

                worksheet.mergeCells(4, colIdx, 4, colIdx + 1);
                worksheet.getCell(4, colIdx).value = "النتيجة النهائية";
                worksheet.getCell(5, colIdx).value = "المجموع";
                worksheet.getCell(5, colIdx + 1).value = "المعدل";

                for (let r = 4; r <= 5; r++) {
                    for (let c = 1; c <= totalCols; c++) {
                        const cell = worksheet.getCell(r, c);
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 4 ? 'FF064E3B' : 'FF047857' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, readingOrder: 'rtl' };
                        cell.border = cellBorder;
                    }
                }
                startDataRow = 6;
            } else {
                const r4 = worksheet.getRow(4);
                r4.height = 30;
                const headers = ["م", "رقم القيد", "اسم الطالب", ...activeSubjects.map(s => s.name), "المجموع", "النسبة / المعدل"];
                headers.forEach((h, idx) => {
                    const cell = worksheet.getCell(4, idx + 1);
                    cell.value = h;
                    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, readingOrder: 'rtl' };
                    cell.border = cellBorder;
                });
                startDataRow = 5;
            }

            // Populate Rows
            activeRows.forEach((row, rowIdx) => {
                const currentRowNum = startDataRow + rowIdx;
                const excelRow = worksheet.getRow(currentRowNum);
                excelRow.height = 24;

                let rowSum = 0;
                let count = 0;
                let hasFailingScore = false;

                if (viewMode === 'COMBINED') {
                    activeSubjects.forEach(s => {
                        const g = row.grades[s.id];
                        if (g) {
                            rowSum += g.avg;
                            count++;
                            if (g.sem1 < 60 || g.sem2 < 60 || g.avg < 60) {
                                hasFailingScore = true;
                            }
                        }
                    });
                } else {
                    activeSubjects.forEach(s => {
                        const g = row.grades[s.id];
                        const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
                        if (g) {
                            rowSum += val;
                            count++;
                            if (val < 60) {
                                hasFailingScore = true;
                            }
                        }
                    });
                }
                const rowFinalAvg = count > 0 ? rowSum / count : 0;
                if (rowFinalAvg < 60) {
                    hasFailingScore = true;
                }

                // Col 1: No
                const cNo = worksheet.getCell(currentRowNum, 1);
                cNo.value = rowIdx + 1;
                cNo.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                cNo.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
                cNo.border = cellBorder;

                // Col 2: Student ID
                const cId = worksheet.getCell(currentRowNum, 2);
                cId.value = row.student.id;
                cId.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                cId.font = { name: 'Calibri', size: 10, color: hasFailingScore ? { argb: 'FFDC2626' } : { argb: 'FF4B5563' } };
                cId.border = cellBorder;

                // Col 3: Student Name
                const cName = worksheet.getCell(currentRowNum, 3);
                cName.value = row.student.name;
                cName.alignment = { vertical: 'middle', horizontal: 'right', readingOrder: 'rtl' };
                cName.border = cellBorder;
                if (hasFailingScore) {
                    cName.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFDC2626' } };
                    cName.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
                } else {
                    cName.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF1F2937' } };
                }

                const remDetails = (row as ClassRemidiRecapRow).remidiDetails;

                let currentCol = 4;
                if (viewMode === 'COMBINED') {
                    activeSubjects.forEach(s => {
                        const g = row.grades[s.id];
                        const s1 = g ? g.sem1 : 0;
                        const s2 = g ? g.sem2 : 0;
                        const avg = g ? parseFloat(g.avg.toFixed(1)) : 0;
                        const subRem = remDetails ? remDetails[s.id] : undefined;

                        // sem1
                        const c1 = worksheet.getCell(currentRowNum, currentCol);
                        c1.value = g ? s1 : '-';
                        c1.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                        c1.border = cellBorder;
                        if (g && s1 < 60) {
                            c1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
                            c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        } else if (subRem?.isRemidiSem1) {
                            c1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
                            c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                        } else {
                            c1.font = { name: 'Calibri', size: 10, color: { argb: 'FF374151' } };
                        }

                        // sem2
                        const c2 = worksheet.getCell(currentRowNum, currentCol + 1);
                        c2.value = g ? s2 : '-';
                        c2.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                        c2.border = cellBorder;
                        if (g && s2 < 60) {
                            c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
                            c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        } else if (subRem?.isRemidiSem2) {
                            c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
                            c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                        } else {
                            c2.font = { name: 'Calibri', size: 10, color: { argb: 'FF374151' } };
                        }

                        // avg
                        const cAvg = worksheet.getCell(currentRowNum, currentCol + 2);
                        cAvg.value = g ? avg : '-';
                        cAvg.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                        cAvg.border = cellBorder;
                        if (g && avg < 60) {
                            cAvg.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
                            cAvg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        } else {
                            cAvg.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F2937' } };
                            cAvg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                        }

                        currentCol += 3;
                    });

                    // Total Sum
                    const cSum = worksheet.getCell(currentRowNum, currentCol);
                    cSum.value = parseFloat(rowSum.toFixed(1));
                    cSum.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                    cSum.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF064E3B' } };
                    cSum.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
                    cSum.border = cellBorder;

                    // Final Avg
                    const cFinalAvg = worksheet.getCell(currentRowNum, currentCol + 1);
                    cFinalAvg.value = parseFloat(rowFinalAvg.toFixed(2));
                    cFinalAvg.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                    cFinalAvg.border = cellBorder;
                    if (rowFinalAvg < 60) {
                        cFinalAvg.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
                        cFinalAvg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    } else {
                        cFinalAvg.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF064E3B' } };
                        cFinalAvg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
                    }
                } else {
                    activeSubjects.forEach(s => {
                        const g = row.grades[s.id];
                        const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
                        const subRem = remDetails ? remDetails[s.id] : undefined;
                        const isRem = viewMode === 'SEM1' ? subRem?.isRemidiSem1 : subRem?.isRemidiSem2;

                        const cScore = worksheet.getCell(currentRowNum, currentCol);
                        cScore.value = g ? val : '-';
                        cScore.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                        cScore.border = cellBorder;
                        if (g && val < 60) {
                            cScore.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
                            cScore.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        } else if (isRem) {
                            cScore.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
                            cScore.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                        } else {
                            cScore.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
                        }
                        currentCol++;
                    });

                    // Sum
                    const cSum = worksheet.getCell(currentRowNum, currentCol);
                    cSum.value = rowSum;
                    cSum.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                    cSum.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF064E3B' } };
                    cSum.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
                    cSum.border = cellBorder;

                    // Final Avg
                    const cAvg = worksheet.getCell(currentRowNum, currentCol + 1);
                    cAvg.value = parseFloat(rowFinalAvg.toFixed(2));
                    cAvg.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' };
                    cAvg.border = cellBorder;
                    if (rowFinalAvg < 60) {
                        cAvg.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
                        cAvg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    } else {
                        cAvg.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF064E3B' } };
                        cAvg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
                    }
                }
            });

            // Column widths
            worksheet.getColumn(1).width = 6;
            worksheet.getColumn(2).width = 14;
            worksheet.getColumn(3).width = 28;
            for (let c = 4; c <= totalCols; c++) {
                worksheet.getColumn(c).width = 11;
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const prefix = recapType === 'REMIDI' ? 'كشف_درجات_التكميلي_الأصلية' : 'كشف_درجات';
            a.download = `${prefix}_${className.replace(/\s+/g, '_')}_${viewMode}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSuccess('تم تصدير ملف Excel بنجاح');
        } catch (err: any) {
            console.error('Export Excel error:', err);
            showError('فشل تصدير ملف Excel');
        } finally {
            setExportingExcel(false);
        }
    };

    const hasData = recapType === 'REGULAR' ? Boolean(recapData) : Boolean(remidiRecapData);
    const activeSubjects = recapType === 'REMIDI' ? (remidiRecapData?.subjects || []) : (recapData?.subjects || []);
    const activeRows = recapType === 'REMIDI' ? displayedRemidiRows : (recapData?.rows || []);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Top Card: Mode Selector & Filters */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col gap-4 sm:gap-5 relative overflow-hidden">
                {/* Sub-tabs: Regular vs Remidi */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 border-b border-gray-100 pb-4 relative z-10">
                    <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-[#064E3B] flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <span>{recapType === 'REGULAR' ? 'كشف الدرجات العام' : 'كشف درجات التكميلي (الأصلية)'}</span>
                        </h3>
                        <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                            {recapType === 'REGULAR' 
                                ? 'عرض وتصدير درجات الطلاب المعتمدة في الفصول الدراسية' 
                                : 'سجل الدرجات الأصلية في الاختبار التكميلي للإدارة (قبل تطبيق سقف 60)'}
                        </p>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto border border-gray-200">
                        <button
                            onClick={() => setRecapType('REGULAR')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                                recapType === 'REGULAR'
                                    ? 'bg-[#064E3B] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span>الكشف العام</span>
                        </button>
                        <button
                            onClick={() => setRecapType('REMIDI')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                                recapType === 'REMIDI'
                                    ? 'bg-[#064E3B] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            <span>كشف التكميلي</span>
                        </button>
                    </div>
                </div>

                {/* Remidi Notice Banner */}
                {recapType === 'REMIDI' && (
                    <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-xl flex items-start gap-3 text-xs text-emerald-900 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </div>
                        <div className="flex-1">
                            <span className="font-extrabold block mb-0.5">سجل الدرجات الأصلية للإدارة:</span>
                            <span className="opacity-90 leading-relaxed">
                                يعرض هذا الكشف الدرجة الأصلية المدخلة في الاختبار التكميلي لأغراض الأرشفة، بينما تظهر الدرجة في حساب الطالب عند النشر بحد أقصى (60) وفق اللائحة.
                            </span>
                        </div>
                    </div>
                )}

                {/* Filter Controls Row */}
                <div className="flex flex-col md:flex-row gap-3.5 items-end justify-between relative z-10">
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-end">
                        {/* Class Select */}
                        <div className="w-full sm:w-64">
                            <label className="block text-[11px] font-bold text-gray-500 mb-1.5 mr-1">الفصل الدراسي</label>
                            <div className="relative">
                                <select 
                                    value={selectedClassId} 
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold text-gray-700 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none shadow-sm cursor-pointer"
                                >
                                    <option value="">-- اختر الفصل --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.gender === 'MALE' ? 'بنين' : 'بنات'})</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-gray-400">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* View Mode Select */}
                        <div className="w-full sm:w-48">
                            <label className="block text-[11px] font-bold text-gray-500 mb-1.5 mr-1">نوع العرض</label>
                            <div className="relative">
                                <select 
                                    value={viewMode} 
                                    onChange={e => setViewMode(e.target.value as any)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold text-gray-700 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none shadow-sm cursor-pointer"
                                >
                                    <option value="SEM1">الفصل الأول</option>
                                    <option value="SEM2">الفصل الثاني</option>
                                    <option value="COMBINED">شامل (ف1 + ف2)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-gray-400">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Remidi Only Toggle Filter */}
                        {recapType === 'REMIDI' && remidiRecapData && (
                            <div className="w-full sm:w-auto pb-0.5">
                                <label className="inline-flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3.5 py-2.5 rounded-xl transition-colors w-full sm:w-auto">
                                    <input 
                                        type="checkbox" 
                                        checked={onlyRemidiStudents} 
                                        onChange={e => setOnlyRemidiStudents(e.target.checked)}
                                        className="rounded text-[#064E3B] focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
                                        طلاب التكميلي فقط (<span className="tabular-nums">{remidiStudentCount}</span>)
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Export Button */}
                    {hasData && (
                        <button 
                            onClick={handleExportExcel} 
                            disabled={exportingExcel}
                            className="w-full md:w-auto bg-[#064E3B] hover:bg-emerald-900 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                            title="تصدير كشف الدرجات المنسق"
                        >
                            {exportingExcel ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>جاري التصدير...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    <span>تصدير الكشف {recapType === 'REMIDI' ? '(التكميلي)' : ''}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Table Area */}
            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4 bg-white rounded-2xl border border-gray-200/80">
                    <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-bold text-xs">جاري تحميل بيانات الكشف...</p>
                </div>
            ) : hasData ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
                    {/* Header stats bar */}
                    <div className="p-3.5 sm:p-4 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-gray-800">{className}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500 font-bold">{modeLabel}</span>
                            {recapType === 'REMIDI' && (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                                    كشف التكميلي الأصلي
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 font-bold text-[11px]">
                            <span>إجمالي الطلاب: <strong className="text-gray-900 tabular-nums">{activeRows.length}</strong></span>
                            {recapType === 'REMIDI' && (
                                <>
                                    <span>•</span>
                                    <span>طلاب التكميلي: <strong className="text-emerald-700 tabular-nums">{remidiStudentCount}</strong></span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[620px] custom-scrollbar">
                        <table className="w-full text-xs text-center relative border-collapse">
                            <thead className="bg-white text-gray-500 font-bold sticky top-0 z-20 shadow-sm">
                                {viewMode === 'COMBINED' ? (
                                    <>
                                        <tr>
                                            <th rowSpan={2} className="p-2.5 sm:p-3 text-right bg-white min-w-[135px] sm:min-w-[180px] sticky right-0 z-30 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                اسم الطالب
                                            </th>
                                            {activeSubjects.map((s, sIdx) => (
                                                <th key={`${s.id}_${sIdx}`} colSpan={3} className="p-2 text-center bg-gray-50/40 border-b border-gray-100 border-l border-gray-50">
                                                    <div className="truncate w-24 mx-auto text-emerald-950 font-bold text-[10px]" title={s.name}>{s.name}</div>
                                                </th>
                                            ))}
                                            <th colSpan={2} className="p-2 bg-emerald-50/50 text-emerald-900 border-b border-emerald-100">النتيجة النهائية</th>
                                        </tr>
                                        <tr>
                                            {activeSubjects.map((s, sIdx) => (
                                                <React.Fragment key={`${s.id}_sub_${sIdx}`}>
                                                    <th className="p-1 text-[9px] bg-gray-50/30 min-w-[34px] text-gray-400 border-l border-gray-50">ف1</th>
                                                    <th className="p-1 text-[9px] bg-gray-50/30 min-w-[34px] text-gray-400 border-l border-gray-50">ف2</th>
                                                    <th className="p-1 text-[9px] bg-gray-100/50 min-w-[42px] font-extrabold text-gray-700 border-l border-gray-100">معدل</th>
                                                </React.Fragment>
                                            ))}
                                            <th className="p-1 text-[9px] bg-emerald-50/30 text-emerald-800 font-bold border-l border-emerald-100">المجموع</th>
                                            <th className="p-1 text-[9px] bg-emerald-100/50 text-emerald-900 font-extrabold border-l border-emerald-100">المعدل</th>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <th className="p-2.5 sm:p-3 text-right bg-white z-10 min-w-[135px] sm:min-w-[180px] sticky right-0 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            اسم الطالب
                                        </th>
                                        {activeSubjects.map((s, sIdx) => (
                                            <th key={`${s.id}_${sIdx}`} className="p-2.5 sm:p-3 min-w-[100px] sm:min-w-[110px] border-b border-gray-100 border-l border-gray-50">
                                                <div className="truncate w-24 sm:w-28 mx-auto text-gray-800 text-[10px] font-bold" title={s.name}>{s.name}</div>
                                            </th>
                                        ))}
                                        <th className="p-2.5 sm:p-3 bg-emerald-50/50 text-emerald-800 min-w-[65px] border-b border-emerald-100">المجموع</th>
                                        <th className="p-2.5 sm:p-3 bg-emerald-100/50 text-emerald-900 min-w-[65px] border-b border-emerald-100">النسبة</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50 bg-white">
                                {activeRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={viewMode === 'COMBINED' ? activeSubjects.length * 3 + 3 : activeSubjects.length + 3} className="py-12 text-center text-gray-400 font-bold">
                                            لا توجد بيانات مطابقة
                                        </td>
                                    </tr>
                                ) : activeRows.map((row, idx) => {
                                    let rowSum = 0;
                                    let count = 0;
                                    let hasFailingScore = false;

                                    if (viewMode === 'COMBINED') {
                                        activeSubjects.forEach(s => {
                                            const g = row.grades[s.id];
                                            if(g) { 
                                                rowSum += g.avg; 
                                                count++;
                                                if (g.sem1 < 60 || g.sem2 < 60 || g.avg < 60) {
                                                    hasFailingScore = true;
                                                }
                                            }
                                        });
                                    } else {
                                        activeSubjects.forEach(s => {
                                            const g = row.grades[s.id];
                                            const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
                                            if(g) { 
                                                rowSum += val; 
                                                count++;
                                                if (val < 60) {
                                                    hasFailingScore = true;
                                                }
                                            }
                                        });
                                    }
                                    const rowFinalAvg = count > 0 ? rowSum / count : 0;
                                    if (rowFinalAvg < 60) {
                                        hasFailingScore = true;
                                    }

                                    const remDetails = (row as ClassRemidiRecapRow).remidiDetails;
                                    const isRemidiStudent = (row as ClassRemidiRecapRow).hasRemidi;

                                    return (
                                        <tr key={row.student.id} className="hover:bg-gray-50/80 transition-colors">
                                            {/* Student name */}
                                            <td className={`p-2 sm:p-2.5 text-right sticky right-0 bg-white z-10 font-bold border-l border-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] ${hasFailingScore ? 'text-red-600 bg-red-50/20' : 'text-gray-800'}`}>
                                                <div className="flex items-center gap-1.5 sm:gap-2">
                                                    <span className="text-[9px] font-normal text-gray-300 w-3.5 sm:w-4 tabular-nums">{idx + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-[11px] truncate w-24 sm:w-36 ${hasFailingScore ? 'text-red-600 font-extrabold' : 'text-gray-800'}`}>
                                                            {row.student.name}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className={`text-[9px] font-mono tabular-nums font-normal ${hasFailingScore ? 'text-red-400' : 'text-gray-400'}`}>
                                                                {row.student.id}
                                                            </span>
                                                            {isRemidiStudent && (
                                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] px-1 py-0.2 rounded font-bold">
                                                                    تكميلي
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {hasFailingScore && (
                                                        <span className="hidden sm:inline-block bg-red-50 text-red-600 border border-red-200 text-[8px] px-1 py-0.5 rounded font-bold shrink-0">
                                                            دون 60
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Subjects */}
                                            {activeSubjects.map((s, sIdx) => {
                                                const g = row.grades[s.id];
                                                const subRem = remDetails ? remDetails[s.id] : undefined;

                                                if (viewMode === 'COMBINED') {
                                                    const s1 = g?.sem1 || 0;
                                                    const s2 = g?.sem2 || 0;
                                                    const avg = g?.avg || 0;

                                                    return (
                                                        <React.Fragment key={`${s.id}_${sIdx}`}>
                                                            {/* Sem 1 */}
                                                            <td className={`p-1 text-[10px] border-l border-gray-50 tabular-nums ${
                                                                g && s1 < 60 ? 'text-red-600 font-bold bg-red-50/60' : 
                                                                subRem?.isRemidiSem1 ? 'text-emerald-800 font-extrabold bg-emerald-50/60' : 'text-gray-600'
                                                            }`}>
                                                                {g ? (
                                                                    <div className="flex flex-col items-center" title={subRem?.isRemidiSem1 ? `درجة تكميلي أصلية: ${s1} (السابقة: ${subRem.initialSem1})` : undefined}>
                                                                        <span>{s1}</span>
                                                                        {subRem?.isRemidiSem1 && (
                                                                            <span className="text-[7px] text-emerald-600 font-bold scale-90">تكميلي</span>
                                                                        )}
                                                                    </div>
                                                                ) : '-'}
                                                            </td>

                                                            {/* Sem 2 */}
                                                            <td className={`p-1 text-[10px] border-l border-gray-50 tabular-nums ${
                                                                g && s2 < 60 ? 'text-red-600 font-bold bg-red-50/60' : 
                                                                subRem?.isRemidiSem2 ? 'text-emerald-800 font-extrabold bg-emerald-50/60' : 'text-gray-600'
                                                            }`}>
                                                                {g ? (
                                                                    <div className="flex flex-col items-center" title={subRem?.isRemidiSem2 ? `درجة تكميلي أصلية: ${s2} (السابقة: ${subRem.initialSem2})` : undefined}>
                                                                        <span>{s2}</span>
                                                                        {subRem?.isRemidiSem2 && (
                                                                            <span className="text-[7px] text-emerald-600 font-bold scale-90">تكميلي</span>
                                                                        )}
                                                                    </div>
                                                                ) : '-'}
                                                            </td>

                                                            {/* Avg */}
                                                            <td className={`p-1 border-l border-gray-100 font-bold text-[10px] tabular-nums ${
                                                                g && avg < 60 ? 'text-red-600 bg-red-100/50' : 'bg-gray-50/30 text-gray-800'
                                                            }`}>
                                                                {g ? avg.toFixed(1) : '-'}
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                } else {
                                                    const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
                                                    const isRem = viewMode === 'SEM1' ? subRem?.isRemidiSem1 : subRem?.isRemidiSem2;
                                                    const initialVal = viewMode === 'SEM1' ? subRem?.initialSem1 : subRem?.initialSem2;

                                                    return (
                                                        <td key={`${s.id}_${sIdx}`} className="p-2 border-l border-gray-50 tabular-nums">
                                                            {g ? (
                                                                <div className="flex flex-col items-center" title={isRem ? `درجة تكميلي أصلية: ${val} (السابقة: ${initialVal})` : undefined}>
                                                                    <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                                                                        val < 60 ? 'bg-red-100 text-red-600' : 
                                                                        isRem ? 'bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-200' : 'text-gray-700'
                                                                    }`}>
                                                                        {val}
                                                                    </span>
                                                                    {isRem && (
                                                                        <span className="text-[8px] text-emerald-700 font-bold mt-0.5">
                                                                            أصلية (سابقاً: {initialVal})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : <span className="text-gray-300 text-[10px]">-</span>}
                                                        </td>
                                                    );
                                                }
                                            })}

                                            {/* Total */}
                                            <td className="p-1.5 bg-emerald-50/20 font-bold text-emerald-800 text-[10px] border-l border-emerald-50 tabular-nums">
                                                {viewMode === 'COMBINED' ? rowSum.toFixed(1) : rowSum}
                                            </td>

                                            {/* Final Avg */}
                                            <td className={`p-1.5 font-extrabold text-[10px] border-l border-emerald-100 tabular-nums ${rowFinalAvg < 60 ? 'bg-red-100 text-red-600' : 'bg-emerald-50/40 text-emerald-900'}`}>
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
                <div className="flex flex-col items-center justify-center py-24 text-gray-400 border border-dashed border-gray-300 rounded-2xl bg-gray-50/30">
                    <svg className="w-14 h-14 mb-3 opacity-30 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="font-bold text-sm text-gray-500">اختر الفصل الدراسي لعرض كشف الدرجات</p>
                </div>
            )}
        </div>
    );
};

interface KhsStudentEnrollmentItem {
    student: User;
    classObj: Class;
    enrollmentId: string;
    totalAcademicYearsCount: number;
    hasRepeatedClass: boolean;
}

const formatAcademicScore = (val: number | null | undefined, maxDecimals = 1): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const rounded = Number(val.toFixed(maxDecimals));
    return String(rounded).replace('.', ',');
};

const KhsManager = ({
    yearId,
    years,
    onYearChange,
    refreshKey,
    isFemaleAdmin
}: {
    yearId: string;
    years: AcademicYear[];
    onYearChange: (yrId: string) => void;
    refreshKey: number;
    isFemaleAdmin?: boolean;
}) => {
    // Mode tampilan: 'YEAR_KHS' (KHS berdasarkan Tahun Akademik & Kelas) atau 'HISTORY' (Riwayat Nilai Akademik Mahasiswa lintas tahun)
    const [activeView, setActiveView] = useState<'YEAR_KHS' | 'HISTORY'>('YEAR_KHS');
    const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
    const [classesInYear, setClassesInYear] = useState<Class[]>([]);
    const [enrolledItems, setEnrolledItems] = useState<KhsStudentEnrollmentItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');

    // Data untuk KHS Tahun Akademik yang dipilih
    const [yearGrades, setYearGrades] = useState<StudentGradeView[]>([]);
    const [loadingYearKhs, setLoadingYearKhs] = useState(false);

    // Data untuk Halaman Riwayat Nilai Akademik Mahasiswa (lintas seluruh tahun akademik)
    const [academicHistory, setAcademicHistory] = useState<StudentAcademicHistory | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showSemesterBreakdown, setShowSemesterBreakdown] = useState(false);

    // State Download PDF KHS
    const [downloadingPdf, setDownloadingPdf] = useState<'SEM1' | 'SEM2' | 'YEARLY' | null>(null);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);

    // Urutkan daftar tahun akademik
    const sortedYears = useMemo(() => {
        return [...years].sort((a, b) => compareAcademicYearsAsc(b, a));
    }, [years]);

    // 1. Muat daftar kelas ketika Tahun Akademik berubah
    useEffect(() => {
        if (!yearId) {
            setClassesInYear([]);
            return;
        }
        getClassesByYear(yearId).then(clsList => {
            const filtered = isFemaleAdmin ? clsList.filter(c => normalizeGender(c.gender) === 'FEMALE') : clsList;
            setClassesInYear(filtered);
            setSelectedClassId(prev => {
                if (prev === 'ALL') return 'ALL';
                return filtered.some(c => c.id === prev) ? prev : 'ALL';
            });
        });
    }, [yearId, refreshKey, isFemaleAdmin]);

    // 2. Muat daftar mahasiswa berdasarkan Tahun Akademik & Kelas yang dipilih
    useEffect(() => {
        if (!yearId) {
            setEnrolledItems([]);
            return;
        }
        const targetClassId = selectedClassId === 'ALL' ? undefined : selectedClassId;
        getKhsEnrolledStudents(yearId, targetClassId, isFemaleAdmin).then(items => {
            setEnrolledItems(items);
            if (items.length > 0) {
                setSelectedStudentId(prev => (items.some(i => i.student.id === prev) ? prev : items[0].student.id));
            } else {
                setSelectedStudentId('');
            }
        });
    }, [yearId, selectedClassId, refreshKey, isFemaleAdmin]);

    // Filter mahasiswa berdasarkan pencarian Nama atau NIM
    const filteredEnrolledItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return enrolledItems;
        return enrolledItems.filter(
            item =>
                item.student.name.toLowerCase().includes(term) ||
                item.student.id.toLowerCase().includes(term)
        );
    }, [enrolledItems, searchTerm]);

    // Mahasiswa yang sedang dipilih
    const selectedEnrolledItem = useMemo(() => {
        return enrolledItems.find(i => i.student.id === selectedStudentId) || null;
    }, [enrolledItems, selectedStudentId]);

    // 3. Muat data KHS khusus Tahun Akademik & Kelas yang dipilih + data Riwayat Akademik Lengkap
    useEffect(() => {
        if (!selectedStudentId || !yearId) {
            setYearGrades([]);
            setAcademicHistory(null);
            return;
        }

        let cancelled = false;
        setLoadingYearKhs(true);
        setLoadingHistory(true);

        const specificClassId = selectedEnrolledItem?.classObj.id || (selectedClassId !== 'ALL' ? selectedClassId : undefined);

        // Ambil nilai KHS murni untuk Tahun Akademik & Kelas yang sedang dipilih
        getStudentGrades(selectedStudentId, yearId, specificClassId).then(gradesData => {
            if (!cancelled) {
                setYearGrades(gradesData);
                setLoadingYearKhs(false);
            }
        });

        // Ambil seluruh Riwayat Nilai Akademik Mahasiswa lintas tahun akademik
        getStudentAcademicHistory(selectedStudentId).then(histData => {
            if (!cancelled) {
                setAcademicHistory(histData);
                setLoadingHistory(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [selectedStudentId, yearId, selectedEnrolledItem?.classObj.id, selectedClassId, refreshKey]);

    // Statistik KHS untuk Tahun Akademik yang dipilih (tidak menganggap nilai kosong sebagai 0)
    const yearKhsStats = useMemo(() => {
        const gradedSubjects = yearGrades.filter(g => g.hasGrade);
        const sem1Graded = yearGrades.filter(g => g.hasSem1);
        const sem2Graded = yearGrades.filter(g => g.hasSem2);

        const sem1Avg =
            sem1Graded.length > 0
                ? sem1Graded.reduce((acc, g) => acc + g.sem1_total, 0) / sem1Graded.length
                : null;
        const sem2Avg =
            sem2Graded.length > 0
                ? sem2Graded.reduce((acc, g) => acc + g.sem2_total, 0) / sem2Graded.length
                : null;

        // Hitung rata-rata per mata kuliah yang sudah memiliki nilai pada tahun akademik ini
        const subjectAvgs: number[] = gradedSubjects.map(g => {
            if (g.hasSem1 && g.hasSem2) return (g.sem1_total + g.sem2_total) / 2;
            if (g.hasSem1 && !g.hasSem2) return g.status === GradeStatus.PUBLISHED ? (g.sem1_total + g.sem2_total) / 2 : g.sem1_total;
            if (!g.hasSem1 && g.hasSem2) return g.status === GradeStatus.PUBLISHED ? (g.sem1_total + g.sem2_total) / 2 : g.sem2_total;
            return g.final_average;
        });

        const yearlyAvg =
            subjectAvgs.length > 0
                ? subjectAvgs.reduce((acc, v) => acc + v, 0) / subjectAvgs.length
                : null;

        return {
            totalSubjects: yearGrades.length,
            gradedCount: gradedSubjects.length,
            sem1Avg,
            sem2Avg,
            yearlyAvg,
            predicate: getAcademicPredicate(yearlyAvg)
        };
    }, [yearGrades]);

    // Handler Download PDF KHS Mahasiswa (untuk Tahun Akademik yang sedang dipilih)
    const handleDownloadStudentPdf = async (pdfType: 'SEM1' | 'SEM2' | 'YEARLY') => {
        setShowDownloadMenu(false);
        if (!selectedStudentId || !yearId) return;
        setDownloadingPdf(pdfType);
        try {
            const { base64, filename } = await generatePdf(selectedStudentId, pdfType, yearId);
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = filename || `KHS_${pdfType}_${selectedStudentId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showSuccess('تم تحميل كشف الدرجات (PDF) بنجاح');
        } catch (err: any) {
            showError(err?.message || 'فشل إنشاء ملف PDF من الخادم');
        } finally {
            setDownloadingPdf(null);
        }
    };

    // Handler Export Excel untuk Riwayat Nilai Akademik Mahasiswa
    const handleExportHistoryExcel = async () => {
        if (!academicHistory || academicHistory.subjectRows.length === 0) return;
        try {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Riwayat Nilai Akademik', {
                views: [{ rightToLeft: true }]
            });

            // Judul & Identitas Mahasiswa
            ws.addRow(['سجل التاريخ الأكاديمي الشامل للطالب (Riwayat Nilai Akademik Mahasiswa)']);
            ws.addRow(['اسم الطالب (Nama)', academicHistory.student.name]);
            ws.addRow(['الرقم الأكاديمي (NIM)', academicHistory.student.id]);
            ws.addRow(['إجمالي الأعوام الدراسية (Total Tahun Akademik)', academicHistory.totalAcademicYears]);
            ws.addRow([]);

            // Baris Header 1: No | Nama Mata Kuliah | Tahun Akademik ... | Rata-rata
            const headerRow1 = [
                'الرقم (No)',
                'المقرر الدراسي (Nama Mata Kuliah)',
                ...academicHistory.yearColumns.map(col => col.academicYearName),
                'المعدل (Rata-rata)'
            ];
            ws.addRow(headerRow1);

            // Baris Header 2: Keterangan Kelas & Status Mengulang
            const headerRow2 = [
                '',
                'الفصل الدراسي (Keterangan Kelas)',
                ...academicHistory.yearColumns.map(col =>
                    col.isRepeatedLater
                        ? `${col.className} (راسب - معيد للفصل / Tidak Lulus - Mengulang)`
                        : col.isRepeatAttempt
                        ? `${col.className} (سنة الإعادة / Mengulang)`
                        : col.className
                ),
                ''
            ];
            ws.addRow(headerRow2);

            // Baris Data Mata Kuliah
            academicHistory.subjectRows.forEach((row, idx) => {
                const rowVals: any[] = [
                    idx + 1,
                    row.subjectName,
                    ...academicHistory.yearColumns.map(col => {
                        const cell = row.cellsByEnrollmentId[col.enrollmentId];
                        if (!cell || !cell.enrolledInSubject || !cell.hasGrade || cell.finalScore === null) {
                            return '—';
                        }
                        const formatted = formatAcademicScore(cell.finalScore, 1);
                        return cell.isExcludedDueToRepeat ? `${formatted} (لا تُحسب - معيد)` : formatted;
                    }),
                    formatAcademicScore(row.averageScore, 1)
                ];
                ws.addRow(rowVals);
            });

            // Baris Paling Bawah: Rata-rata Keseluruhan
            const footerRow = [
                '',
                'المعدل العام لجميع المقررات (Rata-rata Keseluruhan)',
                ...academicHistory.yearColumns.map(col => formatAcademicScore(col.yearAverage, 1)),
                formatAcademicScore(academicHistory.overallAverage, 2)
            ];
            ws.addRow(footerRow);

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Riwayat_Akademik_${academicHistory.student.id}_${academicHistory.student.name}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSuccess('تم تصدير سجل التاريخ الأكاديمي بنجاح');
        } catch (e) {
            showError('فشل تصدير ملف Excel');
        }
    };

    const currentYearName = useMemo(() => {
        return years.find(y => y.id === yearId)?.name || yearId;
    }, [years, yearId]);

    // Hitung jumlah mahasiswa per kelas pada tahun akademik yang dipilih
    const classStudentCounts = useMemo(() => {
        const map: { [classId: string]: number } = {};
        enrolledItems.forEach(item => {
            map[item.classObj.id] = (map[item.classObj.id] || 0) + 1;
        });
        return map;
    }, [enrolledItems]);

    const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);

    // Navigasi Cepat Mahasiswa Sebelumnya / Berikutnya di dalam filter saat ini
    const currentStudentIndex = useMemo(() => {
        return filteredEnrolledItems.findIndex(i => i.student.id === selectedStudentId);
    }, [filteredEnrolledItems, selectedStudentId]);

    const handlePrevStudent = () => {
        if (currentStudentIndex > 0) {
            setSelectedStudentId(filteredEnrolledItems[currentStudentIndex - 1].student.id);
        }
    };

    const handleNextStudent = () => {
        if (currentStudentIndex >= 0 && currentStudentIndex < filteredEnrolledItems.length - 1) {
            setSelectedStudentId(filteredEnrolledItems[currentStudentIndex + 1].student.id);
        }
    };

    return (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-visible">
            {/* ===================================================================== */}
            {/* 1. COMPACT SINGLE-ROW FILTER & STUDENT COMMAND BAR                    */}
            {/* ===================================================================== */}
            <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200/80 rounded-t-2xl">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                    {/* Group 1: Tahun Akademik & Kelas (Side-by-side even on mobile) */}
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                        {/* Select Tahun Akademik */}
                        <div className="relative min-w-0 sm:w-44">
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#064E3B]">
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <select
                                value={yearId}
                                onChange={e => onYearChange(e.target.value)}
                                aria-label="العام الدراسي"
                                title="العام الدراسي"
                                className="w-full h-10 appearance-none bg-white hover:bg-slate-50 focus:bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl pr-9 pl-7 text-xs font-extrabold text-[#064E3B] outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-[#064E3B] transition-all cursor-pointer tabular-nums truncate"
                            >
                                {sortedYears.map(y => (
                                    <option key={y.id} value={y.id}>
                                        {y.name} {y.isActive ? '•' : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                        {/* Select Kelas */}
                        <div className="relative min-w-0 sm:w-48">
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <select
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                aria-label="الفصل الدراسي"
                                title="الفصل الدراسي"
                                className="w-full h-10 appearance-none bg-white hover:bg-slate-50 focus:bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl pr-9 pl-7 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-[#064E3B] transition-all cursor-pointer truncate"
                            >
                                <option value="ALL">كل الفصول ({enrolledItems.length})</option>
                                {classesInYear.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({classStudentCounts[c.id] || 0})
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Divider on Desktop */}
                    <div className="hidden lg:block w-px h-6 bg-slate-200/90 shrink-0" />

                    {/* Group 2: Student Searchable Picker + Prev/Next Icon Buttons */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 relative">
                        <div className="relative flex-1 min-w-0">
                            <button
                                type="button"
                                onClick={() => setStudentDropdownOpen(prev => !prev)}
                                className={`w-full h-10 px-3 rounded-xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                    studentDropdownOpen
                                        ? 'bg-white border-[#064E3B] ring-2 ring-emerald-500/15 shadow-sm'
                                        : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-slate-300'
                                }`}
                            >
                                {selectedEnrolledItem ? (
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <svg className="w-4 h-4 text-[#064E3B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                                            {selectedEnrolledItem.student.name}
                                        </span>
                                        <span className="font-mono tabular-nums text-[11px] font-bold text-[#064E3B] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 shrink-0">
                                            {selectedEnrolledItem.student.id}
                                        </span>
                                        <span className="hidden md:inline text-[11px] font-medium text-slate-400 truncate">
                                            · {selectedEnrolledItem.classObj.name}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <span>اختر طالباً...</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 shrink-0">
                                    {filteredEnrolledItems.length > 0 && (
                                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                                            {currentStudentIndex + 1}/{filteredEnrolledItems.length}
                                        </span>
                                    )}
                                    <svg
                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                            studentDropdownOpen ? 'rotate-180 text-[#064E3B]' : ''
                                        }`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {/* Floating Searchable Student Dropdown Popover */}
                            {studentDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-30"
                                        onClick={() => setStudentDropdownOpen(false)}
                                    />
                                    <div className="absolute right-0 left-0 top-11 z-40 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fade-in">
                                        <div className="p-2.5 bg-slate-50/90 border-b border-slate-100">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="بحث بالاسم أو الرقم الأكاديمي (NIM)..."
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                    className="w-full h-9 pl-8 pr-9 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-emerald-500/15 transition-all"
                                                />
                                                <svg
                                                    className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                {searchTerm && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSearchTerm('')}
                                                        className="absolute left-2.5 top-2 w-5 h-5 rounded-full text-slate-400 hover:text-red-600 flex items-center justify-center cursor-pointer"
                                                        title="مسح"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100/80 custom-scrollbar p-1.5">
                                            {filteredEnrolledItems.map(item => {
                                                const isSelected = selectedStudentId === item.student.id;
                                                return (
                                                    <button
                                                        key={item.student.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedStudentId(item.student.id);
                                                            setStudentDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-3 py-2 rounded-xl text-right transition-colors flex items-center justify-between gap-2.5 cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-emerald-50/90 text-[#064E3B]'
                                                                : 'hover:bg-slate-50 text-slate-800'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            <span
                                                                className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 ${
                                                                    isSelected
                                                                        ? 'bg-[#064E3B] text-white'
                                                                        : 'bg-slate-100 text-slate-600'
                                                                }`}
                                                            >
                                                                {item.student.name.charAt(0)}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-extrabold text-xs truncate">
                                                                        {item.student.name}
                                                                    </span>
                                                                    {item.hasRepeatedClass && (
                                                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70">
                                                                            معيد
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                                                    <span className="font-mono tabular-nums text-slate-600 font-bold">
                                                                        {item.student.id}
                                                                    </span>
                                                                    <span>·</span>
                                                                    <span className="truncate">{item.classObj.name}</span>
                                                                    <span>·</span>
                                                                    <span className="text-[#064E3B] font-bold tabular-nums">
                                                                        {item.totalAcademicYearsCount} أعوام
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isSelected && (
                                                            <svg className="w-4 h-4 text-[#064E3B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                );
                                            })}

                                            {filteredEnrolledItems.length === 0 && (
                                                <div className="py-6 text-center text-slate-400 text-xs font-bold">
                                                    لا يوجد طلاب مطابقون للبحث
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Icon-Only Prev / Next Navigation */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={handlePrevStudent}
                                disabled={currentStudentIndex <= 0}
                                className="w-10 h-10 rounded-xl bg-white hover:bg-emerald-50 text-slate-600 hover:text-[#064E3B] border border-slate-200/90 hover:border-emerald-300 flex items-center justify-center disabled:opacity-35 disabled:pointer-events-none transition-all cursor-pointer"
                                title="الطالب السابق"
                                aria-label="الطالب السابق"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={handleNextStudent}
                                disabled={currentStudentIndex < 0 || currentStudentIndex >= filteredEnrolledItems.length - 1}
                                className="w-10 h-10 rounded-xl bg-white hover:bg-emerald-50 text-slate-600 hover:text-[#064E3B] border border-slate-200/90 hover:border-emerald-300 flex items-center justify-center disabled:opacity-35 disabled:pointer-events-none transition-all cursor-pointer"
                                title="الطالب التالي"
                                aria-label="الطالب التالي"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===================================================================== */}
            {/* 2. STUDENT SUMMARY STRIP & ICON-FIRST ACTION BAR                      */}
            {/* ===================================================================== */}
            {!selectedEnrolledItem ? (
                <div className="py-16 px-4 text-center text-slate-400">
                    <svg className="w-10 h-10 mx-auto mb-2.5 opacity-25 text-[#064E3B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                    <p className="text-xs font-extrabold text-slate-500">
                        اختر طالباً لعرض السجل الأكاديمي
                    </p>
                </div>
            ) : (
                <div className="flex flex-col">
                    {/* Compact Student Identity + Mode Switcher + Icon Actions */}
                    <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        {/* Right: Student Avatar + Name + Compact Metadata Pills */}
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#064E3B] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                                {(academicHistory?.student.name || selectedEnrolledItem.student.name).charAt(0)}
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                                        {academicHistory?.student.name || selectedEnrolledItem.student.name}
                                    </h3>
                                    <span className="font-mono tabular-nums text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {academicHistory?.student.id || selectedEnrolledItem.student.id}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                    <span className="font-bold text-slate-700">
                                        {selectedEnrolledItem.classObj.name}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[#064E3B] font-extrabold tabular-nums" title="إجمالي الأعوام الدراسية بالجامعة">
                                        {academicHistory?.totalAcademicYears ?? selectedEnrolledItem.totalAcademicYearsCount}{' '}
                                        {(academicHistory?.totalAcademicYears ?? selectedEnrolledItem.totalAcademicYearsCount) === 1
                                            ? 'عام دراسي'
                                            : 'أعوام دراسية'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Left: Concise View Switcher + Icon-Only Actions */}
                        <div className="flex items-center gap-2 shrink-0 mr-auto sm:mr-0">
                            {/* Concise Segmented Switcher */}
                            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200/70">
                                <button
                                    type="button"
                                    onClick={() => setActiveView('YEAR_KHS')}
                                    className={`h-8 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                        activeView === 'YEAR_KHS'
                                            ? 'bg-[#064E3B] text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="كشف درجات العام الدراسي"
                                >
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>كشف العام</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveView('HISTORY')}
                                    className={`h-8 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                        activeView === 'HISTORY'
                                            ? 'bg-[#064E3B] text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="سجل التاريخ الأكاديمي الشامل"
                                >
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>السجل التراكمي</span>
                                </button>
                            </div>

                            {/* Icon-Only Contextual Actions */}
                            {activeView === 'YEAR_KHS' ? (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowDownloadMenu(prev => !prev)}
                                        disabled={downloadingPdf !== null || yearGrades.length === 0}
                                        className="w-9 h-9 rounded-xl bg-[#064E3B] text-white hover:bg-emerald-900 active:scale-95 transition-all shadow-sm disabled:opacity-40 flex items-center justify-center cursor-pointer"
                                        title="تحميل PDF"
                                        aria-label="تحميل PDF"
                                    >
                                        {downloadingPdf !== null ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        )}
                                    </button>

                                    {showDownloadMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-40 sm:bg-transparent sm:backdrop-blur-none"
                                                onClick={() => setShowDownloadMenu(false)}
                                            />
                                            <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl p-4 pb-6 shadow-2xl border-t border-slate-200 sm:absolute sm:bottom-auto sm:inset-x-auto sm:left-0 sm:top-11 sm:w-52 sm:rounded-xl sm:p-1.5 sm:shadow-xl sm:border animate-fade-in">
                                                <div className="px-2.5 py-1.5 border-b border-slate-100 text-[11px] font-extrabold text-slate-500">
                                                    تحميل PDF ({currentYearName})
                                                </div>
                                                <div className="mt-1 space-y-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadStudentPdf('SEM1')}
                                                        className="w-full px-2.5 py-2 rounded-lg text-right text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#064E3B] flex items-center justify-between cursor-pointer"
                                                    >
                                                        <span>الفصل الأول</span>
                                                        <span className="text-[10px] font-mono text-slate-400">ف 1</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadStudentPdf('SEM2')}
                                                        className="w-full px-2.5 py-2 rounded-lg text-right text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#064E3B] flex items-center justify-between cursor-pointer"
                                                    >
                                                        <span>الفصل الثاني</span>
                                                        <span className="text-[10px] font-mono text-slate-400">ف 2</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadStudentPdf('YEARLY')}
                                                        className="w-full px-2.5 py-2 rounded-lg text-right text-xs font-extrabold text-[#064E3B] bg-emerald-50/70 hover:bg-[#064E3B] hover:text-white flex items-center justify-between cursor-pointer"
                                                    >
                                                        <span>العام الكامل</span>
                                                        <span className="text-[10px] font-mono">1 + 2</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    {/* Icon Button: Toggle Semester Breakdown (ف1 / ف2) */}
                                    <button
                                        type="button"
                                        onClick={() => setShowSemesterBreakdown(prev => !prev)}
                                        className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                                            showSemesterBreakdown
                                                ? 'bg-emerald-50 text-[#064E3B] border-emerald-300'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                                        }`}
                                        title={showSemesterBreakdown ? 'إخفاء تفصيل (ف1 / ف2)' : 'إظهار تفصيل (ف1 / ف2)'}
                                        aria-label="تفصيل الفصول"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                                        </svg>
                                    </button>

                                    {/* Icon Button: Export Excel */}
                                    <button
                                        type="button"
                                        onClick={handleExportHistoryExcel}
                                        disabled={!academicHistory || academicHistory.subjectRows.length === 0}
                                        className="w-9 h-9 rounded-xl bg-[#064E3B] hover:bg-emerald-900 text-white transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 shadow-sm"
                                        title="تصدير Excel"
                                        aria-label="تصدير Excel"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ================================================================= */}
                    {/* 3. PROPORTIONAL, COMPACT, CLEAN DATA TABLES                       */}
                    {/* ================================================================= */}
                    {activeView === 'YEAR_KHS' ? (
                        loadingYearKhs ? (
                            <div className="py-14 flex flex-col items-center justify-center">
                                <div className="w-7 h-7 border-2 border-emerald-100 border-t-[#064E3B] rounded-full animate-spin mb-2"></div>
                                <p className="text-slate-400 text-xs font-bold">جاري التحميل...</p>
                            </div>
                        ) : yearGrades.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-right border-collapse">
                                    <thead className="bg-slate-50/90 text-slate-500 font-extrabold border-b border-slate-200/80 text-[11px]">
                                        <tr>
                                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                                            <th className="py-2.5 px-3.5">المقرر</th>
                                            <th className="py-2.5 px-3 hidden sm:table-cell">المحاضر</th>
                                            <th className="py-2.5 px-2.5 text-center w-16 sm:w-20">ف 1</th>
                                            <th className="py-2.5 px-2.5 text-center w-16 sm:w-20">ف 2</th>
                                            <th className="py-2.5 px-2.5 text-center w-20 sm:w-24 bg-emerald-50/50 text-[#064E3B]">المعدل</th>
                                            <th className="py-2.5 px-3 text-center w-24 sm:w-28">التقدير</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {yearGrades.map((g, idx) => {
                                            const hasAny = Boolean(g.hasSem1 || g.hasSem2);
                                            const rowAvg =
                                                g.hasSem1 && g.hasSem2
                                                    ? (g.sem1_total + g.sem2_total) / 2
                                                    : g.hasSem1 && !g.hasSem2
                                                    ? g.status === GradeStatus.PUBLISHED
                                                        ? (g.sem1_total + g.sem2_total) / 2
                                                        : g.sem1_total
                                                    : !g.hasSem1 && g.hasSem2
                                                    ? g.status === GradeStatus.PUBLISHED
                                                        ? (g.sem1_total + g.sem2_total) / 2
                                                        : g.sem2_total
                                                    : null;
                                            const pred = getAcademicPredicate(rowAvg);

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono tabular-nums text-[11px]">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="py-2.5 px-3.5">
                                                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                                            {g.subjectName}
                                                        </span>
                                                        <div className="sm:hidden text-[10px] text-slate-400 mt-0.5 truncate">
                                                            {g.lecturerName}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-500 text-xs font-medium hidden sm:table-cell truncate max-w-[180px]">
                                                        {g.lecturerName}
                                                    </td>
                                                    <td className="py-2.5 px-2.5 text-center tabular-nums font-bold">
                                                        {g.hasSem1 ? (
                                                            <span className={g.sem1_total < 60 ? 'text-red-600 font-extrabold' : 'text-slate-700'}>
                                                                {formatAcademicScore(g.sem1_total, 1)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-2.5 text-center tabular-nums font-bold">
                                                        {g.hasSem2 ? (
                                                            <span className={g.sem2_total < 60 ? 'text-red-600 font-extrabold' : 'text-slate-700'}>
                                                                {formatAcademicScore(g.sem2_total, 1)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-2.5 text-center bg-emerald-50/25 font-extrabold tabular-nums">
                                                        {hasAny && rowAvg !== null ? (
                                                            <span className={rowAvg < 60 ? 'text-red-600' : 'text-[#064E3B]'}>
                                                                {formatAcademicScore(rowAvg, 1)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center text-[11px] font-extrabold">
                                                        {hasAny && rowAvg !== null ? (
                                                            <span
                                                                className={`inline-block px-2 py-0.5 rounded-md ${
                                                                    rowAvg < 60
                                                                        ? 'bg-red-50 text-red-600 border border-red-200/60'
                                                                        : 'bg-emerald-50/80 text-[#064E3B] border border-emerald-200/60'
                                                                }`}
                                                            >
                                                                {pred}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 font-normal">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 border-t-2 border-slate-200 font-extrabold text-slate-900 text-xs">
                                            <td colSpan={2} className="py-3 px-3.5 text-right text-[#064E3B] sm:hidden">
                                                المعدل السنوي ({currentYearName})
                                            </td>
                                            <td colSpan={3} className="py-3 px-3.5 text-right text-[#064E3B] hidden sm:table-cell">
                                                المعدل السنوي ({currentYearName})
                                            </td>
                                            <td className="py-3 px-2.5 text-center tabular-nums text-slate-700">
                                                {formatAcademicScore(yearKhsStats.sem1Avg, 1)}
                                            </td>
                                            <td className="py-3 px-2.5 text-center tabular-nums text-slate-700">
                                                {formatAcademicScore(yearKhsStats.sem2Avg, 1)}
                                            </td>
                                            <td className="py-3 px-2.5 text-center tabular-nums text-sm text-[#064E3B] bg-emerald-100/60">
                                                {formatAcademicScore(yearKhsStats.yearlyAvg, 2)}
                                            </td>
                                            <td className="py-3 px-3 text-center text-xs text-[#064E3B]">
                                                {yearKhsStats.predicate}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="py-14 text-center text-slate-400 text-xs font-bold">
                                لا توجد مقررات مسجلة في عام {currentYearName}
                            </div>
                        )
                    ) : (
                        /* ============================================================= */
                        /* TABEL DINAMIS RIWAYAT NILAI AKADEMIK MAHASISWA                */
                        /* ============================================================= */
                        <div className="flex flex-col">
                            {academicHistory && academicHistory.repeatCount > 0 && (
                                <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-200/70 text-[11px] text-amber-900 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>
                                        العام الموسوم بـ <strong className="text-red-700">معيد</strong> سجل تاريخي فقط (مشطوب) ولا يدخل في المعدل.
                                    </span>
                                </div>
                            )}

                            {loadingHistory ? (
                                <div className="py-14 flex flex-col items-center justify-center">
                                    <div className="w-7 h-7 border-2 border-emerald-100 border-t-[#064E3B] rounded-full animate-spin mb-2"></div>
                                    <p className="text-slate-400 text-xs font-bold">جاري التحميل...</p>
                                </div>
                            ) : academicHistory && academicHistory.subjectRows.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-right border-collapse">
                                        <thead>
                                            {/* Row 1: # | المقرر | Academic Years | المعدل */}
                                            <tr className="bg-slate-50/90 text-slate-600 font-extrabold border-b border-slate-200/80 text-[11px]">
                                                <th
                                                    rowSpan={2}
                                                    className="py-2.5 px-2.5 w-10 text-center border-l border-slate-200/70 bg-slate-50"
                                                >
                                                    #
                                                </th>
                                                <th
                                                    rowSpan={2}
                                                    className="py-2.5 px-3.5 min-w-[140px] border-l border-slate-200/70 bg-slate-50"
                                                >
                                                    المقرر
                                                </th>

                                                {academicHistory.yearColumns.map(col => (
                                                    <th
                                                        key={col.enrollmentId}
                                                        className={`py-2 px-2.5 text-center min-w-[100px] border-l border-slate-200/70 tabular-nums ${
                                                            col.isRepeatedLater
                                                                ? 'bg-red-50/60 text-red-900'
                                                                : col.isRepeatAttempt
                                                                ? 'bg-emerald-50/50 text-[#064E3B]'
                                                                : 'bg-slate-50/90 text-slate-800'
                                                        }`}
                                                    >
                                                        <span className="text-xs font-extrabold">{col.academicYearName}</span>
                                                    </th>
                                                ))}

                                                <th
                                                    rowSpan={2}
                                                    className="py-2.5 px-3 text-center w-24 bg-emerald-50/60 text-[#064E3B]"
                                                >
                                                    المعدل
                                                </th>
                                            </tr>

                                            {/* Row 2: Class Name per Academic Year */}
                                            <tr className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                                                {academicHistory.yearColumns.map(col => (
                                                    <th
                                                        key={`${col.enrollmentId}_class`}
                                                        className={`py-1.5 px-2 text-center border-l border-slate-200/70 ${
                                                            col.isRepeatedLater
                                                                ? 'bg-red-50/30 text-red-800'
                                                                : col.isRepeatAttempt
                                                                ? 'bg-emerald-50/25 text-[#064E3B]'
                                                                : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-center gap-1 flex-wrap">
                                                            <span className="font-bold text-slate-700">{col.className}</span>
                                                            {col.isRepeatedLater && (
                                                                <span className="text-[9px] text-red-600 bg-red-100/70 px-1 rounded font-extrabold">
                                                                    معيد
                                                                </span>
                                                            )}
                                                            {!col.isRepeatedLater && col.isRepeatAttempt && (
                                                                <span className="text-[9px] text-emerald-700 bg-emerald-100/70 px-1 rounded font-extrabold">
                                                                    إعادة
                                                                </span>
                                                            )}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {academicHistory.subjectRows.map((row, idx) => (
                                                <tr key={row.subjectKey} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2.5 px-2.5 text-center text-slate-400 font-mono tabular-nums text-[11px] border-l border-slate-100">
                                                        {idx + 1}
                                                    </td>

                                                    <td className="py-2.5 px-3.5 font-extrabold text-slate-900 border-l border-slate-100">
                                                        <span className="text-xs sm:text-sm">{row.subjectName}</span>
                                                    </td>

                                                    {academicHistory.yearColumns.map(col => {
                                                        const cell = row.cellsByEnrollmentId[col.enrollmentId];
                                                        if (!cell || !cell.enrolledInSubject || !cell.hasGrade || cell.finalScore === null) {
                                                            return (
                                                                <td
                                                                    key={col.enrollmentId}
                                                                    className={`py-2.5 px-2.5 text-center border-l border-slate-100 text-slate-300 ${
                                                                        col.isRepeatedLater ? 'bg-red-50/10' : ''
                                                                    }`}
                                                                >
                                                                    —
                                                                </td>
                                                            );
                                                        }

                                                        const isLow = cell.finalScore < 60;

                                                        return (
                                                            <td
                                                                key={col.enrollmentId}
                                                                className={`py-2.5 px-2.5 text-center border-l border-slate-100 tabular-nums ${
                                                                    cell.isExcludedDueToRepeat
                                                                        ? 'bg-red-50/20'
                                                                        : col.isRepeatAttempt
                                                                        ? 'bg-emerald-50/10'
                                                                        : ''
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`font-extrabold ${
                                                                        cell.isExcludedDueToRepeat
                                                                            ? 'text-red-400 line-through'
                                                                            : isLow
                                                                            ? 'text-red-600'
                                                                            : 'text-slate-800'
                                                                    }`}
                                                                    title={
                                                                        cell.isExcludedDueToRepeat
                                                                            ? 'درجة العام السابق (لا تدخل في المعدل)'
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {formatAcademicScore(cell.finalScore, 1)}
                                                                </span>

                                                                {showSemesterBreakdown && (
                                                                    <div className="text-[9px] text-slate-400 tabular-nums mt-0.5">
                                                                        {formatAcademicScore(cell.sem1Score, 0)} · {formatAcademicScore(cell.sem2Score, 0)}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                    <td className="py-2.5 px-3 text-center bg-emerald-50/20 tabular-nums font-extrabold">
                                                        {row.averageScore !== null ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className={row.averageScore < 60 ? 'text-red-600' : 'text-[#064E3B]'}>
                                                                    {formatAcademicScore(row.averageScore, 1)}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400">
                                                                    ({row.predicate})
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                        <tfoot>
                                            <tr className="bg-slate-50 border-t-2 border-slate-200 font-extrabold text-slate-900 text-xs">
                                                <td
                                                    colSpan={2}
                                                    className="py-3 px-3.5 text-right border-l border-slate-200/80 text-[#064E3B]"
                                                >
                                                    المعدل العام
                                                </td>

                                                {academicHistory.yearColumns.map(col => (
                                                    <td
                                                        key={`${col.enrollmentId}_avg`}
                                                        className={`py-3 px-2.5 text-center border-l border-slate-200/70 tabular-nums ${
                                                            col.isRepeatedLater
                                                                ? 'text-red-400 line-through bg-red-50/20'
                                                                : 'text-slate-700'
                                                        }`}
                                                    >
                                                        {formatAcademicScore(col.yearAverage, 1)}
                                                    </td>
                                                ))}

                                                <td className="py-3 px-3 text-center bg-[#064E3B] text-white tabular-nums">
                                                    <span className="text-sm font-extrabold">
                                                        {formatAcademicScore(academicHistory.overallAverage, 2)}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-emerald-100 mr-1">
                                                        ({academicHistory.overallPredicate})
                                                    </span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-14 text-center text-slate-400 text-xs font-bold">
                                    لا توجد سجلات تاريخية لهذا الطالب
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// REMIDI / TAKMILI (الاختبار التكميلي) ADMIN MANAGER
// ============================================================================
const RemidiAdminManager = ({ yearId, refreshKey, isFemaleAdmin }: { yearId: string, refreshKey: number, isFemaleAdmin?: boolean }) => {
    const [semesterFilter, setSemesterFilter] = useState<'SEM1' | 'SEM2' | 'BOTH'>('BOTH');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedSubjectKey, setSelectedSubjectKey] = useState('');
    const [classes, setClasses] = useState<Class[]>([]);
    const [candidates, setCandidates] = useState<RemidiRecord[]>([]);
    const [settings, setSettings] = useState<RemidiSettings>({ academicYearId: yearId, isInputOpen: false, isPublished: false });
    
    // Checkbox draft state for approval
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isSavingApproval, setIsSavingApproval] = useState(false);

    const [togglingInput, setTogglingInput] = useState(false);
    const [togglingPublish, setTogglingPublish] = useState(false);
    const [scoreInputs, setScoreInputs] = useState<{ [id: string]: string }>({});
    const [savingScoreId, setSavingScoreId] = useState<string | null>(null);

    // Edit requests for Remidi
    const [editRequests, setEditRequests] = useState<GradeEditRequest[]>([]);
    const [allLecturers, setAllLecturers] = useState<User[]>([]);
    const [subjects, setSubjects] = useState<SubjectView[]>([]);
    const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'>('ALL');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Load classes and candidates
    useEffect(() => {
        if (!yearId) return;
        getClassesByYear(yearId).then(clsList => {
            const filtered = isFemaleAdmin ? clsList.filter(c => c.gender === 'FEMALE') : clsList;
            setClasses(filtered);
            if (filtered.length > 0 && (!selectedClassId || !filtered.some(c => c.id === selectedClassId))) {
                setSelectedClassId(filtered[0].id);
            }
        });
        loadData();
    }, [yearId, refreshKey, semesterFilter, isFemaleAdmin]);

    const loadData = async () => {
        if (!yearId) return;
        const records = syncAndGetRemidiCandidates(yearId, semesterFilter);
        const filteredRecords = isFemaleAdmin ? records.filter(r => r.gender === 'FEMALE') : records;
        setCandidates(filteredRecords);
        const s = getRemidiSettings(yearId);
        setSettings({ ...s });
        setScoreInputs({});

        const reqs = await getGradeEditRequests(yearId);
        let filteredReqs = reqs.filter(r => Boolean(r.isRemidi));
        if (isFemaleAdmin) {
            const classesInYear = await getClassesByYear(yearId);
            const femaleClassIds = classesInYear.filter(c => c.gender === 'FEMALE').map(c => c.id);
            const subs = await getSubjectsByYear(yearId);
            filteredReqs = filteredReqs.filter(r => {
                const sub = subs.find(s => s.id === r.classSubjectId);
                return femaleClassIds.includes(sub?.classId || '');
            });
        }
        setEditRequests(filteredReqs);

        const adminData = await getAdminData();
        setAllLecturers(adminData.lecturers);

        const subs = await getSubjectsByYear(yearId);
        setSubjects(subs);
    };

    const handleApprove = async (req: GradeEditRequest) => {
        const sub = subjects.find(s => s.id === req.classSubjectId);
        const lecturer = allLecturers.find(l => l.id === req.lecturerId);
        
        const confirmed = await confirmAction(
            'قبول طلب تعديل التكميلي؟',
            `هل توافق على منح المحاضر "${lecturer?.name || req.lecturerId}" إذن تعديل درجات التكميلي لمقرر "${sub?.subjectName || 'المقرر'}" (${sub?.className || ''})؟`,
            'قبول الطلب'
        );

        if (!confirmed) return;

        setActionLoadingId(req.id);
        try {
            await respondGradeEditRequest(req.id, 'APPROVED');
            showSuccess('تم قبول طلب التعديل');
            loadData();
        } catch (e: any) {
            showError(e.message || 'فشل قبول الطلب');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleReject = async (req: GradeEditRequest) => {
        const sub = subjects.find(s => s.id === req.classSubjectId);
        const confirmed = await confirmAction(
            'رفض طلب تعديل التكميلي؟',
            `هل أنت متأكد من رفض طلب تعديل درجات التكميلي لمقرر "${sub?.subjectName || 'المقرر'}"؟`,
            'رفض الطلب',
            true
        );

        if (!confirmed) return;

        setActionLoadingId(req.id);
        try {
            await respondGradeEditRequest(req.id, 'REJECTED');
            showSuccess('تم رفض الطلب');
            loadData();
        } catch (e: any) {
            showError(e.message || 'فشل رفض الطلب');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDeleteRequest = async (req: GradeEditRequest) => {
        const confirmed = await confirmDelete('حذف طلب التعديل؟', 'هل أنت متأكد من حذف هذا الطلب نهائياً؟');
        if (!confirmed) return;
        setActionLoadingId(req.id);
        try {
            await deleteGradeEditRequest(req.id);
            showSuccess('تم حذف الطلب');
            loadData();
        } catch (e: any) {
            showError(e.message || 'فشل حذف الطلب');
        } finally {
            setActionLoadingId(null);
        }
    };

    const pendingRemidiRequestsCount = editRequests.filter(r => r.status === 'PENDING').length;

    const filteredRemidiRequests = useMemo(() => {
        if (requestFilter === 'ALL') return editRequests;
        return editRequests.filter(r => r.status === requestFilter);
    }, [editRequests, requestFilter]);

    // Calculate count of failing students per class
    const classFailingCounts = useMemo(() => {
        const counts: { [classId: string]: number } = {};
        candidates.forEach(c => {
            counts[c.classId] = (counts[c.classId] || 0) + 1;
        });
        return counts;
    }, [candidates]);

    // Subjects in the selected class that have failing students
    const subjectsInSelectedClass = useMemo(() => {
        if (!selectedClassId) return [];

        const map = new Map<string, {
            classSubjectId: string;
            subjectName: string;
            subjectCode: string;
            lecturerName: string;
            semester: 1 | 2;
            totalStudents: number;
            eligibleCount: number;
        }>();

        candidates.forEach(c => {
            if (c.classId !== selectedClassId) return;
            const key = `${c.classSubjectId}_${c.semester}`;
            const existing = map.get(key);
            if (existing) {
                existing.totalStudents++;
                if (c.isEligible) existing.eligibleCount++;
            } else {
                map.set(key, {
                    classSubjectId: c.classSubjectId,
                    subjectName: c.subjectName,
                    subjectCode: c.subjectCode,
                    lecturerName: c.lecturerName,
                    semester: c.semester as 1 | 2,
                    totalStudents: 1,
                    eligibleCount: c.isEligible ? 1 : 0
                });
            }
        });

        return Array.from(map.values());
    }, [candidates, selectedClassId]);

    // Auto-select first subject in class when class changes or subjects update
    useEffect(() => {
        if (subjectsInSelectedClass.length > 0) {
            const exists = subjectsInSelectedClass.some(s => `${s.classSubjectId}_${s.semester}` === selectedSubjectKey);
            if (!exists) {
                setSelectedSubjectKey(`${subjectsInSelectedClass[0].classSubjectId}_${subjectsInSelectedClass[0].semester}`);
            }
        } else {
            setSelectedSubjectKey('');
        }
    }, [selectedClassId, subjectsInSelectedClass]);

    // Students in the selected subject
    const studentsInSelectedSubject = useMemo(() => {
        if (!selectedClassId || !selectedSubjectKey) return [];
        return candidates.filter(c => {
            if (c.classId !== selectedClassId) return false;
            if (`${c.classSubjectId}_${c.semester}` !== selectedSubjectKey) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchName = c.studentName.toLowerCase().includes(term);
                const matchId = c.studentId.includes(term);
                if (!matchName && !matchId) return false;
            }
            return true;
        });
    }, [candidates, selectedClassId, selectedSubjectKey, searchTerm]);

    // Initialize checkboxes for the currently selected subject with students who are already approved
    useEffect(() => {
        if (!selectedSubjectKey) {
            setSelectedStudentIds(new Set());
            return;
        }
        const currentList = candidates.filter(c => 
            c.classId === selectedClassId && 
            `${c.classSubjectId}_${c.semester}` === selectedSubjectKey
        );
        const initialEligible = new Set(currentList.filter(s => s.isEligible).map(s => s.id));
        setSelectedStudentIds(initialEligible);
    }, [selectedSubjectKey, selectedClassId]);

    // Toggle individual checkbox
    const handleToggleStudentSelection = (recordId: string) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(recordId)) {
                next.delete(recordId);
            } else {
                next.add(recordId);
            }
            return next;
        });
    };

    // Check all students in the selected subject
    const handleCheckAll = () => {
        const allIds = new Set(studentsInSelectedSubject.map(s => s.id));
        setSelectedStudentIds(allIds);
    };

    // Uncheck all students in the selected subject
    const handleUncheckAll = () => {
        setSelectedStudentIds(new Set());
    };

    // Submit Approval to state and backend
    const handleApproveAndSave = async () => {
        if (studentsInSelectedSubject.length === 0) return;

        setIsSavingApproval(true);
        try {
            const allIds = studentsInSelectedSubject.map(s => s.id);
            const toApprove = allIds.filter(id => selectedStudentIds.has(id));
            const toDisapprove = allIds.filter(id => !selectedStudentIds.has(id));

            if (toApprove.length > 0) {
                await bulkSetRemidiEligibility(toApprove, true);
            }
            if (toDisapprove.length > 0) {
                await bulkSetRemidiEligibility(toDisapprove, false);
            }

            setCandidates(prev => prev.map(c => {
                if (toApprove.includes(c.id)) return { ...c, isEligible: true };
                if (toDisapprove.includes(c.id)) return { ...c, isEligible: false };
                return c;
            }));

            showSuccess(`تم اعتماد (${toApprove.length}) طالب للتكميلي`);
        } catch (e) {
            showError('فشل حفظ الاعتماد');
        } finally {
            setIsSavingApproval(false);
        }
    };

    // Toggle Input Period Access
    const handleToggleInputPeriod = async () => {
        const nextState = !settings.isInputOpen;
        const confirmed = await confirmAction(
            nextState ? 'فتح رصد التكميلي' : 'إغلاق رصد التكميلي',
            nextState 
                ? 'هل تريد فتح رصد وتعديل درجات الاختبار التكميلي للمحاضرين؟' 
                : 'هل تريد إغلاق رصد درجات التكميلي؟ لن يتمكن المحاضرون من التعديل بعدها.'
        );
        if (!confirmed) return;

        setTogglingInput(true);
        try {
            await toggleRemidiInputStatus(yearId, nextState);
            setSettings(prev => ({ ...prev, isInputOpen: nextState }));
            showSuccess(nextState ? 'تم فتح رصد درجات التكميلي' : 'تم إغلاق رصد درجات التكميلي');
        } catch (e) {
            showError('فشل تعديل حالة الرصد');
        } finally {
            setTogglingInput(false);
        }
    };

    // Toggle Publish Status
    const handleTogglePublish = async () => {
        const nextState = !settings.isPublished;
        const confirmed = await confirmAction(
            nextState ? 'نشر نتائج التكميلي' : 'إلغاء نشر نتائج التكميلي',
            nextState 
                ? 'هل أنت متأكد من نشر درجات التكميلي؟ وفقاً للائحة: الطلاب المجتازون (60 فأعلى) ستظهر درجاتهم في حساباتهم كـ (60)، والدرجات دون 60 تبقى كما هي.' 
                : 'هل أنت متأكد من إلغاء نشر درجات التكميلي؟ ستصبح النتائج مخفية عن الطلاب.'
        );
        if (!confirmed) return;

        setTogglingPublish(true);
        try {
            await toggleRemidiPublishStatus(yearId, nextState);
            setSettings(prev => ({ ...prev, isPublished: nextState }));
            showSuccess(nextState ? 'تم نشر نتائج التكميلي للطلاب' : 'تم إلغاء نشر نتائج التكميلي');
        } catch (e) {
            showError('فشل تغيير حالة النشر');
        } finally {
            setTogglingPublish(false);
        }
    };

    // Direct Score Input by Admin
    const handleScoreInputChange = (id: string, val: string) => {
        if (val === '' || /^[0-9]*$/.test(val)) {
            setScoreInputs(prev => ({ ...prev, [id]: val }));
        }
    };

    const handleCommitScore = async (record: RemidiRecord) => {
        const raw = scoreInputs[record.id];
        if (raw === undefined || raw === '') return;

        let num = parseInt(raw, 10);
        if (isNaN(num)) num = 0;
        if (num > 100) num = 100;
        if (num < 0) num = 0;

        setSavingScoreId(record.id);
        try {
            await saveRemidiScore(record.id, num);
            setCandidates(prev => prev.map(c => c.id === record.id ? { ...c, remidiScore: num } : c));
            setScoreInputs(prev => ({ ...prev, [record.id]: String(num) }));
            showSuccess(`تم حفظ الدرجة (${num}) للطالب ${record.studentName}`);
        } catch (e) {
            showError('فشل حفظ الدرجة');
        } finally {
            setSavingScoreId(null);
        }
    };

    const selectedClassObj = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
    const selectedSubjectObj = useMemo(() => subjectsInSelectedClass.find(s => `${s.classSubjectId}_${s.semester}` === selectedSubjectKey), [subjectsInSelectedClass, selectedSubjectKey]);

    return (
        <div className="space-y-6">
            {/* Top Control Cards: Input Access & Publish Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Input Period Control (Lecturers) */}
                <div className={`p-5 rounded-2xl border transition-all shadow-sm flex flex-col justify-between ${settings.isInputOpen ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-gray-200/80'}`}>
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-extrabold text-gray-700 flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                فترة رصد التكميلي (المحاضرون)
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${settings.isInputOpen ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                {settings.isInputOpen ? 'مفتوحة' : 'مغلقة'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-4">
                            {settings.isInputOpen 
                                ? 'يمكن للمحاضرين حالياً رصد وتعديل درجات التكميلي للطلاب المعتمدين.' 
                                : 'رصد درجات التكميلي مقفل حالياً على المحاضرين.'}
                        </p>
                    </div>

                    <button
                        onClick={handleToggleInputPeriod}
                        disabled={togglingInput}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap ${
                            settings.isInputOpen 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-[#064E3B] hover:bg-emerald-800 text-white'
                        } disabled:opacity-50`}
                    >
                        {togglingInput ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>جاري التحديث...</span>
                            </>
                        ) : settings.isInputOpen ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                <span>إغلاق الرصد</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                <span>فتح الرصد</span>
                            </>
                        )}
                    </button>
                </div>

                {/* 2. Publication Control (Students) */}
                <div className={`p-5 rounded-2xl border transition-all shadow-sm flex flex-col justify-between ${settings.isPublished ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-gray-200/80'}`}>
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-extrabold text-gray-700 flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                نشر نتائج التكميلي (الطلاب)
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${settings.isPublished ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                {settings.isPublished ? 'منشورة' : 'محجوبة'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-4">
                            {settings.isPublished 
                                ? 'النتائج معلنة حالياً في حسابات الطلاب (مع تطبيق سقف 60 للمجتازين).' 
                                : 'نتائج التكميلي محجوبة عن الطلاب حالياً حتى يتم اعتماد نشرها.'}
                        </p>
                    </div>

                    <button
                        onClick={handleTogglePublish}
                        disabled={togglingPublish}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap ${
                            settings.isPublished 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-[#064E3B] hover:bg-emerald-800 text-white'
                        } disabled:opacity-50`}
                    >
                        {togglingPublish ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>جاري التحديث...</span>
                            </>
                        ) : settings.isPublished ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                <span>إلغاء النشر</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>نشر</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* FILTER & SELECTION CARD */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
                
                {/* Header Bar: Semester Filter & Stats */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                        <span className="text-xs font-bold text-gray-500 whitespace-nowrap">الفصل الدراسي:</span>
                        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold gap-1">
                            <button
                                onClick={() => setSemesterFilter('BOTH')}
                                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${semesterFilter === 'BOTH' ? 'bg-[#064E3B] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                الشامل
                            </button>
                            <button
                                onClick={() => setSemesterFilter('SEM1')}
                                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${semesterFilter === 'SEM1' ? 'bg-[#064E3B] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                الفصل الأول
                            </button>
                            <button
                                onClick={() => setSemesterFilter('SEM2')}
                                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${semesterFilter === 'SEM2' ? 'bg-[#064E3B] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                الفصل الثاني
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-lg font-bold whitespace-nowrap">
                            الراسبون: <span className="font-mono tabular-nums">{candidates.length}</span>
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-lg font-bold whitespace-nowrap">
                            المعتمدون: <span className="font-mono tabular-nums">{candidates.filter(c => c.isEligible).length}</span>
                        </span>
                    </div>
                </div>

                {/* Dropdowns Row: Class & Subject */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* 1. Class Dropdown */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-[#064E3B] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">1</span>
                                <span>الفصل الدراسي:</span>
                            </span>
                            {selectedClassId && (
                                <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md tabular-nums">
                                    {classFailingCounts[selectedClassId] || 0} طالب
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <select
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                className="w-full bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer shadow-sm appearance-none pr-4 pl-10"
                            >
                                <option value="">-- اختر الفصل --</option>
                                {classes.map(c => {
                                    const count = classFailingCounts[c.id] || 0;
                                    return (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.gender === 'MALE' ? 'بنين' : 'بنات'}) — [{count} طالب]
                                        </option>
                                    );
                                })}
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    {/* 2. Subject Dropdown */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-[#064E3B] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">2</span>
                                <span>المقرر الدراسي:</span>
                            </span>
                            {selectedSubjectObj && (
                                <span className="text-[11px] font-bold text-[#064E3B] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md tabular-nums">
                                    {selectedSubjectObj.totalStudents} راسب ({selectedSubjectObj.eligibleCount} معتمد)
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <select
                                value={selectedSubjectKey}
                                onChange={e => setSelectedSubjectKey(e.target.value)}
                                disabled={!selectedClassId || subjectsInSelectedClass.length === 0}
                                className="w-full bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer shadow-sm appearance-none pr-4 pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {!selectedClassId ? (
                                    <option value="">-- اختر الفصل أولاً --</option>
                                ) : subjectsInSelectedClass.length === 0 ? (
                                    <option value="">لا توجد مقررات بها رسوب في هذا الفصل</option>
                                ) : (
                                    subjectsInSelectedClass.map(sub => {
                                        const key = `${sub.classSubjectId}_${sub.semester}`;
                                        return (
                                            <option key={key} value={key}>
                                                {sub.subjectName} (ف{sub.semester}) — [{sub.totalStudents} راسب | {sub.eligibleCount} معتمد] • {sub.lecturerName}
                                            </option>
                                        );
                                    })
                                )}
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Subject Selector */}
                {selectedClassId && subjectsInSelectedClass.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-gray-500">
                                مقررات الفصل ({selectedClassObj?.name}):
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {subjectsInSelectedClass.map(sub => {
                                const key = `${sub.classSubjectId}_${sub.semester}`;
                                const isSelected = selectedSubjectKey === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedSubjectKey(key)}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm ${
                                            isSelected
                                                ? 'bg-[#064E3B] text-white border-[#064E3B]'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        <span>{sub.subjectName}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            ف{sub.semester}
                                        </span>
                                        <span className={`text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md font-bold ${
                                            isSelected ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {sub.totalStudents}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* If selected class has 0 failing subjects */}
                {selectedClassId && subjectsInSelectedClass.length === 0 && (
                    <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <svg className="w-10 h-10 text-emerald-500 mx-auto mb-1.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="font-bold text-sm text-gray-700">لا توجد حالات رسوب في ({selectedClassObj?.name})</p>
                        <p className="text-xs text-gray-400 mt-0.5">جميع طلاب هذا الفصل مجتازون في كافة المقررات</p>
                    </div>
                )}
            </div>

            {/* STUDENTS LIST & APPROVAL */}
            {selectedSubjectKey && selectedSubjectObj && (
                <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
                    
                    {/* Header: Subject Details & Quick Actions */}
                    <div className="p-5 bg-gray-50/70 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-md bg-[#064E3B] text-white font-bold text-xs flex items-center justify-center shadow-sm tabular-nums">3</span>
                            <div>
                                <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                                    <span>الطلاب غير المجتازين: {selectedSubjectObj.subjectName}</span>
                                    <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-bold">
                                        فصل {selectedSubjectObj.semester}
                                    </span>
                                </h3>
                                <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                                    <span>الفصل: <strong>{selectedClassObj?.name}</strong></span>
                                    <span>•</span>
                                    <span>المحاضر: <strong>{selectedSubjectObj.lecturerName}</strong></span>
                                    <span>•</span>
                                    <span>العدد: <strong className="text-red-600 font-mono tabular-nums">{studentsInSelectedSubject.length}</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* Search & Bulk Check Controls */}
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <div className="relative w-full sm:w-52">
                                <input
                                    type="text"
                                    placeholder="بحث بالاسم أو الرقم..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-7 pr-8 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                                />
                                <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleCheckAll}
                                    disabled={studentsInSelectedSubject.length === 0}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-[#064E3B] text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm whitespace-nowrap"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    <span>تحديد الكل</span>
                                </button>
                                <button
                                    onClick={handleUncheckAll}
                                    disabled={selectedStudentIds.size === 0}
                                    className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all disabled:opacity-50 shadow-sm whitespace-nowrap"
                                >
                                    <span>إلغاء</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table of Students */}
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[580px] text-right text-xs">
                            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100">
                                <tr>
                                    <th className="p-3 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            checked={studentsInSelectedSubject.length > 0 && studentsInSelectedSubject.every(s => selectedStudentIds.has(s.id))}
                                            onChange={() => {
                                                if (studentsInSelectedSubject.every(s => selectedStudentIds.has(s.id))) {
                                                    handleUncheckAll();
                                                } else {
                                                    handleCheckAll();
                                                }
                                            }}
                                            className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-3">الطالب</th>
                                    <th className="p-3">الفصل</th>
                                    <th className="p-3 text-center">الدرجة السابقة</th>
                                    <th className="p-3 text-center min-w-[140px]">درجة التكميلي</th>
                                    <th className="p-3 text-center">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {studentsInSelectedSubject.map((item) => {
                                    const isChecked = selectedStudentIds.has(item.id);
                                    const isSaving = savingScoreId === item.id;
                                    const isPassedRemidi = item.remidiScore !== undefined && item.remidiScore >= 60;
                                    const currentScore = scoreInputs[item.id] !== undefined ? scoreInputs[item.id] : (item.remidiScore !== undefined ? String(item.remidiScore) : '');

                                    return (
                                        <tr key={item.id} className={`hover:bg-gray-50/70 transition-colors ${isChecked ? 'bg-emerald-50/20' : ''}`}>
                                            {/* Checkbox per student */}
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleToggleStudentSelection(item.id)}
                                                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Student Info */}
                                            <td className="p-3">
                                                <div className="font-bold text-gray-900">{item.studentName}</div>
                                                <div className="text-[10px] text-gray-400 font-mono tabular-nums flex items-center gap-2 mt-0.5">
                                                    <span>{item.studentId}</span>
                                                    <span>•</span>
                                                    <span className="font-sans">{item.gender === 'FEMALE' ? 'طالبة' : 'طالب'}</span>
                                                </div>
                                            </td>

                                            {/* Class */}
                                            <td className="p-3 font-medium text-gray-700">
                                                {item.className}
                                            </td>

                                            {/* Initial Failing Score */}
                                            <td className="p-3 text-center">
                                                <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-md font-bold text-xs tabular-nums">
                                                    {item.initialScore}
                                                </span>
                                            </td>

                                            {/* Remidi Score Input / Editor (Admin Direct Edit) */}
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        placeholder="-"
                                                        value={currentScore}
                                                        onChange={e => handleScoreInputChange(item.id, e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleCommitScore(item);
                                                            }
                                                        }}
                                                        className={`w-14 h-8 text-center border rounded-lg font-bold text-xs outline-none transition-all shadow-sm tabular-nums ${
                                                            item.remidiScore !== undefined 
                                                                ? (isPassedRemidi ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800') 
                                                                : 'border-gray-200 bg-white text-gray-700 focus:border-emerald-500'
                                                        }`}
                                                    />
                                                    <button
                                                        onClick={() => handleCommitScore(item)}
                                                        disabled={isSaving}
                                                        className="p-1.5 bg-gray-100 hover:bg-[#064E3B] hover:text-white text-gray-600 rounded-lg transition-colors border border-gray-200"
                                                        title="حفظ"
                                                    >
                                                        {isSaving ? (
                                                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                        ) : (
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="p-3 text-center">
                                                {item.isEligible ? (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md text-[10px] font-bold">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                                        معتمد
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-md text-[10px] font-medium">
                                                        غير معتمد
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {studentsInSelectedSubject.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">
                                            لا توجد نتائج مطابقة
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Action Bar */}
                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-gray-600 flex items-center gap-2">
                            <span className="font-bold text-gray-800">
                                المحددون: <span className="font-mono tabular-nums text-emerald-700 text-sm font-extrabold">{selectedStudentIds.size}</span> من <span className="font-mono tabular-nums text-gray-700">{studentsInSelectedSubject.length}</span>
                            </span>
                        </div>

                        <button
                            onClick={handleApproveAndSave}
                            disabled={isSavingApproval || studentsInSelectedSubject.length === 0}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#064E3B] hover:bg-emerald-800 text-white font-bold text-xs transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            {isSavingApproval ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>جاري الحفظ...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    <span>اعتماد</span>
                                </>
                            )}
                        </button>
                    </div>

                </div>
            )}

            {/* REMIDI GRADE EDIT REQUESTS */}
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 sm:p-6 shadow-sm mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold border border-amber-100 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-gray-800">طلبات تعديل التكميلي</h3>
                                {pendingRemidiRequestsCount > 0 && (
                                    <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-md font-bold tabular-nums">
                                        {pendingRemidiRequestsCount} جديد
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">مراجعة طلبات المحاضرين لتعديل درجات التكميلي المقفلة</p>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold gap-1 overflow-x-auto max-w-full no-scrollbar self-start sm:self-auto">
                        <button 
                            onClick={() => setRequestFilter('PENDING')}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${requestFilter === 'PENDING' ? 'bg-white text-amber-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <span>بالانتظار</span>
                            {pendingRemidiRequestsCount > 0 && (
                                <span className="bg-amber-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold tabular-nums">
                                    {pendingRemidiRequestsCount}
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={() => setRequestFilter('APPROVED')}
                            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'APPROVED' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            مقبول
                        </button>
                        <button 
                            onClick={() => setRequestFilter('REJECTED')}
                            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'REJECTED' ? 'bg-white text-red-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            مرفوض
                        </button>
                        <button 
                            onClick={() => setRequestFilter('COMPLETED')}
                            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'COMPLETED' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            مكتمل
                        </button>
                        <button 
                            onClick={() => setRequestFilter('ALL')}
                            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${requestFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            الكل (<span className="tabular-nums">{editRequests.length}</span>)
                        </button>
                    </div>
                </div>

                {/* Remidi Edit Requests Table */}
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full min-w-[640px] text-right text-xs">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                            <tr>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3">المحاضر</th>
                                <th className="p-3">المقرر والفصل</th>
                                <th className="p-3 text-center">النوع</th>
                                <th className="p-3 text-center">التاريخ</th>
                                <th className="p-3 text-center">الحالة</th>
                                <th className="p-3 text-center min-w-[140px]">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredRemidiRequests.map((req, idx) => {
                                const sub = subjects.find(s => s.id === req.classSubjectId);
                                const lecturer = allLecturers.find(l => l.id === req.lecturerId);
                                const isLoading = actionLoadingId === req.id;

                                return (
                                    <tr key={req.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="p-3 text-center text-gray-400 font-mono tabular-nums text-[11px]">{idx + 1}</td>
                                        <td className="p-3">
                                            <div className="font-bold text-gray-800">{lecturer?.name || req.lecturerId}</div>
                                            <div className="text-[10px] text-gray-400 font-mono tabular-nums">{req.lecturerId}</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold text-[#064E3B]">{sub?.subjectName || req.classSubjectId}</div>
                                            <div className="text-[10px] text-gray-500">{sub?.className || 'فصل غير محدد'}</div>
                                            {req.notes && <div className="text-[10px] text-amber-700 mt-0.5 bg-amber-50/70 px-1.5 py-0.5 rounded inline-block">السبب: {req.notes}</div>}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="font-bold px-2 py-0.5 rounded text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
                                                تكميلي
                                            </span>
                                        </td>
                                        <td className="p-3 text-center text-gray-500 text-[10px] font-mono tabular-nums">
                                            {new Date(req.requestedAt).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                                                req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                                                req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {req.status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
                                                {req.status === 'PENDING' ? 'بالانتظار' :
                                                 req.status === 'APPROVED' ? 'مقبول' :
                                                 req.status === 'REJECTED' ? 'مرفوض' :
                                                 'مكتمل'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {req.status === 'PENDING' ? (
                                                    <>
                                                        <button 
                                                            onClick={() => handleApprove(req)}
                                                            disabled={isLoading}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                            <span>قبول</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleReject(req)}
                                                            disabled={isLoading}
                                                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            <span>رفض</span>
                                                        </button>
                                                    </>
                                                ) : req.status === 'APPROVED' ? (
                                                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                                                        مفتوح للتعديل
                                                    </span>
                                                ) : req.status === 'REJECTED' ? (
                                                    <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-1 rounded">
                                                        مرفوض
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded">
                                                        مكتمل
                                                    </span>
                                                )}

                                                <button 
                                                    onClick={() => handleDeleteRequest(req)}
                                                    disabled={isLoading}
                                                    className="p-1.5 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors border border-gray-200"
                                                    title="حذف"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredRemidiRequests.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <svg className="w-10 h-10 mb-2 opacity-30 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            <p className="text-xs font-bold text-gray-500">لا توجد طلبات تعديل</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;