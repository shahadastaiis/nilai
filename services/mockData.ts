import { 
  User, Role, AcademicYear, StudentEnrollment, GradeStatus, 
  UserStatus, MasterSubject, SubjectView, Class, ClassSubject, 
  GradeRecord, StudentGradeView, ClassRecapRow, ClassRemidiRecapRow, GradeInputType,
  GradeEditRequest, EditRequestStatus, RemidiRecord, RemidiSettings,
  AcademicHistoryYearColumn, AcademicHistorySubjectCell, AcademicHistorySubjectRow, StudentAcademicHistory
} from '../types';

// ============================================================================
// CONFIGURATION (URL BACKEND SPREADSHEET / GOOGLE APPS SCRIPT)
// Ubah URL di bawah ini secara langsung jika ada perubahan deployment:
// ============================================================================
export const API_URL = "https://script.google.com/macros/s/AKfycbzbanW-yQWFxF3AD46vz77tY9gjQYIFxIzzY_a3n5wyFjdROsGjL0BvxmR9w5ab-LzX/exec";
export const DEFAULT_LOGO_URL = "https://i.imgur.com/cWxs1lh.png";

// Hapus sisa-sisa cache data dummy lama di browser
try {
  localStorage.removeItem('STAI_SIAKAD_DB_V1');
  localStorage.removeItem('STAI_SIAKAD_OFFLINE_MODE');
  localStorage.removeItem('STAI_LOCAL_DB');
  localStorage.removeItem('STAI_SIAKAD_API_URL');
} catch (e) {
  // ignore
}

// --- STATE MANAGEMENT (Data murni dari Spreadsheet) ---
let USERS: User[] = [];
let ACADEMIC_YEARS: AcademicYear[] = [];
let MASTER_SUBJECTS: MasterSubject[] = [];
let CLASSES: Class[] = [];
let CLASS_SUBJECTS: ClassSubject[] = [];
let ENROLLMENTS: StudentEnrollment[] = [];
let GRADES: GradeRecord[] = [];
let GRADE_EDIT_REQUESTS: GradeEditRequest[] = [];

// Timestamp Metadata
let localTimestamps: { [key: string]: number } = {};

// --- REALTIME SYNC & CONCURRENCY ENGINE (Google Sheets/Docs Architecture) ---
const SNAPSHOT_CACHE_KEY = 'STAI_SIAKAD_SNAPSHOT_V2';
type DataListener = () => void;
let listeners: DataListener[] = [];
let syncTimer: any = null;
let isSyncing = false;
let isSyncActive = false;
let currentSyncRole: Role | null = null;
let lastSyncCompletedAt = 0;
let visibilityListenerAttached = false;
let writeQueue: Promise<any> = Promise.resolve();

export const setSyncUserRole = (role: Role | null) => {
  currentSyncRole = role;
  if (isSyncActive) {
    scheduleNextSync();
  }
};

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

const parseRole = (val: any): Role => {
  const s = safeString(val).toUpperCase().replace(/[\s_-]+/g, '_');
  if (s.includes('ADMIN_PUTRI') || s.includes('ADMINPUTRI') || s.includes('PUTRI')) {
    return Role.ADMIN_PUTRI;
  }
  if (s.includes('ADMIN')) {
    return Role.ADMIN;
  }
  if (s.includes('LECTURER') || s.includes('DOSEN')) {
    return Role.LECTURER;
  }
  return Role.STUDENT;
};

const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  items.forEach(item => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};

const cleanUserData = (raw: any[]): User[] => {
  if (!Array.isArray(raw)) return [];
  return deduplicateById(
    raw
      .filter(u => u && (u.id || u.name))
      .map(u => ({
        ...u,
        id: safeString(u.id), 
        password: safeString(u.password),
        name: safeString(u.name),
        role: parseRole(u.role), 
        status: (safeString(u.status).toUpperCase() || UserStatus.ACTIVE) as UserStatus,
        gender: normalizeGender(u.gender || u.Gender) 
      }))
  );
};

const cleanMasterSubjects = (raw: any[]): MasterSubject[] => {
  if (!Array.isArray(raw)) return [];
  return deduplicateById(
    raw
      .filter(s => s && (s.id || s.name))
      .map(s => ({
        id: safeString(s.id || s.name),
        name: safeString(s.name || s.id),
        sks: Number(s.sks) || 0
      }))
  );
};

const parseBoolean = (val: any): boolean => {
  if (val === true || val === 1 || val === '1') return true;
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    if (s === 'TRUE' || s === 'YES' || s === '1' || s === 'AKTIF' || s === 'OPEN') return true;
  }
  return false;
};

const cleanAcademicYears = (raw: any[]): AcademicYear[] => {
  if (!Array.isArray(raw)) return [];
  return deduplicateById(
    raw
      .filter(y => y && y.id)
      .map(y => ({
        ...y,
        id: safeString(y.id),
        name: safeString(y.name),
        isActive: parseBoolean(y.isActive),
        startDate: safeString(y.startDate),
        isSem1Active: parseBoolean(y.isSem1Active),
        isSem2Active: parseBoolean(y.isSem2Active)
      }))
  );
};

const cleanClasses = (raw: any[]): Class[] => {
  if (!Array.isArray(raw)) return [];
  return deduplicateById(
    raw
      .filter(c => c && c.id && safeString(c.id) !== '')
      .map(c => ({
        ...c,
        id: safeString(c.id),
        academicYearId: safeString(c.academicYearId),
        name: safeString(c.name),
        gender: normalizeGender(c.gender || c.Gender) 
      }))
  );
};

const cleanClassSubjects = (raw: any[]): ClassSubject[] => {
  if (!Array.isArray(raw)) return [];
  return deduplicateById(
    raw
      .filter(cs => cs && cs.id)
      .map(cs => ({
        ...cs,
        id: safeString(cs.id),
        classId: safeString(cs.classId),
        masterSubjectId: safeString(cs.masterSubjectId),
        lecturerId: safeString(cs.lecturerId),
        status: (safeString(cs.status).toUpperCase() || GradeStatus.DRAFT) as GradeStatus
      }))
  );
};

const cleanEnrollments = (raw: any[]): StudentEnrollment[] => {
  if (!Array.isArray(raw)) return [];
  return deduplicateById(
    raw
      .filter(e => e && e.studentId && e.classId)
      .map((e, idx) => ({
        ...e,
        id: safeString(e.id) || `${safeString(e.classId)}_${safeString(e.studentId)}_${idx}`,
        studentId: safeString(e.studentId),
        classId: safeString(e.classId)
      }))
  );
};

const cleanGrades = (raw: any[]): GradeRecord[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(g => g && g.enrollmentId)
    .map(g => {
      let s1Uts = Number(g.sem1_uts) || 0;
      let s1Uas = Number(g.sem1_uas) || 0;
      let s1Type: GradeInputType = (safeString(g.sem1_input_type).toUpperCase() === 'DIRECT') ? 'DIRECT' : 'COMPONENT';
      let s1Sub = g.sem1_submitted === true || String(g.sem1_submitted).toUpperCase() === 'TRUE' || g.sem1_submitted === 1 || (s1Uts > 0 || s1Uas > 0);
      let s2Uts = Number(g.sem2_uts) || 0;
      let s2Uas = Number(g.sem2_uas) || 0;
      let s2Type: GradeInputType = (safeString(g.sem2_input_type).toUpperCase() === 'DIRECT') ? 'DIRECT' : 'COMPONENT';
      let s2Sub = g.sem2_submitted === true || String(g.sem2_submitted).toUpperCase() === 'TRUE' || g.sem2_submitted === 1 || (s2Uts > 0 || s2Uas > 0);

      // Handle legacy shifted column layout if encountered from older spreadsheet version
      if (typeof g.sem2_uts === 'string' && (g.sem2_uts === 'COMPONENT' || g.sem2_uts === 'DIRECT')) {
        s1Type = g.sem2_uts as GradeInputType;
        s1Sub = g.sem2_uas === true || String(g.sem2_uas).toUpperCase() === 'TRUE' || g.sem2_uas === 1;
        s2Uts = Number(g['']) || 0;
        s2Uas = Number(g.sem2_uas_real) || 0;
        s2Type = 'COMPONENT';
        s2Sub = Boolean(g.sem2_submitted);
      }

      return {
        enrollmentId: safeString(g.enrollmentId),
        classSubjectId: safeString(g.classSubjectId),
        sem1_uts: s1Uts,
        sem1_uas: s1Uas,
        sem1_input_type: s1Type,
        sem1_submitted: s1Sub,
        sem2_uts: s2Uts,
        sem2_uas: s2Uas,
        sem2_input_type: s2Type,
        sem2_submitted: s2Sub,
      };
    });
};

const cleanGradeEditRequests = (raw: any[]): GradeEditRequest[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && (r.id || r.classSubjectId))
    .map(r => ({
      id: safeString(r.id),
      classSubjectId: safeString(r.classSubjectId),
      lecturerId: safeString(r.lecturerId),
      academicYearId: safeString(r.academicYearId),
      semester: (Number(r.semester) === 2 ? 2 : 1) as 1 | 2,
      isRemidi: Boolean(r.isRemidi) || String(r.id).includes('_REMIDI_') || String(r.semester) === 'REMIDI' || String(r.notes || '').includes('تكميلي') || String(r.notes || '').includes('Remidi'),
      status: (safeString(r.status).toUpperCase() || 'PENDING') as EditRequestStatus,
      requestedAt: safeString(r.requestedAt) || new Date().toISOString(),
      respondedAt: safeString(r.respondedAt) || undefined,
      notes: safeString(r.notes) || undefined,
    }));
};

// --- RESILIENT NETWORK LAYER: AUTO-RETRY + EXPONENTIAL BACKOFF + JITTER ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const saveSnapshotToLocalCache = () => {
  try {
    if (USERS.length === 0 && ACADEMIC_YEARS.length === 0) return;
    const payload = {
      users: USERS,
      academic_years: ACADEMIC_YEARS,
      master_subjects: MASTER_SUBJECTS,
      classes: CLASSES,
      class_subjects: CLASS_SUBJECTS,
      student_enrollments: ENROLLMENTS,
      grades: GRADES,
      grade_edit_requests: GRADE_EDIT_REQUESTS,
      metadata: localTimestamps,
      savedAt: Date.now()
    };
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    // Ignore storage quota errors silently
  }
};

const loadSnapshotFromLocalCache = (): boolean => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.users) || data.users.length === 0) {
      return false;
    }
    USERS = cleanUserData(data.users);
    if (data.academic_years) ACADEMIC_YEARS = cleanAcademicYears(data.academic_years);
    if (data.master_subjects) MASTER_SUBJECTS = cleanMasterSubjects(data.master_subjects);
    if (data.classes) CLASSES = cleanClasses(data.classes);
    if (data.class_subjects) CLASS_SUBJECTS = cleanClassSubjects(data.class_subjects);
    if (data.student_enrollments) ENROLLMENTS = cleanEnrollments(data.student_enrollments);
    if (data.grades) GRADES = cleanGrades(data.grades);
    if (data.grade_edit_requests) GRADE_EDIT_REQUESTS = cleanGradeEditRequests(data.grade_edit_requests);
    if (data.metadata) localTimestamps = data.metadata;
    return true;
  } catch (e) {
    return false;
  }
};

