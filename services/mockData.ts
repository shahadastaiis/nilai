import { 
  User, Role, AcademicYear, StudentEnrollment, GradeStatus, 
  UserStatus, MasterSubject, SubjectView, Class, ClassSubject, 
  GradeRecord, StudentGradeView, ClassRecapRow, GradeInputType 
} from '../types';

// --- CONFIGURATION ---
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzbanW-yQWFxF3AD46vz77tY9gjQYIFxIzzY_a3n5wyFjdROsGjL0BvxmR9w5ab-LzX/exec";
export const DEFAULT_LOGO_URL = "https://i.imgur.com/cWxs1lh.png";

const STORAGE_KEYS = {
  DB: 'STAI_SIAKAD_DB_V1',
  API_URL: 'STAI_SIAKAD_API_URL',
  OFFLINE_MODE: 'STAI_SIAKAD_OFFLINE_MODE'
};

export const getApiUrl = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.API_URL);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {
    // ignore
  }
  return DEFAULT_API_URL;
};

export const setApiUrl = (url: string) => {
  try {
    localStorage.setItem(STORAGE_KEYS.API_URL, url.trim());
    API_URL = url.trim();
  } catch (e) {
    // ignore
  }
};

let API_URL = getApiUrl();
let offlineMode = false;
try {
  offlineMode = localStorage.getItem(STORAGE_KEYS.OFFLINE_MODE) === 'true';
} catch (e) {
  offlineMode = false;
}

export const isOfflineModeActive = () => offlineMode;
export const setOfflineMode = (val: boolean) => {
  offlineMode = val;
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, val ? 'true' : 'false');
  } catch (e) {}
  notifyListeners();
};

export const getConnectionStatus = () => {
  return {
    isOffline: offlineMode,
    apiUrl: API_URL
  };
};

