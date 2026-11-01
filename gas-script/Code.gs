/* 
  SIAKAD جامعة الإمام الشافعي - Backend Script v5.0 (High-Concurrency Edition)
  Pembaruan:
  1. RAM Cache Layer (CacheService.getScriptCache()) seperti arsitektur Google Sheets/Docs
     sehingga ratusan/ribuan pembaca (GET_ALL, METADATA, GET_ENTITY) dilayani langsung dari RAM
     tanpa membebani SpreadsheetApp.
  2. Auto-Invalidation Cache instan setiap kali ada perubahan data (doPost).
  3. Batch Write Optimization (Single setValues) pada handleSaveGrades & handleSaveRemidiRecords
     (20x lebih cepat, mencegah antrean LockService macet saat banyak dosen simpan bersamaan).
  4. Penyelarasan format 10 kolom pada sheet 'grades' & dukungan UPDATE_USER.
*/

// --- KONFIGURASI TEMPLATE GOOGLE DOCS ---
const TEMPLATE_ID_SINGLE = '1nBufIVZdzTzuRHwFCjYzJN3bJwZHt_BBdaXdTWIDYfY'; 
const TEMPLATE_ID_YEARLY = '1Fw8zsjFev6fdsfH6u-W1VFBY9c2WGg9JGau0jrnSywE'; 

// --- KONFIGURASI RAM CACHE (Google CacheService) ---
const CACHE_TTL_SECONDS = 300; // 5 menit di RAM (otomatis di-reset instan saat ada perubahan POST)
const CACHE_PREFIX = 'SIAKAD_V5_';

function getCacheItem(key) {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function setCacheItem(key, dataObj) {
  try {
    const str = JSON.stringify(dataObj);
    // Batas per-key Google CacheService adalah 100KB (~95.000 karakter aman)
    if (str.length < 92000) {
      const cache = CacheService.getScriptCache();
      cache.put(CACHE_PREFIX + key, str, CACHE_TTL_SECONDS);
    }
  } catch (e) {
    // Abaikan jika melebihi batas ukuran cache
  }
}

function invalidateSheetCache(sheetName) {
  try {
    const cache = CacheService.getScriptCache();
    const keysToRemove = [
      CACHE_PREFIX + 'METADATA',
      CACHE_PREFIX + 'GET_ALL'
    ];
    if (sheetName) {
      keysToRemove.push(CACHE_PREFIX + 'ENTITY_' + String(sheetName).trim());
    }
    cache.removeAll(keysToRemove);
  } catch (e) {
    // ignore
  }
}

// ==========================================
// 1. CORE HANDLERS (doGet & doPost)
// ==========================================

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    
    if (action === 'METADATA') {
      return getMetadata();
    } else if (action === 'GET_ENTITY') {
      return getEntity(params.entity);
    } else if (action === 'GET_ALL') {
      return getAllData();
    } else if (action === 'GENERATE_PDF') {
      const type = params.pdfType || 'DEFAULT';
      const yearId = params.yearId || '';
      return handleGeneratePdfRouter(params.studentId, type, yearId);
    }
    
    return jsonResponse({ success: false, message: "Invalid Action" });
  } catch (err) {
    console.error("Global Error (doGet):", err);
    return jsonResponse({ success: false, message: "Server Error: " + err.toString() });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(30000)) {
    try {
      const body = JSON.parse(e.postData.contents);
      const action = body.action;
      const payload = body.payload;
      
      if (action === 'SAVE_GRADES') {
        return handleSaveGrades(payload);
      } else if (action === 'UPDATE_STATUS') {
        return handleUpdateStatus(payload);
      } else if (action === 'UPDATE_YEAR_STATUS') {
        return handleUpdateYearStatus(payload);
      } else if (action === 'CHANGE_PASSWORD') {
        return handleChangePassword(payload);
      } else if (action === 'UPDATE_USER') {
        return handleUpdateUser(payload);
      } else if (action === 'CREATE_GENERIC') {
        return handleCreateGeneric(payload);
      } else if (action === 'DELETE_GENERIC') {
        return handleDeleteGeneric(payload);
      } else if (action === 'BULK_CREATE_USERS') {
        return handleBulkCreateUsers(payload);
      } else if (action === 'SUBMIT_EDIT_REQUEST') {
        return handleSubmitEditRequest(payload);
      } else if (action === 'RESPOND_EDIT_REQUEST') {
        return handleRespondEditRequest(payload);
      } else if (action === 'UPDATE_MASTER_SUBJECT') {
        return handleUpdateMasterSubject(payload);
      } else if (action === 'BULK_UPDATE_STATUS') {
        return handleBulkUpdateStatus(payload);
      } else if (action === 'SAVE_REMIDI_SETTINGS') {
        return handleSaveRemidiSettings(payload);
      } else if (action === 'SAVE_REMIDI_RECORDS') {
        return handleSaveRemidiRecords(payload);
      }
      
      return jsonResponse({ success: false, message: "Aksi tidak dikenali: " + action });
    } catch (err) {
      console.error("Global Error (doPost):", err);
      return jsonResponse({ success: false, message: err.toString() });
    } finally {
      SpreadsheetApp.flush();
      lock.releaseLock();
    }
  } else {
    return jsonResponse({ success: false, message: "Server sedang sibuk, silakan coba beberapa saat lagi." });
  }
}