const applyServerRemidiData = (remidiSettingsRaw?: any[], remidiRecordsRaw?: any[]) => {
  let changed = false;
  if (remidiSettingsRaw && Array.isArray(remidiSettingsRaw)) {
    remidiSettingsRaw.forEach((s: any) => {
      if (s.academicYearId) {
        REMIDI_SETTINGS[s.academicYearId] = {
          academicYearId: String(s.academicYearId),
          isInputOpen: s.isInputOpen === true || s.isInputOpen === 'TRUE' || s.isInputOpen === 'true',
          isPublished: s.isPublished === true || s.isPublished === 'TRUE' || s.isPublished === 'true'
        };
        changed = true;
      }
    });
  }
  if (remidiRecordsRaw && Array.isArray(remidiRecordsRaw) && remidiRecordsRaw.length > 0) {
    const serverMap = new Map(remidiRecordsRaw.map((r: any) => [String(r.id), r]));
    REMIDI_RECORDS = REMIDI_RECORDS.map(localRec => {
      const srv = serverMap.get(localRec.id);
      if (!srv) return localRec;
      return {
        ...localRec,
        isEligible: srv.isEligible === true || srv.isEligible === 'TRUE' || srv.isEligible === 'true',
        remidiScore: srv.remidiScore !== undefined && srv.remidiScore !== '' && srv.remidiScore !== null ? Number(srv.remidiScore) : localRec.remidiScore,
        submitted: srv.submitted === true || srv.submitted === 'TRUE' || srv.submitted === 'true' || srv.remidiScore !== undefined,
        notes: srv.notes || localRec.notes,
        updatedAt: srv.updatedAt || localRec.updatedAt
      };
    });
    changed = true;
  }
  if (changed) {
    persistRemidiState();
  }
};