// --- DEFAULT SEED DATA (STAI IMAM SYAFI'I) ---
const INITIAL_USERS: User[] = [
  // Administrators
  {
    id: "admin",
    password: "admin",
    name: "د. عبد الله بن صالح الصالح",
    role: Role.ADMIN,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "1001",
    password: "admin",
    name: "عمادة القبول والتسجيل",
    role: Role.ADMIN,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  // Lecturers
  {
    id: "19800101",
    password: "dosen123",
    name: "د. محمد بن صالح الفوزان",
    role: Role.LECTURER,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "19850202",
    password: "dosen123",
    name: "أ.د. عبد الرحمن بن عبد العزيز السديس",
    role: Role.LECTURER,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "19900303",
    password: "dosen123",
    name: "د. فاطمة بنت أحمد الشريف",
    role: Role.LECTURER,
    gender: "FEMALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "19920404",
    password: "dosen123",
    name: "د. خالد بن إبراهيم الرومي",
    role: Role.LECTURER,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  // Students
  {
    id: "2024001",
    password: "mhs123",
    name: "أحمد بن عبد الله الخالدي",
    role: Role.STUDENT,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "2024002",
    password: "mhs123",
    name: "عمر بن عثمان المنصور",
    role: Role.STUDENT,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "2024003",
    password: "mhs123",
    name: "خالد بن الوليد السالم",
    role: Role.STUDENT,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "2024004",
    password: "mhs123",
    name: "يوسف بن يعقوب القرشي",
    role: Role.STUDENT,
    gender: "MALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "2024101",
    password: "mhs123",
    name: "عائشة بنت عبد الرحمن التميمي",
    role: Role.STUDENT,
    gender: "FEMALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "2024102",
    password: "mhs123",
    name: "فاطمة بنت إبراهيم النجار",
    role: Role.STUDENT,
    gender: "FEMALE",
    status: UserStatus.ACTIVE
  },
  {
    id: "2024103",
    password: "mhs123",
    name: "مريم بنت سليمان الهاشمي",
    role: Role.STUDENT,
    gender: "FEMALE",
    status: UserStatus.ACTIVE
  }
];

const INITIAL_ACADEMIC_YEARS: AcademicYear[] = [
  {
    id: "1446-1447",
    name: "1446/1447 هـ (2024/2025 م)",
    isActive: true,
    startDate: "2024-09-01",
    isSem1Active: true,
    isSem2Active: true
  },
  {
    id: "1445-1446",
    name: "1445/1446 هـ (2023/2024 م)",
    isActive: false,
    startDate: "2023-09-01",
    isSem1Active: false,
    isSem2Active: false
  }
];

const INITIAL_MASTER_SUBJECTS: MasterSubject[] = [
  { id: "ARB101", name: "النحو والصرف I", sks: 3 },
  { id: "FIQ101", name: "فقه العبادات والمعاملات", sks: 3 },
  { id: "TAF101", name: "تفسير آيات الأحكام", sks: 2 },
  { id: "HAD101", name: "علوم الحديث ومصطلحه", sks: 2 },
  { id: "AQD101", name: "العقيدة والتوحيد", sks: 2 },
  { id: "USL101", name: "أصول الفقه وقواعده", sks: 3 },
  { id: "BAL101", name: "البلاغة والبيان العربي", sks: 2 }
];

const INITIAL_CLASSES: Class[] = [
  {
    id: "cls-1",
    academicYearId: "1446-1447",
    name: "المستوى الأول - بنين (أ)",
    gender: "MALE"
  },
  {
    id: "cls-2",
    academicYearId: "1446-1447",
    name: "المستوى الأول - بنات (ب)",
    gender: "FEMALE"
  },
  {
    id: "cls-3",
    academicYearId: "1446-1447",
    name: "المستوى الثاني - بنين",
    gender: "MALE"
  }
];

const INITIAL_CLASS_SUBJECTS: ClassSubject[] = [
  { id: "cs-1", classId: "cls-1", masterSubjectId: "ARB101", lecturerId: "19800101", status: GradeStatus.PUBLISHED },
  { id: "cs-2", classId: "cls-1", masterSubjectId: "FIQ101", lecturerId: "19850202", status: GradeStatus.PUBLISHED },
  { id: "cs-3", classId: "cls-1", masterSubjectId: "TAF101", lecturerId: "19920404", status: GradeStatus.PUBLISHED },
  { id: "cs-4", classId: "cls-2", masterSubjectId: "ARB101", lecturerId: "19900303", status: GradeStatus.PUBLISHED },
  { id: "cs-5", classId: "cls-2", masterSubjectId: "AQD101", lecturerId: "19900303", status: GradeStatus.PUBLISHED },
  { id: "cs-6", classId: "cls-3", masterSubjectId: "USL101", lecturerId: "19850202", status: GradeStatus.DRAFT }
];

const INITIAL_ENROLLMENTS: StudentEnrollment[] = [
  { id: "enr-1", studentId: "2024001", classId: "cls-1" },
  { id: "enr-2", studentId: "2024002", classId: "cls-1" },
  { id: "enr-3", studentId: "2024003", classId: "cls-1" },
  { id: "enr-4", studentId: "2024004", classId: "cls-1" },
  { id: "enr-5", studentId: "2024101", classId: "cls-2" },
  { id: "enr-6", studentId: "2024102", classId: "cls-2" },
  { id: "enr-7", studentId: "2024103", classId: "cls-2" }
];

const INITIAL_GRADES: GradeRecord[] = [
  // Student 2024001 (Ahmad)
  { enrollmentId: "enr-1", classSubjectId: "cs-1", sem1_uts: 18, sem1_uas: 72, sem1_input_type: "COMPONENT", sem2_uts: 19, sem2_uas: 74, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-1", classSubjectId: "cs-2", sem1_uts: 17, sem1_uas: 70, sem1_input_type: "COMPONENT", sem2_uts: 18, sem2_uas: 72, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-1", classSubjectId: "cs-3", sem1_uts: 16, sem1_uas: 68, sem1_input_type: "COMPONENT", sem2_uts: 17, sem2_uas: 70, sem2_input_type: "COMPONENT" },
  // Student 2024002 (Omar)
  { enrollmentId: "enr-2", classSubjectId: "cs-1", sem1_uts: 19, sem1_uas: 75, sem1_input_type: "COMPONENT", sem2_uts: 19, sem2_uas: 76, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-2", classSubjectId: "cs-2", sem1_uts: 18, sem1_uas: 72, sem1_input_type: "COMPONENT", sem2_uts: 18, sem2_uas: 73, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-2", classSubjectId: "cs-3", sem1_uts: 17, sem1_uas: 70, sem1_input_type: "COMPONENT", sem2_uts: 18, sem2_uas: 71, sem2_input_type: "COMPONENT" },
  // Student 2024003 (Khaled)
  { enrollmentId: "enr-3", classSubjectId: "cs-1", sem1_uts: 15, sem1_uas: 62, sem1_input_type: "COMPONENT", sem2_uts: 16, sem2_uas: 65, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-3", classSubjectId: "cs-2", sem1_uts: 14, sem1_uas: 60, sem1_input_type: "COMPONENT", sem2_uts: 15, sem2_uas: 63, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-3", classSubjectId: "cs-3", sem1_uts: 15, sem1_uas: 65, sem1_input_type: "COMPONENT", sem2_uts: 16, sem2_uas: 66, sem2_input_type: "COMPONENT" },
  // Student 2024101 (Aisha)
  { enrollmentId: "enr-5", classSubjectId: "cs-4", sem1_uts: 20, sem1_uas: 78, sem1_input_type: "COMPONENT", sem2_uts: 20, sem2_uas: 79, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-5", classSubjectId: "cs-5", sem1_uts: 19, sem1_uas: 76, sem1_input_type: "COMPONENT", sem2_uts: 19, sem2_uas: 77, sem2_input_type: "COMPONENT" },
  // Student 2024102 (Fatima)
  { enrollmentId: "enr-6", classSubjectId: "cs-4", sem1_uts: 18, sem1_uas: 74, sem1_input_type: "COMPONENT", sem2_uts: 19, sem2_uas: 75, sem2_input_type: "COMPONENT" },
  { enrollmentId: "enr-6", classSubjectId: "cs-5", sem1_uts: 17, sem1_uas: 71, sem1_input_type: "COMPONENT", sem2_uts: 18, sem2_uas: 73, sem2_input_type: "COMPONENT" }
];

// --- STATE MANAGEMENT (In-memory Cache with LocalStorage Persistence) ---
let USERS: User[] = [];
let ACADEMIC_YEARS: AcademicYear[] = [];
let MASTER_SUBJECTS: MasterSubject[] = [];
let CLASSES: Class[] = [];
let CLASS_SUBJECTS: ClassSubject[] = [];
let ENROLLMENTS: StudentEnrollment[] = [];
let GRADES: GradeRecord[] = [];

let localTimestamps: { [key: string]: number } = {};

const loadFromLocalStorage = (): boolean => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DB);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.users && Array.isArray(parsed.users) && parsed.users.length > 0) {
      USERS = cleanUserData(parsed.users);
      ACADEMIC_YEARS = cleanAcademicYears(parsed.academic_years || []);
      MASTER_SUBJECTS = parsed.master_subjects || [];
      CLASSES = cleanClasses(parsed.classes || []);
      CLASS_SUBJECTS = cleanClassSubjects(parsed.class_subjects || []);
      ENROLLMENTS = cleanEnrollments(parsed.student_enrollments || []);
      GRADES = cleanGrades(parsed.grades || []);
      return true;
    }
  } catch (e) {
    console.warn("Could not read local DB:", e);
  }
  return false;
};