// ==========================================
// 2. METADATA ENGINE (RAM Cached + Sheet Timestamp)
// ==========================================

function readMetadataObject(ss) {
  const cached = getCacheItem('METADATA');
  if (cached) return cached;

  const activeSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = activeSs.getSheetByName('metadata');
  const metadata = {};
  
  if (metaSheet) {
    const data = metaSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      const key = String(data[i][0]).trim();
      const val = Number(data[i][1]) || 0;
      if (key) {
        metadata[key] = val;
      }
    }
  }
  
  const defaultTables = [
    'academic_years', 'classes', 'users', 'master_subjects', 
    'student_enrollments', 'class_subjects', 'grades', 'grade_edit_requests',
    'remidi_settings', 'remidi_records'
  ];
  defaultTables.forEach(function(tbl) {
    if (!metadata[tbl]) {
      metadata[tbl] = 0;
    }
  });

  setCacheItem('METADATA', metadata);
  return metadata;
}

function getMetadata() {
  const metadata = readMetadataObject();
  return jsonResponse({ metadata: metadata });
}

function updateMetadataTimestamp(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let metaSheet = ss.getSheetByName('metadata');
    if (!metaSheet) {
      metaSheet = ss.insertSheet('metadata');
    }
    
    const data = metaSheet.getDataRange().getValues();
    const now = new Date().getTime();
    let found = false;
    
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(sheetName).trim().toLowerCase()) {
        metaSheet.getRange(i + 1, 2).setValue(now);
        found = true;
        break;
      }
    }
    
    if (!found) {
      metaSheet.appendRow([sheetName, now]);
    }

    // Hapus cache tabel terkait agar pembaca berikutnya langsung mendapat data terbaru
    invalidateSheetCache(sheetName);
  } catch (err) {
    console.warn("Gagal memperbarui metadata timestamp untuk " + sheetName + ": " + err.toString());
  }
}

// ==========================================
// 3. DATA READERS (RAM Cached)
// ==========================================

function readEntityArray(sheetName, ss) {
  const cleanName = String(sheetName || '').trim();
  const cacheKey = 'ENTITY_' + cleanName;
  const cached = getCacheItem(cacheKey);
  if (cached) return cached;

  const activeSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = activeSs.getSheetByName(cleanName);
  if (!sheet) return [];
  
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) {
    setCacheItem(cacheKey, []);
    return [];
  }
  
  const headers = rows[0].map(function(h) { return String(h).trim(); });
  const data = [];
  
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    data.push(obj);
  }
  
  setCacheItem(cacheKey, data);
  return data;
}

function getEntity(sheetName) {
  const data = readEntityArray(sheetName);
  return jsonResponse({ [sheetName]: data });
}