// --- HELPER: FETCH NO CACHE WITH AUTO-RETRY (ANTI-CRASH ON HIGH CONCURRENCY) ---
const fetchNoCache = async (url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> => {
  const separator = url.includes('?') ? '&' : '?';
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const targetUrl = `${url}${separator}_t=${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const res = await fetch(targetUrl, {
        ...options,
        redirect: 'follow'
      });

      // Retry automatically on rate limit (429) or temporary server overload (500, 502, 503, 504)
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const backoffMs = Math.min(6000, 700 * Math.pow(2, attempt)) + Math.floor(Math.random() * 450);
        await sleep(backoffMs);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const backoffMs = Math.min(6000, 700 * Math.pow(2, attempt)) + Math.floor(Math.random() * 450);
        await sleep(backoffMs);
      }
    }
  }

  throw lastError || new Error('Network request failed after retries');
};

// --- INITIAL LOAD MURNI DARI GOOGLE SHEETS (WITH LOCAL-FIRST SNAPSHOT FALLBACK) ---
export const fetchInitialData = async (): Promise<boolean> => {
  if (!API_URL || API_URL.includes("REPLACE_WITH")) {
    console.error("API URL is missing!");
    return false;
  }

  // Hydrate from local snapshot immediately if available so memory is pre-warmed
  const hasWarmSnapshot = loadSnapshotFromLocalCache();

  try {
    const res = await fetchNoCache(`${API_URL}?action=GET_ALL`, { redirect: 'follow' }, 3);

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const data = await res.json();

    if (!data || typeof data !== 'object' || data.success === false) {
      throw new Error(data?.message || "Invalid JSON response from Google Sheets");
    }

    if (data.users) USERS = cleanUserData(data.users);
    if (data.academic_years) ACADEMIC_YEARS = cleanAcademicYears(data.academic_years);
    if (data.master_subjects) MASTER_SUBJECTS = cleanMasterSubjects(data.master_subjects);
    if (data.classes) CLASSES = cleanClasses(data.classes || []);
    if (data.class_subjects) CLASS_SUBJECTS = cleanClassSubjects(data.class_subjects || []);
    if (data.student_enrollments) ENROLLMENTS = cleanEnrollments(data.student_enrollments || []);
    if (data.grades) GRADES = cleanGrades(data.grades || []);
    if (data.grade_edit_requests) GRADE_EDIT_REQUESTS = cleanGradeEditRequests(data.grade_edit_requests || []);
    applyServerRemidiData(data.remidi_settings, data.remidi_records);
    if (data.metadata) localTimestamps = data.metadata;

    lastSyncCompletedAt = Date.now();
    saveSnapshotToLocalCache();
    notifyListeners();
    return true;
  } catch (e) {
    console.warn("Primary GET_ALL experienced high load or network issue:", e);
    // Zero-crash fallback: if we have a warm local snapshot, allow the user into the app seamlessly
    // and let the background delta sync update tables quietly
    if (hasWarmSnapshot && USERS.length > 0) {
      notifyListeners();
      setTimeout(() => { performSync(); }, 2000);
      return true;
    }
    return false;
  }
};

// --- SMART DELTA SYNC ENGINE (SINGLE METADATA CHECK + VISIBILITY + ADAPTIVE JITTER) ---
const getAdaptiveSyncDelay = (): number => {
  // Student or Login screen: 45s - 60s random interval (cuts polling traffic by >90%)
  if (!currentSyncRole || currentSyncRole === Role.STUDENT) {
    return 45000 + Math.floor(Math.random() * 15000);
  }
  // Lecturer / Admin: 16s - 23s random jitter interval (prevents synchronized herd spikes)
  return 16000 + Math.floor(Math.random() * 7000);
};

const scheduleNextSync = () => {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (!isSyncActive) return;

  const delay = getAdaptiveSyncDelay();
  syncTimer = setTimeout(async () => {
    await performSync();
    if (isSyncActive) {
      scheduleNextSync();
    }
  }, delay);
};

const performSync = async () => {
  if (!API_URL || API_URL.includes("REPLACE_WITH") || isSyncing) return;

  // Pause background polling when tab is hidden or device is offline (just like Google Docs/Sheets)
  if (typeof document !== 'undefined' && document.hidden) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  isSyncing = true;
  try {
    // 1. Single lightweight request to check server timestamps for all tables
    const metaRes = await fetchNoCache(`${API_URL}?action=METADATA`, {}, 1);
    if (!metaRes.ok) return;

    const { metadata: serverTimestamps } = await metaRes.json();
    if (!serverTimestamps) return;

    const syncTable = async (key: string, cleaner: (d: any[]) => any[], setter: (d: any[]) => void) => {
      const serverTime = Number(serverTimestamps[key]) || 0;
      const localTime = Number(localTimestamps[key]) || 0;

      if (serverTime > localTime) {
        const res = await fetchNoCache(`${API_URL}?action=GET_ENTITY&entity=${key}`, {}, 2);
        if (!res.ok) return false;
        const json = await res.json();
        if (json && json[key]) {
          setter(cleaner(json[key]));
          localTimestamps[key] = serverTime;
          return true;
        }
      }
      return false;
    };

    const syncRemidiTable = async (key: 'remidi_settings' | 'remidi_records') => {
      const serverTime = Number(serverTimestamps[key]) || 0;
      const localTime = Number(localTimestamps[key]) || 0;

      if (serverTime > localTime) {
        const res = await fetchNoCache(`${API_URL}?action=GET_ENTITY&entity=${key}`, {}, 2);
        if (!res.ok) return false;
        const json = await res.json();
        if (json && json[key]) {
          if (key === 'remidi_settings') {
            applyServerRemidiData(json.remidi_settings, undefined);
          } else {
            applyServerRemidiData(undefined, json.remidi_records);
          }
          localTimestamps[key] = serverTime;
          return true;
        }
      }
      return false;
    };

    const results = await Promise.all([
      syncTable('academic_years', cleanAcademicYears, (d) => ACADEMIC_YEARS = d),
      syncTable('users', cleanUserData, (d) => USERS = d),
      syncTable('master_subjects', cleanMasterSubjects, (d) => MASTER_SUBJECTS = d),
      syncTable('classes', cleanClasses, (d) => CLASSES = d),
      syncTable('class_subjects', cleanClassSubjects, (d) => CLASS_SUBJECTS = d),
      syncTable('student_enrollments', cleanEnrollments, (d) => ENROLLMENTS = d),
      syncTable('grades', cleanGrades, (d) => GRADES = d),
      syncTable('grade_edit_requests', cleanGradeEditRequests, (d) => GRADE_EDIT_REQUESTS = d),
      syncRemidiTable('remidi_settings'),
      syncRemidiTable('remidi_records')
    ]);

    lastSyncCompletedAt = Date.now();

    if (results.some(r => r === true)) {
      saveSnapshotToLocalCache();
      notifyListeners();
    }
  } catch (e) {
    // Silent skip on background sync network blip
  } finally {
    isSyncing = false;
  }
};

const handleVisibilityOrOnlineChange = () => {
  if (!isSyncActive) return;
  if (typeof document !== 'undefined' && !document.hidden) {
    // When user returns to tab after >15s, immediately check for delta changes
    if (Date.now() - lastSyncCompletedAt > 15000) {
      performSync();
    }
    scheduleNextSync();
  }
};

export const startRealtimeSync = () => {
  isSyncActive = true;
  if (typeof window !== 'undefined' && !visibilityListenerAttached) {
    document.addEventListener('visibilitychange', handleVisibilityOrOnlineChange);
    window.addEventListener('online', handleVisibilityOrOnlineChange);
    visibilityListenerAttached = true;
  }
  scheduleNextSync();
};

export const stopRealtimeSync = () => {
  isSyncActive = false;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
};

// --- MANUAL RELOAD FUNCTION ---
export const reloadSpecificData = async (entities: string[]): Promise<void> => {
  if (!API_URL) return;

  try {
    const promises = entities.map(async (entity) => {
      const res = await fetchNoCache(`${API_URL}?action=GET_ENTITY&entity=${entity}`, { redirect: 'follow' }, 3);
      const json = await res.json();

      switch(entity) {
        case 'users': 
          if (json.users) USERS = cleanUserData(json.users); 
          break;
        case 'academic_years': 
          if (json.academic_years) ACADEMIC_YEARS = cleanAcademicYears(json.academic_years); 
          break;
        case 'master_subjects': 
          if (json.master_subjects) MASTER_SUBJECTS = cleanMasterSubjects(json.master_subjects); 
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
        case 'grade_edit_requests': 
          if (json.grade_edit_requests) GRADE_EDIT_REQUESTS = cleanGradeEditRequests(json.grade_edit_requests); 
          break;
      }
      if (localTimestamps) localTimestamps[entity] = Date.now();
    });

    await Promise.all(promises);
    saveSnapshotToLocalCache();
    notifyListeners();
  } catch (e) {
    console.error("Partial Reload Failed:", e);
    throw e;
  }
};

// --- SEQUENTIAL WRITE QUEUE + AUTO-RETRY POST HELPER (Google Sheets Lock-Friendly) ---
const executePostWithRetry = async (action: string, payload: any, maxRetries = 4): Promise<boolean> => {
  if (!API_URL || API_URL.includes("REPLACE_WITH")) {
    throw new Error("URL API Spreadsheet belum dikonfigurasi.");
  }

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload }),
        redirect: 'follow'
      });

      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const waitMs = Math.min(7000, 800 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        throw new Error(`Server Spreadsheet Error (HTTP ${res.status}): ${res.statusText}`);
      }

      const json = await res.json();
      if (json && json.success === false) {
        const msg = String(json.message || '');
        // If Google Apps Script LockService is momentarily busy with another user's write, wait & retry automatically
        if ((msg.includes('sibuk') || msg.includes('Lock') || msg.includes('busy')) && attempt < maxRetries) {
          const waitMs = Math.min(7000, 900 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
          await sleep(waitMs);
          continue;
        }
        throw new Error(msg || `Operasi ${action} gagal di backend spreadsheet.`);
      }

      saveSnapshotToLocalCache();
      return true;
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) {
        const waitMs = Math.min(7000, 800 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
        await sleep(waitMs);
      }
    }
  }

  console.error(`Post Error (${action}) after retries:`, lastError);
  throw lastError;
};

const postData = async (action: string, payload: any): Promise<boolean> => {
  // Enqueue writes sequentially per client so rapid actions never collide
  const task = writeQueue.then(
    () => executePostWithRetry(action, payload),
    () => executePostWithRetry(action, payload)
  );
  writeQueue = task.catch(() => {});
  return task;
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

// --- STANDARDIZED ID GENERATION HELPERS ---
export const getClassLevelCode = (className: string): string => {
  const map: { [key: string]: string } = {
    "التمهيدية الأولى": "T1",
    "التمهيدية الثانية": "T2",
    "السنة الأولى": "S1",
    "السنة الثانية": "S2",
    "السنة الثالثة": "S3",
    "السنة الرابعة": "S4"
  };
  const trimmed = safeString(className);
  if (map[trimmed]) return map[trimmed];
  return trimmed.replace(/\s+/g, '_');
};

export const getGenderCode = (gender: any): 'M' | 'F' => {
  return normalizeGender(gender) === 'FEMALE' ? 'F' : 'M';
};

export const generateClassId = (academicYearId: string, className: string, gender: any): string => {
  const yearCode = safeString(academicYearId).replace(/[\/\\]/g, '-');
  const levelCode = getClassLevelCode(className);
  const genderCode = getGenderCode(gender);
  return `${yearCode}_${levelCode}_${genderCode}`;
};

export const generateClassSubjectId = (classId: string, masterSubjectId: string): string => {
  return `${safeString(classId)}_${safeString(masterSubjectId)}`;
};

export const generateEnrollmentId = (classId: string, studentId: string): string => {
  return `${safeString(classId)}_${safeString(studentId)}`;
};

export const generateGradeEditRequestId = (classSubjectId: string, semester: 1 | 2, isRemidi?: boolean): string => {
  const tag = isRemidi ? 'REMIDI' : `SEM${semester}`;
  return `REQ_${safeString(classSubjectId)}_${tag}_${Date.now()}`;
};

// --- SERVICES IMPLEMENTATION ---

export const login = async (id: string, password: string): Promise<User | null> => {
  const targetId = String(id).trim().toLowerCase();
  const targetPass = String(password).trim();

  return USERS.find(u => {
    const uId = String(u.id).trim().toLowerCase();
    const uPass = String(u.password || '').trim();
    const isActive = !u.status || u.status === UserStatus.ACTIVE;

    return uId === targetId && uPass === targetPass && isActive;
  }) || null;
};

export const changePassword = async (id: string, newPass: string): Promise<void> => {
  const u = USERS.find(u => u.id === id);
  if (u) { 
    u.password = newPass; 
    notifyListeners();
    await postData('CHANGE_PASSWORD', { id, password: newPass });
  }
};

// --- READERS ---
export const getAcademicYears = async (): Promise<AcademicYear[]> => [...ACADEMIC_YEARS];

export const getAdminData = async () => ({
  students: USERS.filter(u => u.role === Role.STUDENT && (!u.status || u.status === UserStatus.ACTIVE)),
  lecturers: USERS.filter(u => u.role === Role.LECTURER && (!u.status || u.status === UserStatus.ACTIVE)),
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
  // Direct Server Update & Reload
  await postData('SAVE_GRADES', newGrades);
  await reloadSpecificData(['grades']);
};

// --- GRADE EDIT REQUEST FUNCTIONS ---
export const getGradeEditRequests = async (yearId?: string): Promise<GradeEditRequest[]> => {
  if (yearId) {
    return GRADE_EDIT_REQUESTS.filter(r => r.academicYearId === yearId);
  }
  return [...GRADE_EDIT_REQUESTS];
};

export const getSubjectEditRequests = (classSubjectId: string): GradeEditRequest[] => {
  return GRADE_EDIT_REQUESTS.filter(r => r.classSubjectId === classSubjectId);
};

export const submitGradeEditRequest = async (
  classSubjectId: string,
  lecturerId: string,
  academicYearId: string,
  semester: 1 | 2,
  notes?: string,
  isRemidi?: boolean
): Promise<GradeEditRequest> => {
  const existing = GRADE_EDIT_REQUESTS.find(r => 
    r.classSubjectId === classSubjectId && 
    Boolean(r.isRemidi) === Boolean(isRemidi) &&
    (isRemidi || r.semester === semester) && 
    r.status === 'PENDING'
  );
  if (existing) {
    return existing;
  }

  const newRequest: GradeEditRequest = {
    id: generateGradeEditRequestId(classSubjectId, semester, isRemidi),
    classSubjectId,
    lecturerId,
    academicYearId,
    semester,
    isRemidi: Boolean(isRemidi),
    status: 'PENDING',
    requestedAt: new Date().toISOString(),
    notes: notes || (isRemidi ? 'طلب إذن تعديل درجات التكميلي' : 'Permohonan edit nilai')
  };

  GRADE_EDIT_REQUESTS.unshift(newRequest);
  notifyListeners();

  await postData('SUBMIT_EDIT_REQUEST', newRequest);
  return newRequest;
};

export const respondGradeEditRequest = async (
  requestId: string,
  status: 'APPROVED' | 'REJECTED' | 'COMPLETED'
): Promise<void> => {
  const req = GRADE_EDIT_REQUESTS.find(r => r.id === requestId);
  if (req) {
    req.status = status as EditRequestStatus;
    req.respondedAt = new Date().toISOString();
  }

  // Kirim status baru ke backend Spreadsheet
  await postData('RESPOND_EDIT_REQUEST', {
    id: requestId,
    status,
    respondedAt: new Date().toISOString()
  });

  // Reload data permohonan dari backend Spreadsheet (nilai GRADES sama sekali tidak disentuh)
  await reloadSpecificData(['grade_edit_requests']);
};

export const deleteGradeEditRequest = async (requestId: string): Promise<void> => {
  GRADE_EDIT_REQUESTS = GRADE_EDIT_REQUESTS.filter(r => r.id !== requestId);
  notifyListeners();
  await postData('DELETE_GENERIC', { sheet: 'grade_edit_requests', id: requestId });
};

export const saveSubjectSemesterGrades = async (
  classSubjectId: string,
  semester: 1 | 2,
  lecturerId: string,
  newGrades: GradeRecord[]
): Promise<void> => {
  // Merge incoming semester grades with existing grades for the other semester from backend state (GRADES)
  // Ini menjamin penginputan Semester 1 tidak akan menghapus nilai Semester 2 yang sudah ada, dan sebaliknya
  const mergedRecords: GradeRecord[] = newGrades.map(ng => {
    const existing = GRADES.find(g => g.enrollmentId === ng.enrollmentId && g.classSubjectId === ng.classSubjectId);
    
    if (semester === 1) {
      return {
        enrollmentId: ng.enrollmentId,
        classSubjectId: ng.classSubjectId,
        sem1_uts: Number(ng.sem1_uts) || 0,
        sem1_uas: Number(ng.sem1_uas) || 0,
        sem1_input_type: ng.sem1_input_type || 'COMPONENT',
        sem1_submitted: true,
        sem2_uts: existing ? Number(existing.sem2_uts) || 0 : 0,
        sem2_uas: existing ? Number(existing.sem2_uas) || 0 : 0,
        sem2_input_type: existing?.sem2_input_type || 'COMPONENT',
        sem2_submitted: Boolean(existing?.sem2_submitted),
      };
    } else {
      return {
        enrollmentId: ng.enrollmentId,
        classSubjectId: ng.classSubjectId,
        sem1_uts: existing ? Number(existing.sem1_uts) || 0 : 0,
        sem1_uas: existing ? Number(existing.sem1_uas) || 0 : 0,
        sem1_input_type: existing?.sem1_input_type || 'COMPONENT',
        sem1_submitted: Boolean(existing?.sem1_submitted),
        sem2_uts: Number(ng.sem2_uts) || 0,
        sem2_uas: Number(ng.sem2_uas) || 0,
        sem2_input_type: ng.sem2_input_type || 'COMPONENT',
        sem2_submitted: true,
      };
    }
  });

  // 1. Post langsung ke backend Google Apps Script dan tunggu hingga sukses tersimpan di Google Sheets
  await postData('SAVE_GRADES', mergedRecords);

  // 2. Jika ada permohonan edit aktif yang APPROVED untuk semester ini, update semuanya ke COMPLETED
  const activeReqs = GRADE_EDIT_REQUESTS.filter(r => 
    r.classSubjectId === classSubjectId && 
    !r.isRemidi &&
    r.semester === semester && 
    r.status === 'APPROVED'
  );
  for (const activeReq of activeReqs) {
    try {
      await respondGradeEditRequest(activeReq.id, 'COMPLETED' as any);
    } catch (e) {
      console.warn("Could not mark edit request completed:", e);
    }
  }

  // 3. Ambil kembali data terbaru murni dari backend Google Sheets (Single Source of Truth)
  await reloadSpecificData(['grades', 'grade_edit_requests']);
};

export const updateSubjectStatus = async (classSubjectId: string, status: GradeStatus) => {
  const sub = CLASS_SUBJECTS.find(s => s.id === classSubjectId);
  if (sub) {
    sub.status = status;
    notifyListeners();
    await postData('UPDATE_STATUS', { id: classSubjectId, status });
  }
};

export const publishClassGrades = async (classId: string) => {
  const subjects = CLASS_SUBJECTS.filter(cs => cs.classId === classId);
  const subjectIds = subjects.map(s => s.id);
  if (subjectIds.length === 0) return;

  subjects.forEach(s => s.status = GradeStatus.PUBLISHED);
  notifyListeners();

  try {
    await postData('BULK_UPDATE_STATUS', { ids: subjectIds, status: GradeStatus.PUBLISHED });
  } catch (err) {
    for (const id of subjectIds) {
      await postData('UPDATE_STATUS', { id, status: GradeStatus.PUBLISHED });
    }
  }
};

export const publishAllGradesInYear = async (yearId: string) => {
  const classesInYear = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);
  const subjects = CLASS_SUBJECTS.filter(cs => classesInYear.includes(cs.classId));
  const subjectIds = subjects.map(s => s.id);
  
  subjects.forEach(s => s.status = GradeStatus.PUBLISHED);
  notifyListeners();
  
  try {
    await postData('BULK_UPDATE_STATUS', { ids: subjectIds, status: GradeStatus.PUBLISHED });
  } catch (err) {
    console.warn("BULK_UPDATE_STATUS not available, updating individually:", err);
    for (const id of subjectIds) {
      try {
        await postData('UPDATE_STATUS', { id, status: GradeStatus.PUBLISHED });
      } catch (e) {
        break;
      }
    }
  }
  await reloadSpecificData(['class_subjects']);
};

export const unpublishAllGradesInYear = async (yearId: string) => {
  const classesInYear = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);
  const subjects = CLASS_SUBJECTS.filter(cs => classesInYear.includes(cs.classId));
  const subjectIds = subjects.map(s => s.id);

  subjects.forEach(s => s.status = GradeStatus.DRAFT);
  notifyListeners();

  try {
    await postData('BULK_UPDATE_STATUS', { ids: subjectIds, status: GradeStatus.DRAFT });
  } catch (err) {
    console.warn("BULK_UPDATE_STATUS not available, updating individually:", err);
    for (const id of subjectIds) {
      try {
        await postData('UPDATE_STATUS', { id, status: GradeStatus.DRAFT });
      } catch (e) {
        break;
      }
    }
  }
  await reloadSpecificData(['class_subjects']);
};

export const bulkCreateUsers = async (newUsers: User[]): Promise<void> => {
  USERS.push(...newUsers);
  notifyListeners();
  await postData('BULK_CREATE_USERS', newUsers);
};

export const updateUser = async (user: User): Promise<void> => {
  const index = USERS.findIndex(u => u.id === user.id);
  if (index !== -1) {
    const prevPassword = USERS[index].password;
    USERS[index] = {
      ...USERS[index],
      ...user,
      gender: normalizeGender(user.gender)
    };
    notifyListeners();
    await postData('UPDATE_USER', USERS[index]);
    if (user.password && user.password !== prevPassword) {
      await postData('CHANGE_PASSWORD', { id: user.id, password: user.password });
    }
  }
};

export const bulkCreateMasterSubjects = async (newSubjects: MasterSubject[]): Promise<void> => {
  MASTER_SUBJECTS.push(...newSubjects);
  notifyListeners();
  await postData('CREATE_GENERIC', { 
    sheet: 'master_subjects', 
    data: newSubjects
  });
};

export const updateMasterSubject = async (subject: MasterSubject): Promise<void> => {
  const index = MASTER_SUBJECTS.findIndex(s => s.id === subject.id);
  if (index !== -1) {
    MASTER_SUBJECTS[index] = {
      ...MASTER_SUBJECTS[index],
      ...subject,
      sks: Number(subject.sks) || 0
    };
    notifyListeners();
    await postData('UPDATE_MASTER_SUBJECT', MASTER_SUBJECTS[index]);
  }
};

export const createClass = async (name: string, yearId: string, gender: 'MALE' | 'FEMALE') => {
  const safeGender = normalizeGender(gender);
  const existing = CLASSES.find(c => 
    c.academicYearId === yearId && 
    c.name === name && 
    normalizeGender(c.gender) === safeGender
  );
  if (existing) return existing;

  const id = generateClassId(yearId, name, safeGender);
  const newClass: Class = { id, name, academicYearId: yearId, gender: safeGender };
  CLASSES.push(newClass);
  notifyListeners();
  
  await postData('CREATE_GENERIC', { 
    sheet: 'classes', 
    data: [newClass] 
  });
  return newClass;
};

export const createSubjectAssignment = async (masterSubjectId: string, lecturerId: string, classId: string) => {
  const newId = generateClassSubjectId(classId, masterSubjectId);
  const exists = CLASS_SUBJECTS.find(cs => cs.id === newId || (cs.classId === classId && cs.masterSubjectId === masterSubjectId));
  if (exists) throw new Error("Subject already assigned to this class");

  const newSub: ClassSubject = {
    id: newId,
    masterSubjectId,
    lecturerId,
    classId,
    status: GradeStatus.DRAFT
  };
  CLASS_SUBJECTS.push(newSub);
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
    const id = generateClassSubjectId(a.classId, a.masterSubjectId);
    const exists = CLASS_SUBJECTS.find(cs => cs.id === id || (cs.classId === a.classId && cs.masterSubjectId === a.masterSubjectId));
    if (!exists) {
      validAssignments.push({
        id,
        masterSubjectId: a.masterSubjectId,
        lecturerId: a.lecturerId,
        classId: a.classId,
        status: GradeStatus.DRAFT
      });
    }
  }

  if (validAssignments.length === 0) return;

  CLASS_SUBJECTS.push(...validAssignments);
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
  if (!targetClass) throw new Error("Class not found");
  const yearId = targetClass.academicYearId;
  const yearClassIds = CLASSES.filter(c => c.academicYearId === yearId).map(c => c.id);

  const newEnrollments: StudentEnrollment[] = [];
  
  for (const sId of studentIds) {
    const existing = ENROLLMENTS.find(e => e.studentId === sId && yearClassIds.includes(e.classId));
    if (!existing) {
      newEnrollments.push({
        id: generateEnrollmentId(classId, sId),
        studentId: sId,
        classId: classId
      });
    }
  }

  if (newEnrollments.length === 0) return;

  ENROLLMENTS.push(...newEnrollments);
  notifyListeners();

  await postData('CREATE_GENERIC', { 
    sheet: 'student_enrollments', 
    data: newEnrollments 
  });
};

export const removeSubjectAssignment = async (id: string) => {
  CLASS_SUBJECTS = CLASS_SUBJECTS.filter(cs => cs.id !== id);
  notifyListeners();
  await postData('DELETE_GENERIC', { sheet: 'class_subjects', id });
};

export const removeStudentFromClass = async (studentId: string, classId: string) => {
  const target = ENROLLMENTS.find(e => e.studentId === studentId && e.classId === classId);
  if (target) {
    ENROLLMENTS = ENROLLMENTS.filter(e => e.id !== target.id);
    notifyListeners();
    await postData('DELETE_GENERIC', { sheet: 'student_enrollments', id: target.id });
  }
};

export interface UninputtedSubjectItem {
  classSubjectId: string;
  subjectName: string;
  subjectCode: string;
  lecturerId: string;
  lecturerName: string;
  gradedCount: number;
  totalStudents: number;
}

export interface UninputtedClassColumn {
  classObj: Class;
  studentCount: number;
  totalSubjectsInClass: number;
  inputtedSubjectsInClass: number;
  missingSubjects: UninputtedSubjectItem[];
}

export interface SemesterCompletenessReport {
  semester: 1 | 2;
  totalSubjectsCount: number;
  inputtedSubjectsCount: number;
  missingSubjectsCount: number;
  emptyClassesCount: number;
  isComplete: boolean;
  allClassesColumns: UninputtedClassColumn[];
  uninputtedByClass: UninputtedClassColumn[];
}

/**
 * Mengecek kelengkapan penginputan nilai seluruh mata kuliah pada suatu Tahun Akademik & Semester,
 * diklasifikasikan berdasarkan Kelas (untuk tiap kolom peringatan Admin sebelum menutup akses).
 */
export const getSemesterUninputtedSubjectsByClass = (
  yearId: string,
  semester: 1 | 2,
  isFemaleAdmin?: boolean
): SemesterCompletenessReport => {
  const classesInYear = CLASSES.filter(c => {
    if (c.academicYearId !== yearId) return false;
    if (isFemaleAdmin && normalizeGender(c.gender) !== 'FEMALE') return false;
    return true;
  });

  const userMap = new Map(USERS.map(u => [u.id, u]));
  const masterMap = new Map(MASTER_SUBJECTS.map(m => [m.id, m]));

  let totalSubjectsCount = 0;
  let inputtedSubjectsCount = 0;
  let missingSubjectsCount = 0;
  let emptyClassesCount = 0;

  const allClassesColumns: UninputtedClassColumn[] = [];
  const uninputtedByClass: UninputtedClassColumn[] = [];

  for (const cls of classesInYear) {
    const classEnrollments = ENROLLMENTS.filter(e => {
      if (e.classId !== cls.id) return false;
      const student = userMap.get(e.studentId);
      return Boolean(student && student.role === Role.STUDENT && (!student.status || student.status === UserStatus.ACTIVE));
    });

    const assignedSubjects = CLASS_SUBJECTS.filter(cs => cs.classId === cls.id);

    if (classEnrollments.length === 0) {
      if (assignedSubjects.length > 0) {
        emptyClassesCount++;
      }
      continue;
    }

    const missingSubjects: UninputtedSubjectItem[] = [];
    let inputtedInClass = 0;

    for (const cs of assignedSubjects) {
      totalSubjectsCount++;
      const master = masterMap.get(cs.masterSubjectId);
      const lecturer = userMap.get(cs.lecturerId);

      let gradedCount = 0;
      for (const enr of classEnrollments) {
        const g = GRADES.find(gr => gr.enrollmentId === enr.id && gr.classSubjectId === cs.id);
        if (g) {
          const isSub = semester === 1
            ? (Boolean(g.sem1_submitted) || (Number(g.sem1_uts || 0) + Number(g.sem1_uas || 0) > 0))
            : (Boolean(g.sem2_submitted) || (Number(g.sem2_uts || 0) + Number(g.sem2_uas || 0) > 0));
          if (isSub) {
            gradedCount++;
          }
        }
      }

      if (gradedCount >= classEnrollments.length) {
        inputtedSubjectsCount++;
        inputtedInClass++;
      } else {
        missingSubjectsCount++;
        missingSubjects.push({
          classSubjectId: cs.id,
          subjectName: master ? master.name : cs.masterSubjectId,
          subjectCode: master ? master.id : cs.masterSubjectId,
          lecturerId: cs.lecturerId,
          lecturerName: lecturer ? lecturer.name : cs.lecturerId,
          gradedCount,
          totalStudents: classEnrollments.length
        });
      }
    }

    const colData: UninputtedClassColumn = {
      classObj: cls,
      studentCount: classEnrollments.length,
      totalSubjectsInClass: assignedSubjects.length,
      inputtedSubjectsInClass: inputtedInClass,
      missingSubjects
    };

    allClassesColumns.push(colData);
    if (missingSubjects.length > 0) {
      uninputtedByClass.push(colData);
    }
  }

  return {
    semester,
    totalSubjectsCount,
    inputtedSubjectsCount,
    missingSubjectsCount,
    emptyClassesCount,
    isComplete: totalSubjectsCount > 0 && missingSubjectsCount === 0,
    allClassesColumns,
    uninputtedByClass
  };
};

export const toggleSemesterStatus = async (yearId: string, sem: 1|2, val: boolean) => {
  const y = ACADEMIC_YEARS.find(x => x.id === yearId);
  if (y) {
    if (sem === 1) y.isSem1Active = val;
    else y.isSem2Active = val;
    notifyListeners();
    await postData('UPDATE_YEAR_STATUS', { id: yearId, sem, val });

    // Jika Admin menutup akses penginputan nilai (val === false),
    // pastikan seluruh izin edit (APPROVED) pada semester tersebut ditutup kembali menjadi COMPLETED
    // agar ketika suatu saat dibuka kembali oleh Admin, dosen wajib mengajukan izin edit ulang via WA.
    if (!val) {
      const openApprovedReqs = GRADE_EDIT_REQUESTS.filter(r =>
        r.academicYearId === yearId &&
        !r.isRemidi &&
        r.semester === sem &&
        r.status === 'APPROVED'
      );
      for (const req of openApprovedReqs) {
        try {
          await respondGradeEditRequest(req.id, 'COMPLETED' as any);
        } catch (e) {
          console.warn("Could not close approved edit request on semester lock:", e);
        }
      }
    }

    await reloadSpecificData(['academic_years', 'grade_edit_requests']);
  }
};

// --- JOIN HELPERS ---
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
        sem1_uts: 0, 
        sem1_uas: 0,
        sem1_input_type: 'COMPONENT',
        sem1_submitted: false,
        sem2_uts: 0, 
        sem2_uas: 0,
        sem2_input_type: 'COMPONENT',
        sem2_submitted: false,
      };
    } else {
      const hasLegacySem1 = Boolean(grade.sem1_submitted) || (Number(grade.sem1_uts || 0) + Number(grade.sem1_uas || 0) > 0);
      const hasLegacySem2 = Boolean(grade.sem2_submitted) || (Number(grade.sem2_uts || 0) + Number(grade.sem2_uas || 0) > 0);
      grade = {
        ...grade,
        sem1_input_type: grade.sem1_input_type || 'COMPONENT',
        sem2_input_type: grade.sem2_input_type || 'COMPONENT',
        sem1_submitted: hasLegacySem1,
        sem2_submitted: hasLegacySem2,
      };
    }
    return { student, grade: { ...grade } };
  }).filter(x => x !== null) as { student: User, grade: GradeRecord }[];
};

export const getStudentGrades = async (studentId: string, yearId: string, classId?: string): Promise<StudentGradeView[]> => {
  const classesInYear = CLASSES.filter(c => c.academicYearId === yearId && (!classId || c.id === classId));
  const yearClassIds = classesInYear.map(c => c.id);
  const myEnrollments = ENROLLMENTS.filter(e => e.studentId === studentId && yearClassIds.includes(e.classId));
  const results: StudentGradeView[] = [];
  const remidiSettings = getRemidiSettings(yearId);
  const isRemidiPublished = Boolean(remidiSettings.isPublished);
  const yearObj = ACADEMIC_YEARS.find(y => y.id === yearId);

  for (const enr of myEnrollments) {
    const cls = CLASSES.find(c => c.id === enr.classId);
    const classSubjects = CLASS_SUBJECTS.filter(cs => cs.classId === enr.classId);
    for (const cs of classSubjects) {
      const master = MASTER_SUBJECTS.find(m => m.id === cs.masterSubjectId);
      const lecturer = USERS.find(u => u.id === cs.lecturerId);
      const grade = GRADES.find(g => g.enrollmentId === enr.id && g.classSubjectId === cs.id);
      
      let s1 = grade ? grade.sem1_uts + grade.sem1_uas : 0;
      let s2 = grade ? grade.sem2_uts + grade.sem2_uas : 0;

      const hasSem1 = Boolean(grade && (grade.sem1_submitted || s1 > 0));
      const hasSem2 = Boolean(grade && (grade.sem2_submitted || s2 > 0));
      const hasGrade = Boolean(hasSem1 || hasSem2 || cs.status === GradeStatus.PUBLISHED || cs.status === GradeStatus.SUBMITTED);

      // Jika remidi sudah dipublish oleh Admin:
      // Mahasiswa yang remidi dan nilainya >= 60 akan mendapatkan nilai 60. Jika < 60 maka nilainya tidak berubah.
      if (isRemidiPublished) {
        const rem1 = REMIDI_RECORDS.find(r => r.academicYearId === yearId && r.classSubjectId === cs.id && r.studentId === studentId && r.semester === 1 && r.isEligible && r.remidiScore !== undefined);
        if (rem1 && rem1.remidiScore !== undefined) {
          s1 = rem1.remidiScore >= 60 ? 60 : rem1.remidiScore;
        }
        const rem2 = REMIDI_RECORDS.find(r => r.academicYearId === yearId && r.classSubjectId === cs.id && r.studentId === studentId && r.semester === 2 && r.isEligible && r.remidiScore !== undefined);
        if (rem2 && rem2.remidiScore !== undefined) {
          s2 = rem2.remidiScore >= 60 ? 60 : rem2.remidiScore;
        }
      }

      results.push({
        classSubjectId: cs.id,
        masterSubjectId: cs.masterSubjectId,
        subjectName: master ? master.name : 'Unknown',
        subjectCode: master ? master.id : '???',
        sks: master ? master.sks : 0,
        lecturerName: lecturer ? lecturer.name : 'Unknown',
        sem1_total: s1,
        sem2_total: s2,
        final_average: (hasSem1 && hasSem2) ? (s1 + s2) / 2 : (hasSem1 ? s1 : (hasSem2 ? s2 : 0)),
        hasSem1,
        hasSem2,
        hasGrade,
        yearId: yearId,
        yearName: yearObj?.name,
        classId: cls?.id,
        className: cls?.name,
        status: cs.status
      });
    }
  }
  return results;
};

/**
 * Mengurutkan Tahun Akademik dari yang paling awal (terlama) hingga paling akhir (terbaru).
 */
export const compareAcademicYearsAsc = (a?: AcademicYear, b?: AcademicYear): number => {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  // 1. Gunakan startDate jika keduanya valid dan berbeda
  const tA = a.startDate ? Date.parse(a.startDate) : NaN;
  const tB = b.startDate ? Date.parse(b.startDate) : NaN;
  if (!isNaN(tA) && !isNaN(tB) && tA !== tB) {
    return tA - tB;
  }

  // 2. Ekstrak angka tahun dari name atau id (contoh: "1445/1446" -> 1445, "2022/2023" -> 2022)
  const extractFirstYearNum = (str: string): number => {
    const match = String(str || '').match(/\d{4}/);
    return match ? parseInt(match[0], 10) : NaN;
  };

  const numA = extractFirstYearNum(a.name || a.id);
  const numB = extractFirstYearNum(b.name || b.id);
  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }

  // 3. Fallback perbandingan string
  return String(a.name || a.id).localeCompare(String(b.name || b.id));
};

export const getAcademicPredicate = (score: number | null): string => {
  if (score === null || isNaN(score)) return '—';
  if (score >= 90) return 'ممتاز';
  if (score >= 80) return 'جيد جداً';
  if (score >= 70) return 'جيد';
  if (score >= 60) return 'مقبول';
  return 'راسب';
};

/**
 * Mengambil daftar mahasiswa yang terdaftar pada Tahun Akademik (dan Kelas tertentu jika dipilih)
 * untuk halaman KHS Mahasiswa pada role Admin.
 */
export const getKhsEnrolledStudents = async (
  yearId: string,
  classId?: string,
  isFemaleAdmin?: boolean
): Promise<{
  student: User;
  classObj: Class;
  enrollmentId: string;
  totalAcademicYearsCount: number;
  hasRepeatedClass: boolean;
}[]> => {
  // Hitung jumlah tahun akademik dan status mengulang untuk setiap mahasiswa
  const enrollmentsByStudent = new Map<string, StudentEnrollment[]>();
  ENROLLMENTS.forEach(e => {
    const arr = enrollmentsByStudent.get(e.studentId) || [];
    arr.push(e);
    enrollmentsByStudent.set(e.studentId, arr);
  });

  const classesInYear = CLASSES.filter(c => {
    if (yearId && c.academicYearId !== yearId) return false;
    if (classId && c.id !== classId) return false;
    if (isFemaleAdmin && normalizeGender(c.gender) !== 'FEMALE') return false;
    return true;
  });

  const classMap = new Map(classesInYear.map(c => [c.id, c]));
  const allClassMap = new Map(CLASSES.map(c => [c.id, c]));
  const userMap = new Map(USERS.map(u => [u.id, u]));

  const matchingEnrollments = ENROLLMENTS.filter(e => classMap.has(e.classId));
  const result: {
    student: User;
    classObj: Class;
    enrollmentId: string;
    totalAcademicYearsCount: number;
    hasRepeatedClass: boolean;
  }[] = [];

  const seenStudentIds = new Set<string>();

  for (const enr of matchingEnrollments) {
    if (seenStudentIds.has(enr.studentId)) continue;
    const student = userMap.get(enr.studentId);
    const cls = classMap.get(enr.classId);
    if (!student || !cls) continue;
    if (student.role !== Role.STUDENT) continue;
    if (student.status && student.status !== UserStatus.ACTIVE) continue;
    if (isFemaleAdmin && normalizeGender(student.gender) !== 'FEMALE') continue;

    seenStudentIds.add(enr.studentId);

    const allStudentEnrollments = enrollmentsByStudent.get(student.id) || [];
    const distinctYearIds = new Set<string>();
    const classLevelCounts = new Map<string, number>();

    allStudentEnrollments.forEach(se => {
      const c = allClassMap.get(se.classId);
      if (c && c.academicYearId) {
        distinctYearIds.add(c.academicYearId);
        const lvlKey = getClassLevelCode(c.name).toUpperCase() || c.name.trim();
        classLevelCounts.set(lvlKey, (classLevelCounts.get(lvlKey) || 0) + 1);
      }
    });

    let hasRepeatedClass = false;
    classLevelCounts.forEach(cnt => {
      if (cnt > 1) hasRepeatedClass = true;
    });

    result.push({
      student,
      classObj: cls,
      enrollmentId: enr.id,
      totalAcademicYearsCount: distinctYearIds.size || 1,
      hasRepeatedClass
    });
  }

  result.sort((a, b) => a.student.name.localeCompare(b.student.name));
  return result;
};

/**
 * Mengambil seluruh Riwayat Nilai Akademik Mahasiswa lintas seluruh Tahun Akademik
 * yang pernah ditempuh di kampus, lengkap dengan deteksi Mengulang Kelas (Repeat Class),
 * kolom Tahun Akademik dinamis, rata-rata per mata kuliah, dan rata-rata keseluruhan.
 */
export const getStudentAcademicHistory = async (studentId: string): Promise<StudentAcademicHistory | null> => {
  const student = USERS.find(u => u.id === studentId);
  if (!student) return null;

  const yearMap = new Map(ACADEMIC_YEARS.map(y => [y.id, y]));
  const classMap = new Map(CLASSES.map(c => [c.id, c]));
  const masterSubMap = new Map(MASTER_SUBJECTS.map(m => [m.id, m]));

  // 1. Ambil seluruh enrollment mahasiswa yang terhubung dengan class & academicYear yang valid
  const rawEnrollments = ENROLLMENTS.filter(e => e.studentId === studentId);
  const validEnrItems: {
    enrollment: StudentEnrollment;
    classObj: Class;
    yearObj: AcademicYear;
    classLevelKey: string;
  }[] = [];

  for (const enr of rawEnrollments) {
    const cls = classMap.get(enr.classId);
    if (!cls) continue;
    const yr = yearMap.get(cls.academicYearId);
    if (!yr) continue;
    const classLevelKey = getClassLevelCode(cls.name).toUpperCase() || cls.name.trim();
    validEnrItems.push({
      enrollment: enr,
      classObj: cls,
      yearObj: yr,
      classLevelKey
    });
  }

  // 2. Urutkan secara kronologis dari tahun akademik paling awal hingga paling akhir
  validEnrItems.sort((a, b) => compareAcademicYearsAsc(a.yearObj, b.yearObj));

  // Jika ada duplikat enrollment pada tahun akademik & kelas yang sama persis, deduplikasi
  const dedupedEnrItems: typeof validEnrItems = [];
  const seenYearClass = new Set<string>();
  for (const item of validEnrItems) {
    const key = `${item.yearObj.id}__${item.classObj.id}`;
    if (!seenYearClass.has(key)) {
      seenYearClass.add(key);
      dedupedEnrItems.push(item);
    }
  }

  // 3. Kelompokkan berdasarkan identitas kelas (classLevelKey) untuk mendeteksi pengulangan kelas
  // sesuai urutan tahun akademik:
  // - Jika mahasiswa menempuh kelas yang sama pada >= 2 tahun akademik berbeda:
  //   * Tahun akademik pertama (dan tahun-tahun sebelum percobaan terakhir pada kelas itu)
  //     ditandai `isRepeatedLater = true` (Tidak Lulus - Mengulang).
  //   * Tahun akademik kedua/berikutnya ditandai `isRepeatAttempt = true` (Mengulang Kelas).
  //   * Hanya tahun akademik terakhir pada kelas tersebut yang diperhitungkan dalam rata-rata.
  const groupsByClassLevel = new Map<string, typeof dedupedEnrItems>();
  for (const item of dedupedEnrItems) {
    const list = groupsByClassLevel.get(item.classLevelKey) || [];
    list.push(item);
    groupsByClassLevel.set(item.classLevelKey, list);
  }

  let repeatCount = 0;
  const yearColumns: AcademicHistoryYearColumn[] = dedupedEnrItems.map(item => {
    const sameClassList = groupsByClassLevel.get(item.classLevelKey) || [item];
    const indexInClassGroup = sameClassList.indexOf(item);
    const totalAttempts = sameClassList.length;
    const isRepeatedLater = indexInClassGroup >= 0 && indexInClassGroup < totalAttempts - 1;
    const isRepeatAttempt = indexInClassGroup > 0;
    const nextAttempt = isRepeatedLater ? sameClassList[indexInClassGroup + 1] : undefined;

    if (isRepeatAttempt) {
      repeatCount++;
    }

    return {
      enrollmentId: item.enrollment.id,
      academicYearId: item.yearObj.id,
      academicYearName: item.yearObj.name,
      startDate: item.yearObj.startDate,
      classId: item.classObj.id,
      className: item.classObj.name,
      classGender: normalizeGender(item.classObj.gender),
      classLevelCode: item.classLevelKey,
      attemptNumber: indexInClassGroup + 1,
      totalAttemptsForClass: totalAttempts,
      isRepeatedLater,
      isRepeatAttempt,
      repeatedInYearName: nextAttempt?.yearObj.name,
      yearAverage: null
    };
  });

  // 4. Kumpulkan seluruh mata kuliah yang pernah ditempuh mahasiswa di kelas-kelas tersebut
  // Gunakan masterSubjectId (atau nama mata kuliah yang dinormalisasi jika masterSubjectId sama) sebagai kunci
  const subjectCatalogMap = new Map<string, {
    subjectKey: string;
    masterSubjectId: string;
    subjectCode: string;
    subjectName: string;
    sks: number;
  }>();

  for (const col of yearColumns) {
    const classSubjects = CLASS_SUBJECTS.filter(cs => cs.classId === col.classId);
    for (const cs of classSubjects) {
      const master = masterSubMap.get(cs.masterSubjectId);
      const subjectName = master ? master.name.trim() : cs.masterSubjectId;
      const subjectCode = master ? master.id : cs.masterSubjectId;
      const subjectKey = subjectName.toLowerCase();

      if (!subjectCatalogMap.has(subjectKey)) {
        subjectCatalogMap.set(subjectKey, {
          subjectKey,
          masterSubjectId: cs.masterSubjectId,
          subjectCode,
          subjectName,
          sks: master ? master.sks : 0
        });
      }
    }
  }

  // 5. Bangun baris mata kuliah beserta sel nilai pada setiap kolom Tahun Akademik
  const subjectRows: AcademicHistorySubjectRow[] = [];
  const yearScoreAccumulators = new Map<string, { sum: number; count: number }>();
  yearColumns.forEach(col => yearScoreAccumulators.set(col.enrollmentId, { sum: 0, count: 0 }));

  subjectCatalogMap.forEach(subMeta => {
    const cellsByEnrollmentId: { [enrollmentId: string]: AcademicHistorySubjectCell } = {};
    let countedSum = 0;
    let countedYearsCount = 0;

    for (const col of yearColumns) {
      const classSubjectsInCol = CLASS_SUBJECTS.filter(cs => cs.classId === col.classId);
      const matchingCs = classSubjectsInCol.find(cs => {
        const m = masterSubMap.get(cs.masterSubjectId);
        const nameKey = (m ? m.name.trim() : cs.masterSubjectId).toLowerCase();
        return nameKey === subMeta.subjectKey || cs.masterSubjectId === subMeta.masterSubjectId;
      });

      if (!matchingCs) {
        cellsByEnrollmentId[col.enrollmentId] = {
          enrollmentId: col.enrollmentId,
          academicYearId: col.academicYearId,
          enrolledInSubject: false,
          hasGrade: false,
          sem1Score: null,
          sem2Score: null,
          finalScore: null,
          isCountedInAverage: false,
          isExcludedDueToRepeat: false
        };
        continue;
      }

      const grade = GRADES.find(
        g => g.enrollmentId === col.enrollmentId && g.classSubjectId === matchingCs.id
      );

      let s1 = grade ? (Number(grade.sem1_uts) || 0) + (Number(grade.sem1_uas) || 0) : 0;
      let s2 = grade ? (Number(grade.sem2_uts) || 0) + (Number(grade.sem2_uas) || 0) : 0;

      const hasSem1 = Boolean(grade && (grade.sem1_submitted || s1 > 0));
      const hasSem2 = Boolean(grade && (grade.sem2_submitted || s2 > 0));

      // Terapkan nilai Remidi apabila sudah dipublish pada tahun akademik tersebut
      const remidiSettings = getRemidiSettings(col.academicYearId);
      if (remidiSettings.isPublished) {
        const rem1 = REMIDI_RECORDS.find(
          r =>
            r.academicYearId === col.academicYearId &&
            r.classSubjectId === matchingCs.id &&
            r.studentId === studentId &&
            r.semester === 1 &&
            r.isEligible &&
            r.remidiScore !== undefined
        );
        if (rem1 && rem1.remidiScore !== undefined) {
          s1 = rem1.remidiScore >= 60 ? 60 : rem1.remidiScore;
        }
        const rem2 = REMIDI_RECORDS.find(
          r =>
            r.academicYearId === col.academicYearId &&
            r.classSubjectId === matchingCs.id &&
            r.studentId === studentId &&
            r.semester === 2 &&
            r.isEligible &&
            r.remidiScore !== undefined
        );
        if (rem2 && rem2.remidiScore !== undefined) {
          s2 = rem2.remidiScore >= 60 ? 60 : rem2.remidiScore;
        }
      }

      // Pastikan nilai yang belum tersedia tidak otomatis dianggap 0
      const hasGrade = Boolean(hasSem1 || hasSem2);
      let finalScore: number | null = null;

      if (hasGrade) {
        if (hasSem1 && hasSem2) {
          finalScore = (s1 + s2) / 2;
        } else if (hasSem1 && !hasSem2) {
          finalScore = s1;
        } else if (!hasSem1 && hasSem2) {
          finalScore = s2;
        }
      }

      // Logika Mengulang Kelas:
      // Jika kolom tahun akademik ini berstatus `isRepeatedLater` (mahasiswa tidak lulus & mengulang kelas yang sama di tahun berikutnya),
      // maka nilai tetap ditampilkan sebagai riwayat tetapi TIDAK dimasukkan dalam perhitungan rata-rata.
      const isExcludedDueToRepeat = Boolean(hasGrade && col.isRepeatedLater);
      const isCountedInAverage = Boolean(hasGrade && !col.isRepeatedLater && finalScore !== null);

      if (isCountedInAverage && finalScore !== null) {
        countedSum += finalScore;
        countedYearsCount++;
      }

      if (hasGrade && finalScore !== null) {
        const acc = yearScoreAccumulators.get(col.enrollmentId);
        if (acc) {
          acc.sum += finalScore;
          acc.count += 1;
        }
      }

      cellsByEnrollmentId[col.enrollmentId] = {
        enrollmentId: col.enrollmentId,
        academicYearId: col.academicYearId,
        classSubjectId: matchingCs.id,
        enrolledInSubject: true,
        hasGrade,
        sem1Score: hasSem1 ? s1 : null,
        sem2Score: hasSem2 ? s2 : null,
        finalScore,
        status: matchingCs.status,
        isCountedInAverage,
        isExcludedDueToRepeat
      };
    }

    const averageScore = countedYearsCount > 0 ? countedSum / countedYearsCount : null;

    subjectRows.push({
      subjectKey: subMeta.subjectKey,
      masterSubjectId: subMeta.masterSubjectId,
      subjectCode: subMeta.subjectCode,
      subjectName: subMeta.subjectName,
      sks: subMeta.sks,
      cellsByEnrollmentId,
      averageScore,
      countedYearsCount,
      predicate: getAcademicPredicate(averageScore)
    });
  });

  // Isi rata-rata per kolom tahun akademik
  yearColumns.forEach(col => {
    const acc = yearScoreAccumulators.get(col.enrollmentId);
    col.yearAverage = acc && acc.count > 0 ? acc.sum / acc.count : null;
  });

  // 6. Hitung Rata-rata Keseluruhan Semua Mata Kuliah (dari rata-rata setiap mata kuliah yang valid)
  const validSubjectAverages = subjectRows
    .map(r => r.averageScore)
    .filter((v): v is number => v !== null && !isNaN(v));

  const overallAverage =
    validSubjectAverages.length > 0
      ? validSubjectAverages.reduce((acc, v) => acc + v, 0) / validSubjectAverages.length
      : null;

  const uniqueClassesCount = groupsByClassLevel.size;
  const distinctAcademicYears = new Set(yearColumns.map(c => c.academicYearId));

  return {
    student,
    totalAcademicYears: distinctAcademicYears.size,
    uniqueClassesCount,
    repeatCount,
    yearColumns,
    subjectRows,
    overallAverage,
    overallPredicate: getAcademicPredicate(overallAverage)
  };
};

export const getAllStudentGrades = async (studentId: string): Promise<StudentGradeView[]> => {
  const history = await getStudentAcademicHistory(studentId);
  if (!history) return [];

  const results: StudentGradeView[] = [];
  for (const col of history.yearColumns) {
    const gradesInYear = await getStudentGrades(studentId, col.academicYearId, col.classId);
    gradesInYear.forEach(g => {
      results.push({
        ...g,
        isRepeat: col.isRepeatedLater
      });
    });
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
      if (!masterSubjects.some(x => x.id === m.id)) {
        masterSubjects.push(m);
      }
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

// --- PDF GENERATION ---
export const generatePdf = async (studentId: string, type: 'DEFAULT' | 'SEM1' | 'SEM2' | 'YEARLY' = 'DEFAULT', yearId?: string): Promise<{ base64: string, filename: string }> => {
  if (!API_URL || API_URL.includes("REPLACE_WITH")) throw new Error("API URL not configured");
  
  const params = new URLSearchParams({
    action: 'GENERATE_PDF',
    studentId: studentId,
    pdfType: type
  });

  if (yearId) {
    params.append('yearId', yearId);
  }

  let res;
  try {
    res = await fetchNoCache(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
  } catch (e) {
    throw new Error("Gagal terhubung ke server (Network Error). Periksa koneksi internet.");
  }
  
  if (!res.ok) {
    throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
  }
  
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error("Server mengembalikan respons yang tidak valid.");
  }

  if (json.success === false) {
    throw new Error(json.message || "Gagal membuat PDF di server.");
  }
  
  return { base64: json.base64, filename: json.filename };
};

export const generateLecturerSubjectPdf = async (
  classSubjectId: string,
  pdfType: 'SEM1' | 'SEM2' | 'YEARLY',
  yearId?: string
): Promise<{ base64: string; filename: string }> => {
  if (!API_URL || API_URL.includes("REPLACE_WITH")) throw new Error("API URL not configured");

  const params = new URLSearchParams({
    action: 'GENERATE_LECTURER_PDF',
    classSubjectId: classSubjectId,
    pdfType: pdfType,
    semester: pdfType === 'SEM2' ? '2' : '1'
  });

  if (yearId) {
    params.append('yearId', yearId);
  }

  let res;
  try {
    res = await fetchNoCache(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
  } catch (e) {
    throw new Error("Gagal terhubung ke server (Network Error). Periksa koneksi internet.");
  }

  if (!res.ok) {
    throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error("Server mengembalikan respons yang tidak valid.");
  }

  if (json.success === false) {
    if (String(json.message || '').includes('Invalid Action')) {
      throw new Error("Server Google Apps Script masih menjalankan versi lama. Silakan di Google Apps Script klik: Deploy -> Manage deployments -> ikon Pensil (Edit) -> Version: New version -> Deploy.");
    }
    throw new Error(json.message || "Gagal membuat PDF rekap nilai dosen di server.");
  }

  return { base64: json.base64, filename: json.filename };
};

// ============================================================================
// REMIDI / TAKMILI (التكميلي / الإعادة) SERVICE ENGINE
// ============================================================================
const REMIDI_STORAGE_KEY = 'STAI_REMIDI_RECORDS_V3';
const REMIDI_SETTINGS_KEY = 'STAI_REMIDI_SETTINGS_V3';

let REMIDI_RECORDS: RemidiRecord[] = [];
let REMIDI_SETTINGS: { [yearId: string]: RemidiSettings } = {};

// Load persistent data from localStorage
try {
  const savedRecords = localStorage.getItem(REMIDI_STORAGE_KEY);
  if (savedRecords) {
    REMIDI_RECORDS = JSON.parse(savedRecords);
  }
  const savedSettings = localStorage.getItem(REMIDI_SETTINGS_KEY);
  if (savedSettings) {
    REMIDI_SETTINGS = JSON.parse(savedSettings);
  }
} catch (e) {
  console.warn("Could not load remidi cache:", e);
}

const persistRemidiState = () => {
  try {
    const meaningfulRecords = REMIDI_RECORDS.filter(r => r.isEligible || r.remidiScore !== undefined || r.notes);
    localStorage.setItem(REMIDI_STORAGE_KEY, JSON.stringify(meaningfulRecords));
    localStorage.setItem(REMIDI_SETTINGS_KEY, JSON.stringify(REMIDI_SETTINGS));
  } catch (e) {
    console.warn("Could not save remidi cache:", e);
  }
};

/**
 * Mendapatkan konfigurasi remidi untuk tahun akademik tertentu
 */
export const getRemidiSettings = (yearId: string): RemidiSettings => {
  if (!yearId) {
    return { academicYearId: '', isInputOpen: false, isPublished: false };
  }
  if (!REMIDI_SETTINGS[yearId]) {
    REMIDI_SETTINGS[yearId] = {
      academicYearId: yearId,
      isInputOpen: false,
      isPublished: false,
    };
  }
  return REMIDI_SETTINGS[yearId];
};

/**
 * Buka atau tutup akses input nilai remidi bagi dosen
 */
export const toggleRemidiInputStatus = async (yearId: string, isOpen: boolean): Promise<void> => {
  const s = getRemidiSettings(yearId);
  s.isInputOpen = isOpen;
  persistRemidiState();
  notifyListeners();
  try {
    await postData('SAVE_REMIDI_SETTINGS', s);
    if (!isOpen) {
      const openRemidiReqs = GRADE_EDIT_REQUESTS.filter(r =>
        r.academicYearId === yearId &&
        Boolean(r.isRemidi) &&
        r.status === 'APPROVED'
      );
      for (const req of openRemidiReqs) {
        try {
          await respondGradeEditRequest(req.id, 'COMPLETED' as any);
        } catch (e) {
          console.warn("Could not close approved remidi edit request on lock:", e);
        }
      }
    }
  } catch (err) {
    console.warn("Could not save remidi settings to backend:", err);
  }
};

/**
 * Publish atau tutup publikasi nilai remidi ke mahasiswa
 */
export const toggleRemidiPublishStatus = async (yearId: string, isPublished: boolean): Promise<void> => {
  const s = getRemidiSettings(yearId);
  s.isPublished = isPublished;
  persistRemidiState();
  notifyListeners();
  try {
    await postData('SAVE_REMIDI_SETTINGS', s);
  } catch (err) {
    console.warn("Could not save remidi settings to backend:", err);
  }
};

/**
 * Sinkronisasi otomatis kandidat remidi dari daftar nilai yang < 60
 * Dioptimalkan dengan O(1) Hash Map & validasi nilai terisi
 */
export const syncAndGetRemidiCandidates = (
  yearId: string, 
  semesterFilter: 'SEM1' | 'SEM2' | 'BOTH' = 'BOTH'
): RemidiRecord[] => {
  if (!yearId) return [];

  const classesInYear = CLASSES.filter(c => c.academicYearId === yearId);
  const classIds = new Set(classesInYear.map(c => c.id));
  const enrollmentsInYear = ENROLLMENTS.filter(e => classIds.has(e.classId));
  const classSubjectsInYear = CLASS_SUBJECTS.filter(cs => classIds.has(cs.classId));

  // Build high-performance lookup maps O(1)
  const classMap = new Map(classesInYear.map(c => [c.id, c]));
  const userMap = new Map(USERS.map(u => [u.id, u]));
  const masterSubMap = new Map(MASTER_SUBJECTS.map(m => [m.id, m]));
  const existingRecordMap = new Map(REMIDI_RECORDS.map(r => [r.id, r]));

  // Index GRADES by enrollmentId_classSubjectId for instant O(1) lookup
  const gradeMap = new Map<string, GradeRecord>();
  GRADES.forEach(g => {
    gradeMap.set(`${g.enrollmentId}_${g.classSubjectId}`, g);
  });

  // Group class subjects by classId
  const classSubjectsByClassId = new Map<string, ClassSubject[]>();
  classSubjectsInYear.forEach(cs => {
    const list = classSubjectsByClassId.get(cs.classId) || [];
    list.push(cs);
    classSubjectsByClassId.set(cs.classId, list);
  });

  const generatedRecords: RemidiRecord[] = [];

  enrollmentsInYear.forEach(enr => {
    const student = userMap.get(enr.studentId);
    if (!student) return;
    const cls = classMap.get(enr.classId);
    if (!cls) return;

    const subjectsInThisClass = classSubjectsByClassId.get(enr.classId) || [];

    subjectsInThisClass.forEach(cs => {
      const mSub = masterSubMap.get(cs.masterSubjectId);
      const lecturer = userMap.get(cs.lecturerId);
      const grade = gradeMap.get(`${enr.id}_${cs.id}`);

      const sem1Score = (Number(grade?.sem1_uts) || 0) + (Number(grade?.sem1_uas) || 0);
      const sem2Score = (Number(grade?.sem2_uts) || 0) + (Number(grade?.sem2_uas) || 0);

      const subjectName = mSub?.name || 'مقرر دراسي';
      const subjectCode = mSub?.id || cs.masterSubjectId;
      const lecturerName = lecturer?.name || 'المحاضر';

      // Semester 1 Check (< 60)
      // Hanya masukkan jika nilainya sudah disubmit/diinput atau sudah ada record remidi sebelumnya
      const id1 = `REM_${yearId}_${cs.id}_${enr.studentId}_1`;
      const prev1 = existingRecordMap.get(id1);
      const hasSem1Grading = Boolean(grade?.sem1_submitted) || Number(grade?.sem1_uts) > 0 || Number(grade?.sem1_uas) > 0;

      if ((hasSem1Grading && sem1Score < 60) || (prev1 && (prev1.isEligible || prev1.remidiScore !== undefined))) {
        const record1: RemidiRecord = {
          id: id1,
          academicYearId: yearId,
          classId: cls.id,
          className: cls.name,
          classSubjectId: cs.id,
          subjectName,
          subjectCode,
          studentId: student.id,
          studentName: student.name,
          gender: normalizeGender(student.gender),
          lecturerId: cs.lecturerId,
          lecturerName,
          semester: 1,
          initialScore: sem1Score,
          remidiScore: prev1?.remidiScore,
          submitted: prev1 ? (prev1.submitted !== undefined ? prev1.submitted : prev1.remidiScore !== undefined) : false,
          isEligible: prev1 ? prev1.isEligible : false,
          notes: prev1?.notes,
          updatedAt: prev1?.updatedAt
        };
        generatedRecords.push(record1);
        existingRecordMap.set(id1, record1);
      }

      // Semester 2 Check (< 60)
      // Hanya masukkan jika nilainya sudah disubmit/diinput atau sudah ada record remidi sebelumnya
      const id2 = `REM_${yearId}_${cs.id}_${enr.studentId}_2`;
      const prev2 = existingRecordMap.get(id2);
      const hasSem2Grading = Boolean(grade?.sem2_submitted) || Number(grade?.sem2_uts) > 0 || Number(grade?.sem2_uas) > 0;

      if ((hasSem2Grading && sem2Score < 60) || (prev2 && (prev2.isEligible || prev2.remidiScore !== undefined))) {
        const record2: RemidiRecord = {
          id: id2,
          academicYearId: yearId,
          classId: cls.id,
          className: cls.name,
          classSubjectId: cs.id,
          subjectName,
          subjectCode,
          studentId: student.id,
          studentName: student.name,
          gender: normalizeGender(student.gender),
          lecturerId: cs.lecturerId,
          lecturerName,
          semester: 2,
          initialScore: sem2Score,
          remidiScore: prev2?.remidiScore,
          submitted: prev2 ? (prev2.submitted !== undefined ? prev2.submitted : prev2.remidiScore !== undefined) : false,
          isEligible: prev2 ? prev2.isEligible : false,
          notes: prev2?.notes,
          updatedAt: prev2?.updatedAt
        };
        generatedRecords.push(record2);
        existingRecordMap.set(id2, record2);
      }
    });
  });

  // Preserve records and persist
  REMIDI_RECORDS = Array.from(existingRecordMap.values());
  persistRemidiState();

  // Filter based on requested semester
  return generatedRecords.filter(r => {
    if (r.academicYearId !== yearId) return false;
    if (semesterFilter === 'SEM1') return r.semester === 1;
    if (semesterFilter === 'SEM2') return r.semester === 2;
    return true; // BOTH
  });
};

/**
 * Toggle persetujuan/seleksi hak ikut remidi bagi mahasiswa (per record)
 */
export const toggleRemidiEligibility = async (recordId: string, isEligible: boolean): Promise<void> => {
  const target = REMIDI_RECORDS.find(r => r.id === recordId);
  if (target) {
    target.isEligible = isEligible;
    target.updatedAt = new Date().toISOString();
    persistRemidiState();
    notifyListeners();
    try {
      await postData('SAVE_REMIDI_RECORDS', [target]);
    } catch (err) {
      console.warn("Could not save remidi eligibility to backend:", err);
    }
  }
};

/**
 * Seleksi masal (Pilih Semua / Batal Semua)
 */
export const bulkSetRemidiEligibility = async (recordIds: string[], isEligible: boolean): Promise<void> => {
  const idSet = new Set(recordIds);
  const updatedList: RemidiRecord[] = [];
  REMIDI_RECORDS.forEach(r => {
    if (idSet.has(r.id)) {
      r.isEligible = isEligible;
      r.updatedAt = new Date().toISOString();
      updatedList.push(r);
    }
  });
  persistRemidiState();
  notifyListeners();
  if (updatedList.length > 0) {
    try {
      await postData('SAVE_REMIDI_RECORDS', updatedList);
    } catch (err) {
      console.warn("Could not bulk save remidi eligibility to backend:", err);
    }
  }
};

/**
 * Update nilai remidi (bisa dipanggil oleh Dosen atau Admin)
 */
export const saveRemidiScore = async (recordId: string, remidiScore: number, notes?: string): Promise<void> => {
  const target = REMIDI_RECORDS.find(r => r.id === recordId);
  if (target) {
    target.remidiScore = Math.max(0, Math.min(100, remidiScore));
    if (notes !== undefined) target.notes = notes;
    target.updatedAt = new Date().toISOString();
    persistRemidiState();
    notifyListeners();
    try {
      await postData('SAVE_REMIDI_RECORDS', [target]);
    } catch (err) {
      console.warn("Could not save remidi score to backend:", err);
    }
  }
};

/**
 * Simpan nilai remidi secara borongan (Bulk Save oleh Dosen)
 */
export const bulkSaveRemidiScores = async (
  scores: Array<{ recordId: string; remidiScore: number; notes?: string }>,
  classSubjectId?: string
): Promise<void> => {
  const map = new Map(scores.map(s => [s.recordId, s]));
  const updatedList: RemidiRecord[] = [];
  REMIDI_RECORDS.forEach(r => {
    const update = map.get(r.id);
    if (update) {
      r.remidiScore = Math.max(0, Math.min(100, update.remidiScore));
      r.submitted = true; // Kunci setelah disimpan
      if (update.notes !== undefined) r.notes = update.notes;
      r.updatedAt = new Date().toISOString();
      updatedList.push(r);
    }
  });
  persistRemidiState();
  notifyListeners();
  if (updatedList.length > 0) {
    try {
      await postData('SAVE_REMIDI_RECORDS', updatedList);
    } catch (err) {
      console.warn("Could not bulk save remidi scores to backend:", err);
    }
  }

  // Jika ada permohonan edit remidi aktif yang APPROVED untuk mata kuliah ini, tandai COMPLETED
  const targetCsId = classSubjectId || (updatedList.length > 0 ? updatedList[0].classSubjectId : undefined);
  if (targetCsId) {
    const activeReq = GRADE_EDIT_REQUESTS.find(r => 
      r.classSubjectId === targetCsId && 
      Boolean(r.isRemidi) && 
      r.status === 'APPROVED'
    );
    if (activeReq) {
      try {
        await respondGradeEditRequest(activeReq.id, 'COMPLETED');
      } catch (e) {
        console.warn("Could not mark remidi edit request completed:", e);
      }
    }
  }
};

/**
 * Mengambil daftar mahasiswa remidi yang disetujui untuk diisi oleh Dosen tertentu
 */
export const getLecturerRemidiRecords = (
  lecturerId: string, 
  yearId: string, 
  classSubjectId?: string
): RemidiRecord[] => {
  // Sync first to ensure fresh data
  syncAndGetRemidiCandidates(yearId, 'BOTH');

  return REMIDI_RECORDS.filter(r => {
    if (r.academicYearId !== yearId) return false;
    if (r.lecturerId !== lecturerId) return false;
    if (!r.isEligible) return false; // Hanya yang sudah disetujui Admin
    if (classSubjectId && r.classSubjectId !== classSubjectId) return false;
    return true;
  });
};

/**
 * Mengambil data remidi mahasiswa
 */
export const getStudentRemidiData = (
  studentId: string, 
  yearId: string
): { 
  hasFailingGrades: boolean;
  eligibleRecords: RemidiRecord[];
  allRecords: RemidiRecord[];
  isPublished: boolean;
} => {
  // Sync first
  const candidates = syncAndGetRemidiCandidates(yearId, 'BOTH');
  const settings = getRemidiSettings(yearId);
  const isPublished = Boolean(settings.isPublished);

  // Aturan resmi:
  // Jika sudah di-publish admin:
  // - Nilai remidi yang diinput dosen jika >= 60 akan tampil sebagai 60 di halaman mahasiswa.
  // - Jika kurang dari 60, nilainya tidak berubah dan dianggap tidak lulus.
  const attachStudentDisplayScore = (r: RemidiRecord): RemidiRecord => {
    let studentDisplayScore: number | undefined = undefined;
    if (isPublished && r.remidiScore !== undefined) {
      studentDisplayScore = r.remidiScore >= 60 ? 60 : r.remidiScore;
    }
    return {
      ...r,
      studentDisplayScore
    };
  };

  const studentRecords = candidates.filter(r => r.studentId === studentId).map(attachStudentDisplayScore);
  const eligibleRecords = studentRecords.filter(r => r.isEligible);

  return {
    hasFailingGrades: studentRecords.length > 0,
    eligibleRecords,
    allRecords: studentRecords,
    isPublished
  };
};

/**
 * Mengambil data rekap nilai khusus remidi (Role Admin).
 * Ketentuannya sama dengan rekap nilai reguler, namun nilai yang ditampilkan di sini
 * adalah NILAI MURNI yang diinput oleh dosen/admin (remidiScore), BUKAN nilai 60 yang dibatasi untuk mahasiswa,
 * karena institusi membutuhkan rekap arsip nilai ujian remidi sebenarnya (misal dapat 85, 90, 100).
 */
export const getClassRemidiRecap = async (
  classId: string,
  yearId: string
): Promise<{ subjects: MasterSubject[], rows: ClassRemidiRecapRow[] }> => {
  const enrollments = ENROLLMENTS.filter(e => e.classId === classId);
  const classSubjects = CLASS_SUBJECTS.filter(cs => cs.classId === classId);
  const masterSubjects: MasterSubject[] = [];
  const csToMaster = new Map<string, string>();

  classSubjects.forEach(cs => {
    const m = MASTER_SUBJECTS.find(x => x.id === cs.masterSubjectId);
    if (m) {
      if (!masterSubjects.some(x => x.id === m.id)) {
        masterSubjects.push(m);
      }
      csToMaster.set(cs.id, m.id);
    }
  });

  // Sinkronisasi data remidi tahun ini
  syncAndGetRemidiCandidates(yearId, 'BOTH');
  const remidiMap = new Map<string, RemidiRecord>();
  REMIDI_RECORDS.forEach(r => {
    if (r.academicYearId === yearId && r.classId === classId) {
      remidiMap.set(`${r.classSubjectId}_${r.studentId}_${r.semester}`, r);
    }
  });

  const rows = enrollments.map(enr => {
    const student = USERS.find(u => u.id === enr.studentId);
    if (!student) return null;

    const row: ClassRemidiRecapRow = {
      student,
      grades: {},
      totalScore: 0,
      finalAverage: 0,
      hasRemidi: false,
      remidiDetails: {}
    };

    let sum = 0, count = 0;

    classSubjects.forEach(cs => {
      const masterId = csToMaster.get(cs.id);
      if (!masterId) return;

      const g = GRADES.find(x => x.enrollmentId === enr.id && x.classSubjectId === cs.id);
      const sem1Raw = g ? (Number(g.sem1_uts) || 0) + (Number(g.sem1_uas) || 0) : 0;
      const sem2Raw = g ? (Number(g.sem2_uts) || 0) + (Number(g.sem2_uas) || 0) : 0;

      // Cari record remidi
      const rem1 = remidiMap.get(`${cs.id}_${enr.studentId}_1`);
      const rem2 = remidiMap.get(`${cs.id}_${enr.studentId}_2`);

      const hasRem1 = Boolean(rem1 && rem1.isEligible && rem1.remidiScore !== undefined);
      const hasRem2 = Boolean(rem2 && rem2.isEligible && rem2.remidiScore !== undefined);

      if (hasRem1 || hasRem2) {
        row.hasRemidi = true;
      }

      // NILAI MURNI / ASLI YANG DIINPUT OLEH DOSEN/ADMIN:
      const effectiveSem1 = hasRem1 ? Number(rem1!.remidiScore) : sem1Raw;
      const effectiveSem2 = hasRem2 ? Number(rem2!.remidiScore) : sem2Raw;
      const effectiveAvg = (effectiveSem1 + effectiveSem2) / 2;

      row.grades[masterId] = {
        sem1: effectiveSem1,
        sem2: effectiveSem2,
        avg: effectiveAvg
      };

      row.remidiDetails[masterId] = {
        isRemidiSem1: hasRem1,
        initialSem1: rem1?.initialScore,
        pureRemidiSem1: rem1?.remidiScore,
        isRemidiSem2: hasRem2,
        initialSem2: rem2?.initialScore,
        pureRemidiSem2: rem2?.remidiScore
      };

      sum += effectiveAvg;
      count++;
    });

    row.totalScore = sum;
    row.finalAverage = count > 0 ? sum / count : 0;
    return row;
  }).filter(r => r !== null) as ClassRemidiRecapRow[];

  rows.sort((a, b) => a.student.name.localeCompare(b.student.name));
  return { subjects: masterSubjects, rows };
};