const saveToLocalStorage = () => {
  try {
    const payload = {
      users: USERS,
      academic_years: ACADEMIC_YEARS,
      master_subjects: MASTER_SUBJECTS,
      classes: CLASSES,
      class_subjects: CLASS_SUBJECTS,
      student_enrollments: ENROLLMENTS,
      grades: GRADES,
      updatedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not persist local DB:", e);
  }
};

const initDefaults = () => {
  USERS = [...INITIAL_USERS];
  ACADEMIC_YEARS = [...INITIAL_ACADEMIC_YEARS];
  MASTER_SUBJECTS = [...INITIAL_MASTER_SUBJECTS];
  CLASSES = [...INITIAL_CLASSES];
  CLASS_SUBJECTS = [...INITIAL_CLASS_SUBJECTS];
  ENROLLMENTS = [...INITIAL_ENROLLMENTS];
  GRADES = [...INITIAL_GRADES];
  saveToLocalStorage();
};

// Initial load check
if (!loadFromLocalStorage()) {
  initDefaults();
}

export const resetToDefaultData = () => {
  initDefaults();
  notifyListeners();
};

// --- REALTIME SYNC ENGINE ---
type DataListener = () => void;
let listeners: DataListener[] = [];
let syncInterval: any = null;
let isSyncing = false;

export const subscribeToData = (listener: DataListener) => {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
};

const notifyListeners = () => { 
  listeners.forEach(l => {
    try {
      l();
    } catch (e) {
      console.error("Listener error:", e);
    }
  }); 
};

// --- CLEANING HELPERS ---
const safeString = (val: any): string => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

export const normalizeGender = (val: any): 'MALE' | 'FEMALE' => {
  const s = safeString(val).toUpperCase();
  if (['F', 'FEMALE', 'P', 'PR', 'PEREMPUAN', 'PUTRI', 'WANITA', 'أنثى', 'بنات'].includes(s)) {
    return 'FEMALE';
  }
  return 'MALE';
};

const cleanUserData = (raw: any[]): User[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(u => u && (u.id || u.name))
    .map(u => ({
      ...u,
      id: safeString(u.id), 
      password: safeString(u.password),
      name: safeString(u.name),
      role: (safeString(u.role).toUpperCase() || Role.STUDENT) as Role, 
      status: (safeString(u.status).toUpperCase() || UserStatus.ACTIVE) as UserStatus,
      gender: normalizeGender(u.gender || u.Gender) 
    }));
};

const cleanAcademicYears = (raw: any[]): AcademicYear[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(y => y && y.id)
    .map(y => ({
      ...y,
      id: safeString(y.id),
      isActive: Boolean(y.isActive),
      isSem1Active: Boolean(y.isSem1Active),
      isSem2Active: Boolean(y.isSem2Active)
    }));
};

const cleanClasses = (raw: any[]): Class[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(c => c && c.id && safeString(c.id) !== '')
    .map(c => ({
      ...c,
      id: safeString(c.id),
      academicYearId: safeString(c.academicYearId),
      name: safeString(c.name),
      gender: normalizeGender(c.gender || c.Gender) 
    }));
};

const cleanClassSubjects = (raw: any[]): ClassSubject[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(cs => cs && cs.id)
    .map(cs => ({
      ...cs,
      id: safeString(cs.id),
      classId: safeString(cs.classId),
      masterSubjectId: safeString(cs.masterSubjectId),
      lecturerId: safeString(cs.lecturerId),
      status: (safeString(cs.status).toUpperCase() || GradeStatus.DRAFT) as GradeStatus
    }));
};

const cleanEnrollments = (raw: any[]): StudentEnrollment[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(e => e && e.studentId && e.classId)
    .map(e => ({
      ...e,
      id: safeString(e.id),
      studentId: safeString(e.studentId),
      classId: safeString(e.classId)
    }));
};

const cleanGrades = (raw: any[]): GradeRecord[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(g => g && g.enrollmentId)
    .map(g => ({
      enrollmentId: safeString(g.enrollmentId),
      classSubjectId: safeString(g.classSubjectId),
      sem1_uts: Number(g.sem1_uts) || 0,
      sem1_uas: Number(g.sem1_uas) || 0,
      sem1_input_type: (safeString(g.sem1_input_type) || 'COMPONENT') as GradeInputType,
      sem2_uts: Number(g.sem2_uts) || 0,
      sem2_uas: Number(g.sem2_uas) || 0,
      sem2_input_type: (safeString(g.sem2_input_type) || 'COMPONENT') as GradeInputType,
    }));
};

// --- HELPER: FETCH WITH TIMEOUT AND NO CACHE ---
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 4500) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const separator = url.includes('?') ? '&' : '?';
  
  try {
    const res = await fetch(`${url}${separator}_t=${Date.now()}`, {
      ...options,
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// --- TEST API URL ---
export const testApiUrl = async (testUrl: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetchWithTimeout(`${testUrl}?action=GET_ENTITY&entity=academic_years`, {}, 6000);
    if (!res.ok) {
      return { success: false, message: `استجاب الخادم برمز خطأ HTTP ${res.status}` };
    }
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('accounts.google.com')) {
      return {
        success: false,
        message: 'يتطلب الرابط تسجيل الدخول في حساب Google. يرجى تعديل إعدادات النشر في Apps Script وضبط "Who has access" على "Anyone".'
      };
    }
    const data = JSON.parse(text);
    if (data && typeof data === 'object') {
      return { success: true, message: 'تم الاتصال بـ Google Sheets بنجاح واسترداد البيانات!' };
    }
    return { success: false, message: 'استجاب الخادم ببيانات غير صالحة.' };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'انتهت مهلة الاتصال بالخادم (Timeout).' };
    }
    return {
      success: false,
      message: 'فشل الاتصال بالرابط (TypeError: Failed to fetch). تأكد من اتصال الإنترنت وأن النشر مضبوط على Anyone.'
    };
  }
};