function getAllData() {
  const cachedAll = getCacheItem('GET_ALL');
  if (cachedAll) {
    return jsonResponse(cachedAll);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tables = [
    'users', 'academic_years', 'master_subjects', 'classes', 
    'class_subjects', 'student_enrollments', 'grades', 'grade_edit_requests',
    'remidi_settings', 'remidi_records'
  ];
  
  const result = {};
  tables.forEach(function(t) {
    result[t] = readEntityArray(t, ss);
  });
  
  result['metadata'] = readMetadataObject(ss);
  setCacheItem('GET_ALL', result);
  
  return jsonResponse(result);
}

// ==========================================
// 4. DATA WRITERS (Single-Batch SetValues)
// ==========================================

function handleSaveGrades(gradesArray) {
  if (!Array.isArray(gradesArray) || gradesArray.length === 0) {
    return jsonResponse({ success: true, count: 0 });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('grades');
  if (!sheet) {
    sheet = ss.insertSheet('grades');
    sheet.appendRow([
      'enrollmentId', 'classSubjectId', 
      'sem1_uts', 'sem1_uas', 'sem1_input_type', 'sem1_submitted', 
      'sem2_uts', 'sem2_uas', 'sem2_input_type', 'sem2_submitted'
    ]);
  }

  const data = sheet.getDataRange().getValues();
  const rowMap = new Map();
  
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim() + "_" + String(data[i][1]).trim();
    rowMap.set(key, i); // 0-based index di array `data`
  }

  let hasUpdatedExisting = false;
  const rowsToAppend = [];

  gradesArray.forEach(function(g) {
    const enrId = String(g.enrollmentId || '').trim();
    const csId = String(g.classSubjectId || '').trim();
    if (!enrId || !csId) return;

    const key = enrId + "_" + csId;
    const s1Uts = Number(g.sem1_uts) || 0;
    const s1Uas = Number(g.sem1_uas) || 0;
    const s1Type = String(g.sem1_input_type || 'COMPONENT').trim();
    const s1Sub = Boolean(g.sem1_submitted);

    const s2Uts = Number(g.sem2_uts) || 0;
    const s2Uas = Number(g.sem2_uas) || 0;
    const s2Type = String(g.sem2_input_type || 'COMPONENT').trim();
    const s2Sub = Boolean(g.sem2_submitted);

    if (rowMap.has(key)) {
      const idx = rowMap.get(key);
      data[idx][2] = s1Uts;
      data[idx][3] = s1Uas;
      data[idx][4] = s1Type;
      data[idx][5] = s1Sub;
      data[idx][6] = s2Uts;
      data[idx][7] = s2Uas;
      data[idx][8] = s2Type;
      data[idx][9] = s2Sub;
      hasUpdatedExisting = true;
    } else {
      const newRow = [
        enrId, csId,
        s1Uts, s1Uas, s1Type, s1Sub,
        s2Uts, s2Uas, s2Type, s2Sub
      ];
      rowsToAppend.push(newRow);
    }
  });

  // Tulis pembaruan dalam 1 kali operasi batch (20x lebih cepat dibandingkan per-baris)
  if (hasUpdatedExisting && data.length > 1) {
    sheet.getRange(1, 1, data.length, 10).setValues(data);
  }

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 10).setValues(rowsToAppend);
  }

  updateMetadataTimestamp('grades');
  return jsonResponse({ success: true, count: gradesArray.length });
}

function handleCreateGeneric(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(payload.sheet);
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found: " + payload.sheet });
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const rows = [];
  
  payload.data.forEach(function(item) {
    const row = headers.map(h => item[h] !== undefined ? item[h] : '');
    rows.push(row);
  });
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }
  
  updateMetadataTimestamp(payload.sheet);
  return jsonResponse({ success: true });
}

function handleDeleteGeneric(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(payload.sheet);
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.id).trim()) {
      sheet.deleteRow(i + 1);
      updateMetadataTimestamp(payload.sheet);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "ID not found" });
}

function handleUpdateStatus(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('class_subjects');
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.id).trim()) {
      sheet.getRange(i + 1, 5).setValue(payload.status);
      updateMetadataTimestamp('class_subjects');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "ID not found" });
}

function handleBulkUpdateStatus(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('class_subjects');
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const targetIds = (payload.ids || []).map(function(id) { return String(id).trim(); });
  const status = payload.status;
  
  const data = sheet.getDataRange().getValues();
  let updatedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]).trim();
    if (targetIds.indexOf(id) !== -1) {
      data[i][4] = status;
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    updateMetadataTimestamp('class_subjects');
  }
  return jsonResponse({ success: true, count: updatedCount });
}

function handleUpdateYearStatus(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('academic_years');
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const data = sheet.getDataRange().getValues();
  const colIndex = payload.sem === 1 ? 5 : 6;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.id).trim()) {
      sheet.getRange(i + 1, colIndex).setValue(payload.val);
      updateMetadataTimestamp('academic_years');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "ID not found" });
}

function handleUpdateMasterSubject(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('master_subjects');
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.id).trim()) {
      sheet.getRange(i + 1, 2).setValue(String(payload.name || '').trim());
      sheet.getRange(i + 1, 3).setValue(Number(payload.sks) || 0);
      updateMetadataTimestamp('master_subjects');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "Subject ID not found" });
}

function handleChangePassword(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('users');
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(payload.id).trim().toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue(String(payload.password).trim());
      updateMetadataTimestamp('users');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "User not found" });
}