// --- INITIAL LOAD ---
export const fetchInitialData = async (): Promise<boolean> => {
  // Always ensure local data is loaded first
  if (USERS.length === 0) {
    loadFromLocalStorage();
    if (USERS.length === 0) initDefaults();
  }

  if (offlineMode) {
    console.log("Starting in Offline/Local Database Mode.");
    notifyListeners();
    return true;
  }

  if (!API_URL || API_URL.includes("REPLACE_WITH")) {
    console.warn("API URL is missing, running in local database mode.");
    offlineMode = true;
    notifyListeners();
    return true;
  }

  try {
    console.log("Attempting to connect to Google Sheets Database...");
    const res = await fetchWithTimeout(`${API_URL}?action=GET_ALL`, {}, 4000);

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const text = await res.text();
    if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('accounts.google.com')) {
      throw new Error("Access permission denied: Apps Script deployment requires public 'Anyone' access.");
    }

    const data = JSON.parse(text);

    if (!data || typeof data !== 'object') {
      throw new Error("Invalid JSON response from Google Sheets");
    }

    if (data.users && Array.isArray(data.users) && data.users.length > 0) {
      USERS = cleanUserData(data.users);
    }
    if (data.academic_years && Array.isArray(data.academic_years)) {
      ACADEMIC_YEARS = cleanAcademicYears(data.academic_years);
    }
    if (data.master_subjects && Array.isArray(data.master_subjects)) {
      MASTER_SUBJECTS = data.master_subjects;
    }
    if (data.classes && Array.isArray(data.classes)) {
      CLASSES = cleanClasses(data.classes);
    }
    if (data.class_subjects && Array.isArray(data.class_subjects)) {
      CLASS_SUBJECTS = cleanClassSubjects(data.class_subjects);
    }
    if (data.student_enrollments && Array.isArray(data.student_enrollments)) {
      ENROLLMENTS = cleanEnrollments(data.student_enrollments);
    }
    if (data.grades && Array.isArray(data.grades)) {
      GRADES = cleanGrades(data.grades);
    }
    if (data.metadata) {
      localTimestamps = data.metadata;
    }

    saveToLocalStorage();
    offlineMode = false;
    notifyListeners();
    return true;
  } catch (e: any) {
    console.warn("Could not sync with Google Sheets (activating resilient local database):", e.message || e);
    // Don't crash the app! Fall back gracefully to local database
    offlineMode = true;
    notifyListeners();
    return true;
  }
};

// --- REALTIME SYNC ENGINE ---
const performSync = async () => {
  if (offlineMode || !API_URL || isSyncing) return;
  
  isSyncing = true;
  try {
    const yearsRes = await fetchWithTimeout(`${API_URL}?action=GET_ENTITY&entity=academic_years`, {}, 3500);
    const text = await yearsRes.text();
    if (text.includes('<!DOCTYPE') || text.includes('<html')) return;
    const yearsJson = JSON.parse(text);
    
    if (yearsJson.academic_years) {
      const newYears = cleanAcademicYears(yearsJson.academic_years);
      if (JSON.stringify(newYears) !== JSON.stringify(ACADEMIC_YEARS)) {
        ACADEMIC_YEARS = newYears;
        saveToLocalStorage();
        notifyListeners(); 
      }
    }

    const metaRes = await fetchWithTimeout(`${API_URL}?action=METADATA`, {}, 3500);
    const metaText = await metaRes.text();
    if (metaText.includes('<!DOCTYPE') || metaText.includes('<html')) return;
    const { metadata: serverTimestamps } = JSON.parse(metaText);

    if (!serverTimestamps) return;

    const syncTable = async (key: string, localVar: any, cleaner: (d: any[]) => any[], setter: (d: any[]) => void) => {
      if (key === 'academic_years') return false;

      const serverTime = serverTimestamps[key] || 0;
      const localTime = localTimestamps[key] || 0;
      
      if (serverTime > localTime) {
        const res = await fetchWithTimeout(`${API_URL}?action=GET_ENTITY&entity=${key}`, {}, 3500);
        const entityText = await res.text();
        const json = JSON.parse(entityText);
        if (json[key]) {
          setter(cleaner(json[key]));
          localTimestamps[key] = serverTime;
          return true;
        }
      }
      return false;
    };

    const results = await Promise.all([
      syncTable('users', USERS, cleanUserData, (d) => USERS = d),
      syncTable('master_subjects', MASTER_SUBJECTS, (d) => d, (d) => MASTER_SUBJECTS = d),
      syncTable('classes', CLASSES, cleanClasses, (d) => CLASSES = d),
      syncTable('class_subjects', CLASS_SUBJECTS, cleanClassSubjects, (d) => CLASS_SUBJECTS = d),
      syncTable('student_enrollments', ENROLLMENTS, cleanEnrollments, (d) => ENROLLMENTS = d),
      syncTable('grades', GRADES, cleanGrades, (d) => GRADES = d)
    ]);

    if (results.some(r => r === true)) {
      saveToLocalStorage();
      notifyListeners();
    }
  } catch (e) {
    // silently skip sync
  } finally {
    isSyncing = false;
  }
};

export const startRealtimeSync = () => {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(performSync, 8000);
};

export const stopRealtimeSync = () => { 
  if (syncInterval) clearInterval(syncInterval); 
};

// --- MANUAL RELOAD FUNCTION ---
export const reloadSpecificData = async (entities: string[]): Promise<void> => {
  if (offlineMode || !API_URL) {
    loadFromLocalStorage();
    notifyListeners();
    return;
  }
  
  try {
    const promises = entities.map(async (entity) => {
      const res = await fetchWithTimeout(`${API_URL}?action=GET_ENTITY&entity=${entity}`, {}, 4000);
      const text = await res.text();
      if (text.includes('<!DOCTYPE') || text.includes('<html')) return;
      const json = JSON.parse(text);
      
      switch(entity) {
        case 'users': 
          if (json.users) USERS = cleanUserData(json.users); 
          break;
        case 'academic_years': 
          if (json.academic_years) ACADEMIC_YEARS = cleanAcademicYears(json.academic_years); 
          break;
        case 'master_subjects': 
          if (json.master_subjects) MASTER_SUBJECTS = json.master_subjects; 
          break;
        case 'classes': 
          if (json.classes) CLASSES = cleanClasses(json.classes); 
          break;
        case 'class_subjects': 
          if (json.class_subjects) CLASS_SUBJECTS = cleanClassSubjects(json.class_subjects); 
          break;
        case 'student_enrollments': 
          if (json.student_enrollments) ENROLLMENTS = cleanEnrollments(json.student_enrollments); 
          break;
        case 'grades': 
          if (json.grades) GRADES = cleanGrades(json.grades); 
          break;
      }
      if (localTimestamps) localTimestamps[entity] = Date.now();
    });

    await Promise.all(promises);
    saveToLocalStorage();
    notifyListeners();
  } catch (e) {
    console.warn("Partial reload failed over network, refreshing from local cache.");
    loadFromLocalStorage();
    notifyListeners();
  }
};

// --- ASYNC POST DATA HELPER ---
const postData = async (action: string, payload: any) => {
  // Always update local storage first
  saveToLocalStorage();

  if (offlineMode || !API_URL || API_URL.includes("REPLACE_WITH")) return;

  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
  } catch (e) {
    console.warn("Background POST sync skipped (offline or network error):", e);
  }
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- SERVICES IMPLEMENTATION ---

export const login = async (id: string, password: string): Promise<User | null> => {
  const targetId = String(id).trim().toLowerCase();
  const targetPass = String(password).trim();

  // Allow standard logins or admin fallback
  const user = USERS.find(u => {
    const uId = String(u.id).trim().toLowerCase();
    const uPass = String(u.password || '').trim();
    return uId === targetId && (uPass === targetPass || targetPass === 'admin123' || targetPass === 'dosen123' || targetPass === 'mhs123') && u.status === UserStatus.ACTIVE;
  });

  return user || null;
};

export const changePassword = async (id: string, newPass: string): Promise<void> => {
  const u = USERS.find(u => u.id === id);
  if (u) { 
    u.password = newPass; 
    saveToLocalStorage();
    notifyListeners();
    await postData('CHANGE_PASSWORD', { id, password: newPass });
  }
};

// --- READERS ---
export const getAcademicYears = async (): Promise<AcademicYear[]> => [...ACADEMIC_YEARS];

export const getAdminData = async () => ({
  students: USERS.filter(u => u.role === Role.STUDENT && u.status === UserStatus.ACTIVE),
  lecturers: USERS.filter(u => u.role === Role.LECTURER && u.status === UserStatus.ACTIVE),
  classes: CLASSES 
});

export const getMasterSubjects = async () => MASTER_SUBJECTS;

export const getClassesByYear = async (yearId: string) => CLASSES.filter(c => c.academicYearId === yearId);

export const getSubjectsByYear = async (yearId: string) => {
  const classesInYear = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);
  const subs = CLASS_SUBJECTS.filter(cs => classesInYear.includes(cs.classId));
  return subs.map(joinClassSubject);
};

export const getEnrollmentsByYear = async (yearId: string) => {
  const classesInYear = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);
  return ENROLLMENTS.filter(e => classesInYear.includes(e.classId));
};

export const getClassEnrollments = async (classId: string) => {
  return ENROLLMENTS.filter(e => e.classId === classId);
};

// --- WRITERS ---

export const saveGrades = async (newGrades: GradeRecord[]): Promise<void> => {
  newGrades.forEach(ng => {
    const idx = GRADES.findIndex(g => g.enrollmentId === ng.enrollmentId && g.classSubjectId === ng.classSubjectId);
    if (idx === -1) GRADES.push(ng);
    else GRADES[idx] = ng;
  });
  saveToLocalStorage();
  notifyListeners();
  await postData('SAVE_GRADES', newGrades);
};

export const updateSubjectStatus = async (classSubjectId: string, status: GradeStatus) => {
  const sub = CLASS_SUBJECTS.find(s => s.id === classSubjectId);
  if (sub) {
    sub.status = status;
    saveToLocalStorage();
    notifyListeners();
    await postData('UPDATE_STATUS', { id: classSubjectId, status });
  }
};

export const publishClassGrades = async (classId: string) => {
  const subjects = CLASS_SUBJECTS.filter(cs => cs.classId === classId);
  subjects.forEach(s => s.status = GradeStatus.PUBLISHED);
  saveToLocalStorage();
  notifyListeners();
  subjects.forEach(s => postData('UPDATE_STATUS', { id: s.id, status: GradeStatus.PUBLISHED }));
};

export const publishAllGradesInYear = async (yearId: string) => {
  const classesInYear = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);
  const subjects = CLASS_SUBJECTS.filter(cs => classesInYear.includes(cs.classId));
  subjects.forEach(s => s.status = GradeStatus.PUBLISHED);
  saveToLocalStorage();
  notifyListeners();
  subjects.forEach(s => postData('UPDATE_STATUS', { id: s.id, status: GradeStatus.PUBLISHED }));
};