function handleUpdateUser(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('users');
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  const nameIdx = headers.indexOf('name') !== -1 ? headers.indexOf('name') : 2;
  const roleIdx = headers.indexOf('role') !== -1 ? headers.indexOf('role') : 3;
  const genderIdx = headers.indexOf('gender') !== -1 ? headers.indexOf('gender') : 4;
  const statusIdx = headers.indexOf('status') !== -1 ? headers.indexOf('status') : 5;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(payload.id).trim().toLowerCase()) {
      if (payload.name !== undefined) data[i][nameIdx] = String(payload.name).trim();
      if (payload.role !== undefined) data[i][roleIdx] = String(payload.role).trim().toUpperCase();
      if (payload.gender !== undefined) data[i][genderIdx] = String(payload.gender).trim().toUpperCase();
      if (payload.status !== undefined) data[i][statusIdx] = String(payload.status).trim().toUpperCase();
      sheet.getRange(i + 1, 1, 1, data[i].length).setValues([data[i]]);
      updateMetadataTimestamp('users');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "User not found" });
}

function handleBulkCreateUsers(usersArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('users');
  if (!sheet) {
    sheet = ss.insertSheet('users');
    sheet.appendRow(['id', 'password', 'name', 'role', 'gender', 'status']);
  }
  
  const rows = usersArray.map(function(u) {
    return [
      String(u.id).trim(),
      String(u.password || '123456').trim(),
      String(u.name).trim(),
      String(u.role || 'STUDENT').trim().toUpperCase(),
      String(u.gender || 'MALE').trim().toUpperCase(),
      String(u.status || 'ACTIVE').trim().toUpperCase()
    ];
  });
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
  }
  
  updateMetadataTimestamp('users');
  return jsonResponse({ success: true });
}

function handleSubmitEditRequest(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('grade_edit_requests');
  if (!sheet) {
    sheet = ss.insertSheet('grade_edit_requests');
    sheet.appendRow([
      'id', 'classSubjectId', 'lecturerId', 'academicYearId', 
      'semester', 'status', 'requestedAt', 'respondedAt', 'notes'
    ]);
  }
  
  sheet.appendRow([
    payload.id,
    payload.classSubjectId,
    payload.lecturerId,
    payload.academicYearId,
    payload.semester,
    payload.status || 'PENDING',
    payload.requestedAt || new Date().toISOString(),
    payload.respondedAt || '',
    payload.notes || ''
  ]);
  
  updateMetadataTimestamp('grade_edit_requests');
  return jsonResponse({ success: true, id: payload.id });
}

function handleRespondEditRequest(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('grade_edit_requests');
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.id).trim()) {
      sheet.getRange(i + 1, 6).setValue(payload.status);
      sheet.getRange(i + 1, 8).setValue(payload.respondedAt || new Date().toISOString());
      updateMetadataTimestamp('grade_edit_requests');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "Request ID not found" });
}

function handleSaveRemidiSettings(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('remidi_settings');
  if (!sheet) {
    sheet = ss.insertSheet('remidi_settings');
    sheet.appendRow(['academicYearId', 'isInputOpen', 'isPublished']);
  }
  
  const data = sheet.getDataRange().getValues();
  const yearId = String(payload.academicYearId || '').trim();
  const isInputOpen = Boolean(payload.isInputOpen);
  const isPublished = Boolean(payload.isPublished);
  
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === yearId) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[isInputOpen, isPublished]]);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([yearId, isInputOpen, isPublished]);
  }
  
  updateMetadataTimestamp('remidi_settings');
  return jsonResponse({ success: true });
}