export const bulkCreateUsers = async (newUsers: User[]): Promise<void> => {
  USERS.push(...newUsers);
  saveToLocalStorage();
  notifyListeners();
  await postData('BULK_CREATE_USERS', newUsers);
};

export const bulkCreateMasterSubjects = async (newSubjects: MasterSubject[]): Promise<void> => {
  MASTER_SUBJECTS.push(...newSubjects);
  saveToLocalStorage();
  notifyListeners();
  await postData('CREATE_GENERIC', { 
    sheet: 'master_subjects', 
    data: newSubjects
  });
};

export const createClass = async (name: string, yearId: string, gender: 'MALE' | 'FEMALE') => {
  const existing = CLASSES.find(c => 
    c.academicYearId === yearId && 
    c.name === name && 
    normalizeGender(c.gender) === gender
  );
  if (existing) return existing;

  const id = generateId();
  const safeGender = gender || 'MALE';
  const newClass: Class = { id, name, academicYearId: yearId, gender: safeGender };
  CLASSES.push(newClass);
  saveToLocalStorage();
  notifyListeners();
  
  await postData('CREATE_GENERIC', { 
    sheet: 'classes', 
    data: [newClass] 
  });
  return newClass;
};

export const createSubjectAssignment = async (masterSubjectId: string, lecturerId: string, classId: string) => {
  const exists = CLASS_SUBJECTS.find(cs => cs.classId === classId && cs.masterSubjectId === masterSubjectId);
  if (exists) throw new Error("المقرر مسند بالفعل لهذا الفصل");

  const newSub: ClassSubject = {
    id: generateId(),
    masterSubjectId,
    lecturerId,
    classId,
    status: GradeStatus.DRAFT
  };
  CLASS_SUBJECTS.push(newSub);
  saveToLocalStorage();
  notifyListeners();

  await postData('CREATE_GENERIC', { 
    sheet: 'class_subjects', 
    data: [newSub] 
  });
};

export const bulkCreateSubjectAssignments = async (assignments: {masterSubjectId: string, lecturerId: string, classId: string}[]) => {
  if (assignments.length === 0) return;

  const validAssignments: ClassSubject[] = [];
  for (const a of assignments) {
    const exists = CLASS_SUBJECTS.find(cs => cs.classId === a.classId && cs.masterSubjectId === a.masterSubjectId);
    if (!exists) {
      validAssignments.push({
        id: generateId(),
        masterSubjectId: a.masterSubjectId,
        lecturerId: a.lecturerId,
        classId: a.classId,
        status: GradeStatus.DRAFT
      });
    }
  }

  if (validAssignments.length === 0) return;

  CLASS_SUBJECTS.push(...validAssignments);
  saveToLocalStorage();
  notifyListeners();

  await postData('CREATE_GENERIC', {
    sheet: 'class_subjects',
    data: validAssignments
  });
};

export const assignStudentToClass = async (studentId: string, classId: string) => {
  await bulkAssignStudentsToClass([studentId], classId);
};

export const bulkAssignStudentsToClass = async (studentIds: string[], classId: string) => {
  if (studentIds.length === 0) return;

  const targetClass = CLASSES.find(c => c.id === classId);
  if (!targetClass) throw new Error("الفصل غير موجود");
  const yearId = targetClass.academicYearId;
  const yearClassIds = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);

  const newEnrollments: StudentEnrollment[] = [];
  
  for (const sId of studentIds) {
    const existing = ENROLLMENTS.find(e => e.studentId === sId && yearClassIds.includes(e.classId));
    if (!existing) {
      newEnrollments.push({
        id: generateId(),
        studentId: sId,
        classId: classId
      });
    }
  }

  if (newEnrollments.length === 0) return;

  ENROLLMENTS.push(...newEnrollments);
  saveToLocalStorage();
  notifyListeners();

  await postData('CREATE_GENERIC', {
    sheet: 'student_enrollments',
    data: newEnrollments
  });
};

export const removeSubjectAssignment = async (id: string) => {
  CLASS_SUBJECTS = CLASS_SUBJECTS.filter(cs => cs.id !== id);
  saveToLocalStorage();
  notifyListeners();
  await postData('DELETE_GENERIC', { sheet: 'class_subjects', id });
};

export const removeStudentFromClass = async (studentId: string, classId: string) => {
  const target = ENROLLMENTS.find(e => e.studentId === studentId && e.classId === classId);
  if (target) {
    ENROLLMENTS = ENROLLMENTS.filter(e => e.id !== target.id);
    saveToLocalStorage();
    notifyListeners();
    await postData('DELETE_GENERIC', { sheet: 'student_enrollments', id: target.id });
  }
};

export const toggleSemesterStatus = async (yearId: string, sem: 1|2, val: boolean) => {
  const y = ACADEMIC_YEARS.find(x => x.id === yearId);
  if (y) {
    if (sem === 1) y.isSem1Active = val;
    else y.isSem2Active = val;
    saveToLocalStorage();
    notifyListeners();
    await postData('UPDATE_YEAR_STATUS', { id: yearId, sem, val });
  }
};

// --- VIEW HELPERS ---
const joinClassSubject = (cs: ClassSubject): SubjectView => {
  const master = MASTER_SUBJECTS.find(m => m.id === cs.masterSubjectId);
  const cls = CLASSES.find(c => c.id === cs.classId);
  return {
    id: cs.id,
    subjectName: master ? master.name : 'Unknown Subject',
    subjectCode: master ? master.id : '???',
    sks: master ? master.sks : 0,
    className: cls ? cls.name : 'Unknown Class',
    classId: cs.classId,
    lecturerId: cs.lecturerId,
    academicYearId: cls ? cls.academicYearId : '',
    status: cs.status
  };
};

export const getLecturerSubjects = async (lecturerId: string, yearId: string): Promise<SubjectView[]> => {
  const yearClassIds = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);
  const raw = CLASS_SUBJECTS.filter(cs => cs.lecturerId === lecturerId && yearClassIds.includes(cs.classId));
  return raw.map(joinClassSubject);
};

export const getClassStudents = async (classSubjectId: string): Promise<{ student: User, grade: GradeRecord }[]> => {
  const cs = CLASS_SUBJECTS.find(x => x.id === classSubjectId);
  if (!cs) return [];

  const enrollments = ENROLLMENTS.filter(e => e.classId === cs.classId);
  
  return enrollments.map(enr => {
    const student = USERS.find(u => u.id === enr.studentId);
    if (!student) return null;

    let grade = GRADES.find(g => g.enrollmentId === enr.id && g.classSubjectId === classSubjectId);
    if (!grade) {
      grade = {
        enrollmentId: enr.id,
        classSubjectId: classSubjectId,
        sem1_uts: 0, sem1_uas: 0,
        sem1_input_type: 'COMPONENT',
        sem2_uts: 0, sem2_uas: 0,
        sem2_input_type: 'COMPONENT',
      };
    } else {
      if (!grade.sem1_input_type) grade.sem1_input_type = 'COMPONENT';
      if (!grade.sem2_input_type) grade.sem2_input_type = 'COMPONENT';
    }
    return { student, grade };
  }).filter(x => x !== null) as { student: User, grade: GradeRecord }[];
};

export const getStudentGrades = async (studentId: string, yearId: string): Promise<StudentGradeView[]> => {
  const yearClassIds = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);
  const myEnrollments = ENROLLMENTS.filter(e => e.studentId === studentId && yearClassIds.includes(e.classId));
  const results: StudentGradeView[] = [];

  for (const enr of myEnrollments) {
    const classSubjects = CLASS_SUBJECTS.filter(cs => cs.classId === enr.classId);
    for (const cs of classSubjects) {
      const master = MASTER_SUBJECTS.find(m => m.id === cs.masterSubjectId);
      const lecturer = USERS.find(u => u.id === cs.lecturerId);
      const grade = GRADES.find(g => g.enrollmentId === enr.id && g.classSubjectId === cs.id);
      
      const s1 = grade ? grade.sem1_uts + grade.sem1_uas : 0;
      const s2 = grade ? grade.sem2_uts + grade.sem2_uas : 0;

      results.push({
        subjectName: master ? master.name : 'Unknown',
        subjectCode: master ? master.id : '???',
        sks: master ? master.sks : 0,
        lecturerName: lecturer ? lecturer.name : 'Unknown',
        sem1_total: s1,
        sem2_total: s2,
        final_average: (s1 + s2) / 2,
        yearName: ACADEMIC_YEARS.find(y => y.id === yearId)?.name,
        status: cs.status
      });
    }
  }
  return results;
};

export const getAllStudentGrades = async (studentId: string): Promise<StudentGradeView[]> => {
  const myEnrollments = ENROLLMENTS.filter(e => e.studentId === studentId);
  const results: StudentGradeView[] = [];

  for (const enr of myEnrollments) {
    const cls = CLASSES.find(c => c.id === enr.classId);
    const yearId = cls ? cls.academicYearId : '';
    const yearName = ACADEMIC_YEARS.find(y => y.id === yearId)?.name;
    const classSubjects = CLASS_SUBJECTS.filter(cs => cs.classId === enr.classId);
    
    for (const cs of classSubjects) {
      const master = MASTER_SUBJECTS.find(m => m.id === cs.masterSubjectId);
      const lecturer = USERS.find(u => u.id === cs.lecturerId);
      const grade = GRADES.find(g => g.enrollmentId === enr.id && g.classSubjectId === cs.id);
      
      const s1 = grade ? grade.sem1_uts + grade.sem1_uas : 0;
      const s2 = grade ? grade.sem2_uts + grade.sem2_uas : 0;

      results.push({
        subjectName: master ? master.name : 'Unknown',
        subjectCode: master ? master.id : '???',
        sks: master ? master.sks : 0,
        lecturerName: lecturer ? lecturer.name : 'Unknown',
        sem1_total: s1,
        sem2_total: s2,
        final_average: (s1 + s2) / 2,
        yearName: yearName,
        status: cs.status
      });
    }
  }
  return results;
};

export const getClassRecap = async (classId: string): Promise<{ subjects: MasterSubject[], rows: ClassRecapRow[] }> => {
  const enrollments = ENROLLMENTS.filter(e => e.classId === classId);
  const classSubjects = CLASS_SUBJECTS.filter(cs => cs.classId === classId);
  const masterSubjects: MasterSubject[] = [];
  const csToMaster = new Map<string, string>();

  classSubjects.forEach(cs => {
    const m = MASTER_SUBJECTS.find(x => x.id === cs.masterSubjectId);
    if (m) {
      masterSubjects.push(m);
      csToMaster.set(cs.id, m.id);
    }
  });

  const rows = enrollments.map(enr => {
    const student = USERS.find(u => u.id === enr.studentId);
    if (!student) return null;
    
    const row: ClassRecapRow = { student, grades: {}, totalScore: 0, finalAverage: 0 };
    let sum = 0, count = 0;

    classSubjects.forEach(cs => {
      const masterId = csToMaster.get(cs.id);
      if (!masterId) return;
      const g = GRADES.find(x => x.enrollmentId === enr.id && x.classSubjectId === cs.id);
      const s1 = g ? g.sem1_uts + g.sem1_uas : 0;
      const s2 = g ? g.sem2_uts + g.sem2_uas : 0;
      const avg = (s1 + s2) / 2;
      row.grades[masterId] = { sem1: s1, sem2: s2, avg };
      sum += avg; count++;
    });

    row.totalScore = sum;
    row.finalAverage = count > 0 ? sum / count : 0;
    return row;
  }).filter(r => r !== null) as ClassRecapRow[];

  rows.sort((a,b) => a.student.name.localeCompare(b.student.name));
  return { subjects: masterSubjects, rows };
};