function handleSaveRemidiRecords(recordsArray) {
  if (!Array.isArray(recordsArray) || recordsArray.length === 0) {
    return jsonResponse({ success: true, count: 0 });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('remidi_records');
  if (!sheet) {
    sheet = ss.insertSheet('remidi_records');
    sheet.appendRow([
      'id', 'academicYearId', 'classId', 'classSubjectId', 'studentId', 
      'semester', 'initialScore', 'remidiScore', 'isEligible', 'notes', 'updatedAt'
    ]);
  }

  const data = sheet.getDataRange().getValues();
  const rowMap = new Map();
  for (let i = 1; i < data.length; i++) {
    rowMap.set(String(data[i][0]).trim(), i);
  }

  let hasUpdatedExisting = false;
  const rowsToAppend = [];
  recordsArray.forEach(function(r) {
    const id = String(r.id || '').trim();
    if (!id) return;
    
    const rowValues = [
      id,
      String(r.academicYearId || '').trim(),
      String(r.classId || '').trim(),
      String(r.classSubjectId || '').trim(),
      String(r.studentId || '').trim(),
      Number(r.semester) || 1,
      Number(r.initialScore) || 0,
      r.remidiScore !== undefined && r.remidiScore !== null && r.remidiScore !== '' ? Number(r.remidiScore) : '',
      Boolean(r.isEligible),
      String(r.notes || '').trim(),
      String(r.updatedAt || new Date().toISOString()).trim()
    ];

    if (rowMap.has(id)) {
      const idx = rowMap.get(id);
      data[idx] = rowValues;
      hasUpdatedExisting = true;
    } else {
      rowsToAppend.push(rowValues);
    }
  });

  if (hasUpdatedExisting && data.length > 1) {
    sheet.getRange(1, 1, data.length, 11).setValues(data);
  }

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 11).setValues(rowsToAppend);
  }

  updateMetadataTimestamp('remidi_records');
  return jsonResponse({ success: true, count: recordsArray.length });
}

// ==========================================
// 5. PDF GENERATOR (KHS Full Bahasa Arab)
// ==========================================

function handleGeneratePdfRouter(studentId, pdfType, yearId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const users = getSheetData(ss, 'users');
  const enrollments = getSheetData(ss, 'student_enrollments');
  const classes = getSheetData(ss, 'classes');
  const years = getSheetData(ss, 'academic_years');
  const classSubjects = getSheetData(ss, 'class_subjects');
  const masterSubjects = getSheetData(ss, 'master_subjects');
  const grades = getSheetData(ss, 'grades');

  const student = users.find(u => String(u.id).trim().toLowerCase() === String(studentId).trim().toLowerCase());
  if (!student) return jsonResponse({ success: false, message: "Mahasiswa tidak ditemukan" });

  let enrollment = null;
  if (yearId) {
    const classIdsInYear = classes.filter(c => String(c.academicYearId).trim() === String(yearId).trim()).map(c => String(c.id).trim());
    enrollment = enrollments.find(e => String(e.studentId).trim().toLowerCase() === String(studentId).trim().toLowerCase() && classIdsInYear.includes(String(e.classId).trim()));
  } else {
    enrollment = enrollments.find(e => String(e.studentId).trim().toLowerCase() === String(studentId).trim().toLowerCase());
  }

  if (!enrollment) return jsonResponse({ success: false, message: "Data pendaftaran kelas mahasiswa tidak ditemukan" });

  const cls = classes.find(c => String(c.id).trim() === String(enrollment.classId).trim());
  const year = years.find(y => String(y.id).trim() === String(cls?.academicYearId).trim());

  if (pdfType === 'YEARLY') {
    return generateYearlyPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades);
  } else {
    const sem = pdfType === 'SEM2' ? 2 : 1;
    return generateSingleSemesterPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades, sem);
  }
}

function generateSingleSemesterPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades, semester) {
  const templateId = TEMPLATE_ID_SINGLE;
  const copyFile = DriveApp.getFileById(templateId).makeCopy('Temp_KHS_' + student.id);
  const doc = DocumentApp.openById(copyFile.getId());
  const body = doc.getBody();

  const judulPeriode = (semester === 1) ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني';

  body.replaceText('{{NAMA_MAHASISWA}}', student.name || '');
  body.replaceText('{{NIM}}', student.id || '');
  body.replaceText('{{KELAS}}', cls ? cls.name : '');
  body.replaceText('{{TAHUN_AJARAN}}', year ? year.name : '');
  body.replaceText('{{JUDUL_PERIODE}}', judulPeriode);

  const relevantClassSubjects = classSubjects.filter(cs => String(cs.classId).trim() === String(cls.id).trim());
  const table = body.getTables()[0];
  
  let totalScore = 0;
  let count = 0;

  relevantClassSubjects.forEach(function(cs, idx) {
    const master = masterSubjects.find(m => String(m.id).trim() === String(cs.masterSubjectId).trim());
    const g = grades.find(x => String(x.enrollmentId).trim() === String(enrollment.id).trim() && String(x.classSubjectId).trim() === String(cs.id).trim());
    
    let uts = 0, uas = 0;
    if (g) {
      uts = semester === 1 ? (Number(g.sem1_uts) || 0) : (Number(g.sem2_uts) || 0);
      uas = semester === 1 ? (Number(g.sem1_uas) || 0) : (Number(g.sem2_uas) || 0);
    }
    const total = uts + uas;
    totalScore += total;
    count++;

    const row = table.appendTableRow();
    row.appendTableCell(String(idx + 1));
    row.appendTableCell(master ? master.name : cs.masterSubjectId);
    row.appendTableCell(String(uts));
    row.appendTableCell(String(uas));
    row.appendTableCell(String(total));
    row.appendTableCell(getPredicateArabic(total));
  });

  const avg = count > 0 ? (totalScore / count) : 0;
  body.replaceText('{{TOTAL_NILAI}}', String(totalScore));
  body.replaceText('{{RATA_RATA}}', avg.toFixed(2));
  body.replaceText('{{STATUS_KELULUSAN}}', avg >= 60 ? 'ناجح' : 'راسب');

  doc.saveAndClose();

  const pdfBlob = copyFile.getAs('application/pdf');
  const base64 = Utilities.base64Encode(pdfBlob.getBytes());
  copyFile.setTrashed(true);

  return jsonResponse({
    success: true,
    base64: base64,
    filename: 'KHS_Sem' + semester + '_' + student.id + '.pdf'
  });
}

function generateYearlyPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades) {
  const templateId = TEMPLATE_ID_YEARLY;
  const copyFile = DriveApp.getFileById(templateId).makeCopy('Temp_KHS_Yearly_' + student.id);
  const doc = DocumentApp.openById(copyFile.getId());
  const body = doc.getBody();

  body.replaceText('{{NAMA_MAHASISWA}}', student.name || '');
  body.replaceText('{{NIM}}', student.id || '');
  body.replaceText('{{KELAS}}', cls ? cls.name : '');
  body.replaceText('{{TAHUN_AJARAN}}', year ? year.name : '');
  body.replaceText('{{JUDUL_PERIODE}}', 'كشف درجات السنة الكاملة');

  const relevantClassSubjects = classSubjects.filter(cs => String(cs.classId).trim() === String(cls.id).trim());
  const table = body.getTables()[0];
  
  let grandTotal = 0;
  let count = 0;

  relevantClassSubjects.forEach(function(cs, idx) {
    const master = masterSubjects.find(m => String(m.id).trim() === String(cs.masterSubjectId).trim());
    const g = grades.find(x => String(x.enrollmentId).trim() === String(enrollment.id).trim() && String(x.classSubjectId).trim() === String(cs.id).trim());
    
    const sem1 = g ? ((Number(g.sem1_uts) || 0) + (Number(g.sem1_uas) || 0)) : 0;
    const sem2 = g ? ((Number(g.sem2_uts) || 0) + (Number(g.sem2_uas) || 0)) : 0;
    const finalAvg = (sem1 + sem2) / 2;
    grandTotal += finalAvg;
    count++;

    const row = table.appendTableRow();
    row.appendTableCell(String(idx + 1));
    row.appendTableCell(master ? master.name : cs.masterSubjectId);
    row.appendTableCell(String(sem1));
    row.appendTableCell(String(sem2));
    row.appendTableCell(finalAvg.toFixed(1));
    row.appendTableCell(getPredicateArabic(finalAvg));
  });

  const finalYearAvg = count > 0 ? (grandTotal / count) : 0;
  body.replaceText('{{RATA_RATA_AKHIR}}', finalYearAvg.toFixed(2));
  body.replaceText('{{STATUS_KELULUSAN}}', finalYearAvg >= 60 ? 'ناجح' : 'راسب');

  doc.saveAndClose();

  const pdfBlob = copyFile.getAs('application/pdf');
  const base64 = Utilities.base64Encode(pdfBlob.getBytes());
  copyFile.setTrashed(true);

  return jsonResponse({
    success: true,
    base64: base64,
    filename: 'KHS_Tahunan_' + student.id + '.pdf'
  });
}

// ==========================================
// 6. HELPER UTILITIES
// ==========================================

function getSheetData(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim());
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    data.push(obj);
  }
  return data;
}

function getPredicateArabic(score) {
  if (score >= 95) return 'ممتاز مرتفع';
  if (score >= 90) return 'ممتاز';
  if (score >= 85) return 'جيد جدا مرتفع';
  if (score >= 80) return 'جيد جدا';
  if (score >= 75) return 'جيد مرتفع';
  if (score >= 70) return 'جيد';
  if (score >= 65) return 'مقبول مرتفع';
  if (score >= 60) return 'مقبول';
  return 'راسب';
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