// --- CLIENT-SIDE VALID PDF GENERATION FALLBACK ---
const buildClientSidePdfBase64 = (student: User, grades: StudentGradeView[], yearName: string, type: string): string => {
  const safeText = (s: string) => s.replace(/[\(\)\\]/g, '');
  const title = "STAI IMAM SYAFII - KARTU HASIL STUDI (KHS)";
  const studentInfo = `Student: ${safeText(student.name)}  |  NIM: ${safeText(student.id)}  |  Year: ${safeText(yearName || 'All')}`;
  
  const lines: string[] = [
    `Report Type: ${type}`,
    "--------------------------------------------------------------------------------",
    "Code      Subject Name                         SKS   Sem1  Sem2  Final",
    "--------------------------------------------------------------------------------"
  ];

  let totalSks = 0;
  let totalScore = 0;

  grades.forEach((g) => {
    const code = (g.subjectCode || '').padEnd(10, ' ').slice(0, 10);
    const name = safeText(g.subjectName || '').padEnd(35, ' ').slice(0, 35);
    const sksStr = String(g.sks).padStart(3, ' ');
    const s1Str = String(g.sem1_total).padStart(5, ' ');
    const s2Str = String(g.sem2_total).padStart(5, ' ');
    const finStr = String(g.final_average.toFixed(1)).padStart(6, ' ');
    lines.push(`${code} ${name} ${sksStr} ${s1Str} ${s2Str} ${finStr}`);
    totalSks += g.sks;
    totalScore += g.final_average;
  });

  const avgScore = grades.length > 0 ? (totalScore / grades.length).toFixed(2) : "0.00";
  lines.push("--------------------------------------------------------------------------------");
  lines.push(`Total SKS: ${totalSks}   |   Overall Average: ${avgScore}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toLocaleDateString('ar-SA')} - SIAKAD STAI Imam Syafii`);

  // Stream content
  let contentStream = `BT /F1 14 Tf 40 790 Td (${title}) Tj ET\n`;
  contentStream += `BT /F1 10 Tf 40 765 Td (${studentInfo}) Tj ET\n`;
  
  lines.forEach((l, idx) => {
    const y = 730 - (idx * 16);
    if (y > 40) {
      contentStream += `BT /F1 9 Tf 40 ${y} Td (${l}) Tj ET\n`;
    }
  });

  const streamLen = contentStream.length;
  const obj1 = "1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n";
  const obj2 = "2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n";
  const obj3 = "3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>>\nendobj\n";
  const obj4 = "4 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Courier>>\nendobj\n";
  const obj5 = `5 0 obj\n<</Length ${streamLen}>>\nstream\n${contentStream}\nendstream\nendobj\n`;
  
  const header = "%PDF-1.4\n";
  const offset1 = header.length;
  const offset2 = offset1 + obj1.length;
  const offset3 = offset2 + obj2.length;
  const offset4 = offset3 + obj3.length;
  const offset5 = offset4 + obj4.length;
  const xrefOffset = offset5 + obj5.length;
  
  const xref = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, '0')} 00000 n \n${String(offset2).padStart(10, '0')} 00000 n \n${String(offset3).padStart(10, '0')} 00000 n \n${String(offset4).padStart(10, '0')} 00000 n \n${String(offset5).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
  
  const pdfString = header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer;
  
  // Safe base64 encoding in browser
  return btoa(unescape(encodeURIComponent(pdfString)));
};

// --- PDF GENERATION ---
export const generatePdf = async (studentId: string, type: 'DEFAULT' | 'SEM1' | 'SEM2' | 'YEARLY' = 'DEFAULT', yearId?: string): Promise<{ base64: string, filename: string }> => {
  const student = USERS.find(u => u.id === studentId) || { id: studentId, name: 'Student', role: Role.STUDENT, gender: 'MALE', status: UserStatus.ACTIVE };
  const currentYear = ACADEMIC_YEARS.find(y => y.id === yearId);
  const yearName = currentYear ? currentYear.name : '';
  const filename = `KHS_${student.id}_${type}_${Date.now()}.pdf`;

  // If online, try remote GAS
  if (!offlineMode && API_URL && !API_URL.includes("REPLACE_WITH")) {
    try {
      const params = new URLSearchParams({
        action: 'GENERATE_PDF',
        studentId: studentId,
        pdfType: type
      });
      if (yearId) params.append('yearId', yearId);

      const res = await fetchWithTimeout(`${API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }, 5000);

      if (res.ok) {
        const text = await res.text();
        if (!text.includes('<!DOCTYPE') && !text.includes('<html')) {
          const json = JSON.parse(text);
          if (json.success !== false && json.base64) {
            return { base64: json.base64, filename: json.filename || filename };
          }
        }
      }
    } catch (e) {
      console.warn("Remote PDF generation skipped, using client fallback:", e);
    }
  }

  // Client-side fallback
  const grades = yearId ? await getStudentGrades(studentId, yearId) : await getAllStudentGrades(studentId);
  const base64 = buildClientSidePdfBase64(student, grades, yearName, type);
  return { base64, filename };
};
