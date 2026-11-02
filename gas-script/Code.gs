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

// --- KONFIGURASI TEMPLATE GOOGLE DOCS (MAHASISWA) ---
const TEMPLATE_ID_SINGLE = '1nBufIVZdzTzuRHwFCjYzJN3bJwZHt_BBdaXdTWIDYfY'; 
const TEMPLATE_ID_YEARLY = '1Fw8zsjFev6fdsfH6u-W1VFBY9c2WGg9JGau0jrnSywE'; 

// --- KONFIGURASI TEMPLATE GOOGLE DOCS (DOSEN) ---
const TEMPLATE_ID_LECTURER_SINGLE = '1hGMJQxaJr_3JbZpuD4u3rjsXPJs9OVLAubDq9oNc7KA';
const TEMPLATE_ID_LECTURER_YEARLY = '1fKv2IWZMrucobbdZQdCUmsBhSxSl4R_-woihmhPY1l0';

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
    } else if (action === 'GENERATE_LECTURER_PDF') {
      const pdfType = params.pdfType || (Number(params.semester) === 2 ? 'SEM2' : 'SEM1');
      const yearId = params.yearId || '';
      return handleGenerateLecturerPdfRouter(params.classSubjectId, pdfType, yearId);
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
      } else if (action === 'SYNC_RECAP_SHEET') {
        return handleSyncRecapSheet(payload);
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

  // Pastikan sheet 'rekap_nilai' otomatis dibuat jika belum ada di Spreadsheet
  ensureRecapSheetExists(ss);
  
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
  syncRecapSheetIfActive(ss);
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
  syncRecapSheetIfActive(ss);
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
  const remidiSettings = getSheetData(ss, 'remidi_settings');
  const remidiRecords = getSheetData(ss, 'remidi_records');

  const student = users.find(u => String(u.id).trim().toLowerCase() === String(studentId).trim().toLowerCase());
  if (!student) return jsonResponse({ success: false, message: "Mahasiswa tidak ditemukan" });

  let enrollment = null;
  if (yearId) {
    const classIdsInYear = classes
      .filter(c => String(c.academicYearId).trim() === String(yearId).trim())
      .map(c => String(c.id).trim());
    enrollment = enrollments.find(e =>
      String(e.studentId).trim().toLowerCase() === String(studentId).trim().toLowerCase() &&
      classIdsInYear.includes(String(e.classId).trim())
    );
  } else {
    enrollment = enrollments.find(e => String(e.studentId).trim().toLowerCase() === String(studentId).trim().toLowerCase());
  }

  if (!enrollment) return jsonResponse({ success: false, message: "Data pendaftaran kelas mahasiswa tidak ditemukan" });

  const cls = classes.find(c => String(c.id).trim() === String(enrollment.classId).trim());
  const year = findAcademicYear(years, cls, yearId);
  const activeYearId = year ? String(year.id).trim() : String(yearId || '').trim();

  const yearRemidiSetting = remidiSettings.find(rs => String(rs.academicYearId).trim() === activeYearId);
  const isRemidiPublished = Boolean(
    yearRemidiSetting &&
    (yearRemidiSetting.isPublished === true || String(yearRemidiSetting.isPublished).toLowerCase() === 'true')
  );

  if (pdfType === 'YEARLY') {
    return generateYearlyPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades, isRemidiPublished, remidiRecords);
  } else {
    const sem = pdfType === 'SEM2' ? 2 : 1;
    return generateSingleSemesterPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades, sem, isRemidiPublished, remidiRecords);
  }
}

function findAcademicYear(years, cls, yearIdParam) {
  if (!Array.isArray(years) || years.length === 0) return null;
  const clsYearId = cls && cls.academicYearId !== undefined ? String(cls.academicYearId).trim() : '';
  const paramYearId = yearIdParam !== undefined && yearIdParam !== null ? String(yearIdParam).trim() : '';

  let year = null;
  if (clsYearId) {
    year = years.find(y => String(y.id).trim() === clsYearId || String(y.name).trim() === clsYearId);
  }
  if (!year && paramYearId) {
    year = years.find(y => String(y.id).trim() === paramYearId || String(y.name).trim() === paramYearId);
  }
  if (!year) {
    year = years.find(y => y.isActive === true || String(y.isActive).toLowerCase() === 'true');
  }
  if (!year) {
    year = years[years.length - 1];
  }
  return year;
}

function resolveSemesterScoreWithRemidi(studentId, yearId, classSubjectId, semester, rawScore, isRemidiPublished, remidiRecords) {
  if (!isRemidiPublished || !Array.isArray(remidiRecords)) return rawScore;
  const rec = remidiRecords.find(function(r) {
    const isElig = r.isEligible === true || String(r.isEligible).toLowerCase() === 'true';
    const hasScore = r.remidiScore !== undefined && r.remidiScore !== null && String(r.remidiScore).trim() !== '';
    return String(r.academicYearId).trim() === String(yearId).trim() &&
           String(r.classSubjectId).trim() === String(classSubjectId).trim() &&
           String(r.studentId).trim().toLowerCase() === String(studentId).trim().toLowerCase() &&
           Number(r.semester) === Number(semester) &&
           isElig &&
           hasScore;
  });
  if (rec) {
    const rScore = Number(rec.remidiScore);
    if (!isNaN(rScore)) {
      return rScore >= 60 ? 60 : rScore;
    }
  }
  return rawScore;
}

function formatArabicDate(dateObj) {
  const monthsArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const d = dateObj || new Date();
  const day = Utilities.formatDate(d, 'Asia/Jakarta', 'd');
  const monthIdx = Number(Utilities.formatDate(d, 'Asia/Jakarta', 'M')) - 1;
  const year = Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy');
  return day + ' ' + (monthsArabic[monthIdx] || '') + ' ' + year + ' م';
}

function replaceDocumentPlaceholders(doc, replacements) {
  const body = doc.getBody();
  const header = doc.getHeader();
  const footer = doc.getFooter();

  Object.keys(replacements).forEach(function(placeholder) {
    const val = String(replacements[placeholder] !== undefined && replacements[placeholder] !== null ? replacements[placeholder] : '');
    const rawKey = String(placeholder).replace(/[{}]/g, '').trim();
    const rtlSafePattern = '[{}]+\\s*' + rawKey + '\\s*[{}]+';

    body.replaceText(placeholder, val);
    body.replaceText(rtlSafePattern, val);
    if (header) {
      header.replaceText(placeholder, val);
      header.replaceText(rtlSafePattern, val);
    }
    if (footer) {
      footer.replaceText(placeholder, val);
      footer.replaceText(rtlSafePattern, val);
    }
  });
}

function appendFormattedRow(table, cellValues) {
  const row = table.appendTableRow();
  for (let i = 0; i < cellValues.length; i++) {
    const cell = row.appendTableCell(String(cellValues[i]));
    cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    cell.setPaddingTop(3);
    cell.setPaddingBottom(3);
    cell.setPaddingLeft(5);
    cell.setPaddingRight(5);

    if (cell.getNumChildren() > 0) {
      const para = cell.getChild(0).asParagraph();
      para.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      para.setSpacingBefore(0);
      para.setSpacingAfter(0);
      para.setLineSpacing(1.0);
    }
  }
  return row;
}

// Gambar 1: KHS Semester 1 atau Semester 2 (3 Kolom: الرقم | أسماء المواد | الدرجة)
function generateSingleSemesterPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades, semester, isRemidiPublished, remidiRecords) {
  const templateId = TEMPLATE_ID_SINGLE;
  const copyFile = DriveApp.getFileById(templateId).makeCopy('Temp_KHS_Sem' + semester + '_' + student.id);
  const doc = DocumentApp.openById(copyFile.getId());
  const body = doc.getBody();

  const judulPeriode = (semester === 1) ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني';
  const activeYearId = year ? String(year.id).trim() : '';

  const relevantClassSubjects = classSubjects.filter(cs => String(cs.classId).trim() === String(cls.id).trim());
  const table = body.getTables()[0];
  
  let totalScore = 0;
  let count = 0;

  relevantClassSubjects.forEach(function(cs, idx) {
    const master = masterSubjects.find(m => String(m.id).trim() === String(cs.masterSubjectId).trim());
    const g = grades.find(x =>
      String(x.enrollmentId).trim() === String(enrollment.id).trim() &&
      String(x.classSubjectId).trim() === String(cs.id).trim()
    );
    
    let uts = 0, uas = 0;
    if (g) {
      uts = semester === 1 ? (Number(g.sem1_uts) || 0) : (Number(g.sem2_uts) || 0);
      uas = semester === 1 ? (Number(g.sem1_uas) || 0) : (Number(g.sem2_uas) || 0);
    }
    const rawTotal = uts + uas;
    const finalSemScore = resolveSemesterScoreWithRemidi(
      student.id, activeYearId, cs.id, semester, rawTotal, isRemidiPublished, remidiRecords
    );

    totalScore += finalSemScore;
    count++;

    const subjectName = master ? master.name : cs.masterSubjectId;
    // Sesuai Gambar 1 (3 kolom RTL):
    // Kolom 0: الرقم (Nomor)
    // Kolom 1: أسماء المواد (Nama Mata Kuliah)
    // Kolom 2: الدرجة (Nilai Semester)
    appendFormattedRow(table, [
      String(idx + 1),
      String(subjectName || ''),
      String(finalSemScore)
    ]);
  });

  const avg = count > 0 ? (totalScore / count) : 0;
  const formattedGpa = avg.toFixed(2);
  const tanggalArab = formatArabicDate(new Date());

  replaceDocumentPlaceholders(doc, {
    '{{JUDUL_PERIODE}}': judulPeriode,
    '{{NAMA}}': student.name || '',
    '{{NAMA_MAHASISWA}}': student.name || '',
    '{{NIM}}': student.id || '',
    '{{KELAS}}': cls ? cls.name : '',
    '{{TAHUN_AJARAN}}': year ? year.name : '',
    '{{TAHUN_AKADEMIK}}': year ? year.name : '',
    '{{GPA}}': formattedGpa,
    '{{RATA_RATA}}': formattedGpa,
    '{{TOTAL_NILAI}}': String(totalScore),
    '{{TANGGAL}}': tanggalArab,
    '{{STATUS_KELULUSAN}}': avg >= 60 ? 'ناجح' : 'راسب'
  });

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

// Gambar 2: KHS Gabungan 2 Semester / Tahunan (5 Kolom: الرقم | أسماء المواد | ف(1) | ف(2) | المعدل)
function generateYearlyPdf(student, cls, year, enrollment, classSubjects, masterSubjects, grades, isRemidiPublished, remidiRecords) {
  const templateId = TEMPLATE_ID_YEARLY;
  const copyFile = DriveApp.getFileById(templateId).makeCopy('Temp_KHS_Yearly_' + student.id);
  const doc = DocumentApp.openById(copyFile.getId());
  const body = doc.getBody();

  const activeYearId = year ? String(year.id).trim() : '';
  const relevantClassSubjects = classSubjects.filter(cs => String(cs.classId).trim() === String(cls.id).trim());
  const table = body.getTables()[0];
  
  let grandTotal = 0;
  let count = 0;

  relevantClassSubjects.forEach(function(cs, idx) {
    const master = masterSubjects.find(m => String(m.id).trim() === String(cs.masterSubjectId).trim());
    const g = grades.find(x =>
      String(x.enrollmentId).trim() === String(enrollment.id).trim() &&
      String(x.classSubjectId).trim() === String(cs.id).trim()
    );
    
    const rawSem1 = g ? ((Number(g.sem1_uts) || 0) + (Number(g.sem1_uas) || 0)) : 0;
    const rawSem2 = g ? ((Number(g.sem2_uts) || 0) + (Number(g.sem2_uas) || 0)) : 0;

    const sem1 = resolveSemesterScoreWithRemidi(
      student.id, activeYearId, cs.id, 1, rawSem1, isRemidiPublished, remidiRecords
    );
    const sem2 = resolveSemesterScoreWithRemidi(
      student.id, activeYearId, cs.id, 2, rawSem2, isRemidiPublished, remidiRecords
    );

    const finalAvg = (sem1 + sem2) / 2;
    grandTotal += finalAvg;
    count++;

    const subjectName = master ? master.name : cs.masterSubjectId;
    const formattedSubAvg = Number.isInteger(finalAvg) ? String(finalAvg) : finalAvg.toFixed(1);

    // Sesuai Gambar 2 (5 kolom RTL):
    // Kolom 0: الرقم (Nomor)
    // Kolom 1: أسماء المواد (Nama Mata Kuliah)
    // Kolom 2: ف(1) (Nilai Semester 1)
    // Kolom 3: ف(2) (Nilai Semester 2)
    // Kolom 4: المعدل (Rata-rata Mata Kuliah)
    appendFormattedRow(table, [
      String(idx + 1),
      String(subjectName || ''),
      String(sem1),
      String(sem2),
      formattedSubAvg
    ]);
  });

  const finalYearAvg = count > 0 ? (grandTotal / count) : 0;
  const formattedGpa = finalYearAvg.toFixed(2);
  const tanggalArab = formatArabicDate(new Date());

  replaceDocumentPlaceholders(doc, {
    '{{JUDUL_PERIODE}}': 'الفصل الدراسي الأول والثاني',
    '{{NAMA}}': student.name || '',
    '{{NAMA_MAHASISWA}}': student.name || '',
    '{{NIM}}': student.id || '',
    '{{KELAS}}': cls ? cls.name : '',
    '{{TAHUN_AJARAN}}': year ? year.name : '',
    '{{TAHUN_AKADEMIK}}': year ? year.name : '',
    '{{GPA}}': formattedGpa,
    '{{RATA_RATA}}': formattedGpa,
    '{{RATA_RATA_AKHIR}}': formattedGpa,
    '{{TANGGAL}}': tanggalArab,
    '{{STATUS_KELULUSAN}}': finalYearAvg >= 60 ? 'ناجح' : 'راسب'
  });

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

// =========================================================================
// REKAP NILAI MATA KULIAH UNTUK DOSEN (SEMESTER 1/2 & GABUNGAN 2 SEMESTER)
// =========================================================================
function handleGenerateLecturerPdfRouter(classSubjectId, pdfType, yearId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = getSheetData(ss, 'users');
  const enrollments = getSheetData(ss, 'student_enrollments');
  const classes = getSheetData(ss, 'classes');
  const years = getSheetData(ss, 'academic_years');
  const classSubjects = getSheetData(ss, 'class_subjects');
  const masterSubjects = getSheetData(ss, 'master_subjects');
  const grades = getSheetData(ss, 'grades');
  const remidiSettings = getSheetData(ss, 'remidi_settings');
  const remidiRecords = getSheetData(ss, 'remidi_records');

  const cs = classSubjects.find(x => String(x.id).trim() === String(classSubjectId).trim());
  if (!cs) {
    return jsonResponse({ success: false, message: "Mata kuliah kelas tidak ditemukan" });
  }

  const master = masterSubjects.find(m => String(m.id).trim() === String(cs.masterSubjectId).trim());
  const lecturer = users.find(u => String(u.id).trim().toLowerCase() === String(cs.lecturerId).trim().toLowerCase());
  const cls = classes.find(c => String(c.id).trim() === String(cs.classId).trim());
  const year = findAcademicYear(years, cls, yearId);
  const activeYearId = year ? String(year.id).trim() : String(yearId || '').trim();

  const yearRemidiSetting = remidiSettings.find(rs => String(rs.academicYearId).trim() === activeYearId);
  const isRemidiPublished = Boolean(
    yearRemidiSetting &&
    (yearRemidiSetting.isPublished === true || String(yearRemidiSetting.isPublished).toLowerCase() === 'true')
  );

  const classEnrollments = enrollments.filter(e => String(e.classId).trim() === String(cs.classId).trim());

  if (pdfType === 'YEARLY') {
    return generateLecturerYearlyPdf(cs, master, lecturer, cls, year, activeYearId, classEnrollments, users, grades, isRemidiPublished, remidiRecords);
  } else {
    const semester = (pdfType === 'SEM2' || String(pdfType) === '2') ? 2 : 1;
    return generateLecturerSingleSemesterPdf(cs, master, lecturer, cls, year, activeYearId, classEnrollments, users, grades, semester, isRemidiPublished, remidiRecords);
  }
}

// 1. Rekap Dosen Semester 1 atau Semester 2
// Tabel 4 Kolom RTL: الرقم | اسم الطالب | الدرجة | البيان (ناجح / راسب)
function generateLecturerSingleSemesterPdf(cs, master, lecturer, cls, year, activeYearId, classEnrollments, users, grades, semester, isRemidiPublished, remidiRecords) {
  if (!TEMPLATE_ID_LECTURER_SINGLE || TEMPLATE_ID_LECTURER_SINGLE === 'ISI_ID_TEMPLATE_DOSEN_SEMESTER_DISINI') {
    return jsonResponse({
      success: false,
      message: "ID Template Google Docs Dosen Semester (TEMPLATE_ID_LECTURER_SINGLE) belum diisi di Code.gs"
    });
  }

  const studentRows = [];
  classEnrollments.forEach(function(enr) {
    const st = users.find(u => String(u.id).trim().toLowerCase() === String(enr.studentId).trim().toLowerCase());
    if (!st) return;

    const g = grades.find(x =>
      String(x.enrollmentId).trim() === String(enr.id).trim() &&
      String(x.classSubjectId).trim() === String(cs.id).trim()
    );

    let uts = 0, uas = 0;
    if (g) {
      uts = semester === 1 ? (Number(g.sem1_uts) || 0) : (Number(g.sem2_uts) || 0);
      uas = semester === 1 ? (Number(g.sem1_uas) || 0) : (Number(g.sem2_uas) || 0);
    }
    const rawScore = uts + uas;
    const finalScore = resolveSemesterScoreWithRemidi(
      st.id, activeYearId, cs.id, semester, rawScore, isRemidiPublished, remidiRecords
    );

    studentRows.push({
      studentId: String(st.id || ''),
      studentName: String(st.name || ''),
      score: finalScore,
      statusText: finalScore >= 60 ? 'ناجح' : 'راسب',
      isPassed: finalScore >= 60
    });
  });

  const copyFile = DriveApp.getFileById(TEMPLATE_ID_LECTURER_SINGLE).makeCopy('Temp_Dosen_Sem' + semester + '_' + cs.id);
  const doc = DocumentApp.openById(copyFile.getId());
  const body = doc.getBody();
  const table = body.getTables()[0];

  let totalScore = 0;
  let passedCount = 0;

  studentRows.forEach(function(item, idx) {
    totalScore += item.score;
    if (item.isPassed) passedCount++;

    // 4 Kolom RTL:
    // Kolom 0: الرقم (Nomor)
    // Kolom 1: اسم الطالب (Nama Mahasiswa)
    // Kolom 2: الدرجة (Nilai Semester)
    // Kolom 3: البيان / الحالة (Keterangan ناجح atau راسب)
    appendFormattedRow(table, [
      String(idx + 1),
      item.studentName,
      String(item.score),
      item.statusText
    ]);
  });

  const totalStudents = studentRows.length;
  const passRateNum = totalStudents > 0 ? ((passedCount / totalStudents) * 100) : 0;
  const passRateStr = (Number.isInteger(passRateNum) ? String(passRateNum) : passRateNum.toFixed(1)) + '%';
  const avgScore = totalStudents > 0 ? (totalScore / totalStudents).toFixed(2) : '0.00';
  const judulPeriode = (semester === 1) ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني';
  const tanggalArab = formatArabicDate(new Date());

  replaceDocumentPlaceholders(doc, {
    '{{JUDUL_PERIODE}}': judulPeriode,
    '{{NAMA_DOSEN}}': lecturer ? lecturer.name : '',
    '{{MATA_KULIAH}}': master ? master.name : cs.masterSubjectId,
    '{{TAHUN_AKADEMIK}}': year ? year.name : '',
    '{{TAHUN_AJARAN}}': year ? year.name : '',
    '{{KELAS}}': cls ? cls.name : '',
    '{{PERSENTASE_LULUS}}': passRateStr,
    '{{JUMLAH_LULUS}}': String(passedCount),
    '{{TOTAL_MAHASISWA}}': String(totalStudents),
    '{{RATA_RATA}}': avgScore,
    '{{GPA}}': avgScore,
    '{{TANGGAL}}': tanggalArab
  });

  doc.saveAndClose();

  const pdfBlob = copyFile.getAs('application/pdf');
  const base64 = Utilities.base64Encode(pdfBlob.getBytes());
  copyFile.setTrashed(true);

  const safeSubCode = master ? String(master.id).trim() : String(cs.id).trim();
  return jsonResponse({
    success: true,
    base64: base64,
    filename: 'Rekap_Dosen_Sem' + semester + '_' + safeSubCode + '.pdf'
  });
}

// 2. Rekap Dosen Gabungan 2 Semester / Tahunan (YEARLY)
// Tabel 6 Kolom RTL: الرقم | اسم الطالب | ف(1) | ف(2) | المعدل | البيان (ناجح / راسب)
// (Juga mendukung otomatis jika tabel di template dibuat 5 kolom tanpa nama: الرقم | ف(1) | ف(2) | المعدل | البيان)
function generateLecturerYearlyPdf(cs, master, lecturer, cls, year, activeYearId, classEnrollments, users, grades, isRemidiPublished, remidiRecords) {
  if (!TEMPLATE_ID_LECTURER_YEARLY || TEMPLATE_ID_LECTURER_YEARLY === 'ISI_ID_TEMPLATE_DOSEN_TAHUNAN_DISINI') {
    return jsonResponse({
      success: false,
      message: "ID Template Google Docs Dosen Tahunan (TEMPLATE_ID_LECTURER_YEARLY) belum diisi di Code.gs"
    });
  }

  const studentRows = [];
  classEnrollments.forEach(function(enr) {
    const st = users.find(u => String(u.id).trim().toLowerCase() === String(enr.studentId).trim().toLowerCase());
    if (!st) return;

    const g = grades.find(x =>
      String(x.enrollmentId).trim() === String(enr.id).trim() &&
      String(x.classSubjectId).trim() === String(cs.id).trim()
    );

    const rawSem1 = g ? ((Number(g.sem1_uts) || 0) + (Number(g.sem1_uas) || 0)) : 0;
    const rawSem2 = g ? ((Number(g.sem2_uts) || 0) + (Number(g.sem2_uas) || 0)) : 0;

    const sem1 = resolveSemesterScoreWithRemidi(
      st.id, activeYearId, cs.id, 1, rawSem1, isRemidiPublished, remidiRecords
    );
    const sem2 = resolveSemesterScoreWithRemidi(
      st.id, activeYearId, cs.id, 2, rawSem2, isRemidiPublished, remidiRecords
    );

    const avg = (sem1 + sem2) / 2;
    const formattedAvg = Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
    // Kelulusan dihitung dari kolom rata-rata (المعدل >= 60)
    const isPassed = avg >= 60;

    studentRows.push({
      studentId: String(st.id || ''),
      studentName: String(st.name || ''),
      sem1: sem1,
      sem2: sem2,
      avg: avg,
      formattedAvg: formattedAvg,
      statusText: isPassed ? 'ناجح' : 'راسب',
      isPassed: isPassed
    });
  });

  const copyFile = DriveApp.getFileById(TEMPLATE_ID_LECTURER_YEARLY).makeCopy('Temp_Dosen_Yearly_' + cs.id);
  const doc = DocumentApp.openById(copyFile.getId());
  const body = doc.getBody();
  const table = body.getTables()[0];
  const headerColCount = table.getNumRows() > 0 ? table.getRow(0).getNumCells() : 6;

  let grandTotalAvg = 0;
  let passedCount = 0;

  studentRows.forEach(function(item, idx) {
    grandTotalAvg += item.avg;
    if (item.isPassed) passedCount++;

    if (headerColCount === 5) {
      // Jika tabel template dibuat 5 kolom: الرقم | ف(1) | ف(2) | المعدل | البيان
      appendFormattedRow(table, [
        String(idx + 1),
        String(item.sem1),
        String(item.sem2),
        item.formattedAvg,
        item.statusText
      ]);
    } else {
      // Default 6 kolom RTL: الرقم | اسم الطالب | ف(1) | ف(2) | المعدل | البيان
      appendFormattedRow(table, [
        String(idx + 1),
        item.studentName,
        String(item.sem1),
        String(item.sem2),
        item.formattedAvg,
        item.statusText
      ]);
    }
  });

  const totalStudents = studentRows.length;
  // Persentase lulus dihitung dari kolom rata-rata (المعدل >= 60)
  const passRateNum = totalStudents > 0 ? ((passedCount / totalStudents) * 100) : 0;
  const passRateStr = (Number.isInteger(passRateNum) ? String(passRateNum) : passRateNum.toFixed(1)) + '%';
  const classAvgStr = totalStudents > 0 ? (grandTotalAvg / totalStudents).toFixed(2) : '0.00';
  const tanggalArab = formatArabicDate(new Date());

  replaceDocumentPlaceholders(doc, {
    '{{JUDUL_PERIODE}}': 'الفصل الدراسي الأول والثاني',
    '{{NAMA_DOSEN}}': lecturer ? lecturer.name : '',
    '{{MATA_KULIAH}}': master ? master.name : cs.masterSubjectId,
    '{{TAHUN_AKADEMIK}}': year ? year.name : '',
    '{{TAHUN_AJARAN}}': year ? year.name : '',
    '{{KELAS}}': cls ? cls.name : '',
    '{{PERSENTASE_LULUS}}': passRateStr,
    '{{JUMLAH_LULUS}}': String(passedCount),
    '{{TOTAL_MAHASISWA}}': String(totalStudents),
    '{{RATA_RATA}}': classAvgStr,
    '{{GPA}}': classAvgStr,
    '{{TANGGAL}}': tanggalArab
  });

  doc.saveAndClose();

  const pdfBlob = copyFile.getAs('application/pdf');
  const base64 = Utilities.base64Encode(pdfBlob.getBytes());
  copyFile.setTrashed(true);

  const safeSubCode = master ? String(master.id).trim() : String(cs.id).trim();
  return jsonResponse({
    success: true,
    base64: base64,
    filename: 'Rekap_Dosen_Tahunan_' + safeSubCode + '.pdf'
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

// =========================================================================
// 7. SHEET KHUSUS REKAP NILAI (rekap_nilai) - PERSIS EXPORT EXCEL ADMIN
// =========================================================================

const REKAP_SHEET_NAME = 'rekap_nilai';

/**
 * Menu kustom di Google Spreadsheet agar Admin dapat menginisialisasi atau
 * me-refresh sheet 'rekap_nilai' kapan saja dengan 1 klik.
 */
function onOpen(e) {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📊 SIAKAD جامعة الإمام الشافعي')
      .addItem('🔄 Buat / Inisialisasi Sheet Rekap Nilai (rekap_nilai)', 'setupRecapSheet')
      .addItem('⚡ Refresh Tabel Nilai Sekarang', 'refreshRecapSheetManual')
      .addToUi();
  } catch (err) {
    console.warn('onOpen menu error:', err);
  }
}

/**
 * Trigger otomatis saat Admin mengubah Dropdown di sheet 'rekap_nilai':
 * - B2: Dropdown Tahun Akademik (العام الجامعي)
 * - D2: Dropdown Kelas (الفصل الدراسي)
 * - F2: Dropdown Mode Semester (نوع العرض)
 * - H2: Dropdown Jenis Rekap (نوع الكشف)
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (!sheet || sheet.getName() !== REKAP_SHEET_NAME) return;

    const row = e.range.getRow();
    const col = e.range.getColumn();

    // Hanya merespons perubahan pada Baris 2 (Baris Filter Dropdown: B2, D2, F2, H2)
    if (row === 2 && (col === 2 || col === 4 || col === 6 || col === 8)) {
      const ss = e.source || SpreadsheetApp.getActiveSpreadsheet();
      const changeType = col === 2 ? 'YEAR_CHANGED' : 'FILTER_CHANGED';
      renderRecapSheetTable(ss, sheet, changeType);
    }
  } catch (err) {
    console.error('onEdit Recap Sheet Error:', err);
  }
}

function ensureRecapSheetExists(ss) {
  try {
    const activeSs = ss || SpreadsheetApp.getActiveSpreadsheet();
    const existing = activeSs.getSheetByName(REKAP_SHEET_NAME);
    if (!existing) {
      setupRecapSheet(activeSs);
    }
  } catch (err) {
    console.warn('ensureRecapSheetExists warning:', err);
  }
}

function syncRecapSheetIfActive(ss) {
  try {
    const activeSs = ss || SpreadsheetApp.getActiveSpreadsheet();
    let sheet = activeSs.getSheetByName(REKAP_SHEET_NAME);
    if (!sheet) {
      setupRecapSheet(activeSs);
    } else {
      renderRecapSheetTable(activeSs, sheet, 'DATA_SYNC');
    }
  } catch (err) {
    console.warn('syncRecapSheetIfActive warning:', err);
  }
}

function handleSyncRecapSheet(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(REKAP_SHEET_NAME);
  if (!sheet) {
    setupRecapSheet(ss);
    sheet = ss.getSheetByName(REKAP_SHEET_NAME);
  }
  if (payload && payload.yearName) {
    sheet.getRange('B2').setValue(String(payload.yearName).trim());
  }
  if (payload && payload.classLabel) {
    sheet.getRange('D2').setValue(String(payload.classLabel).trim());
  }
  renderRecapSheetTable(ss, sheet, 'FILTER_CHANGED');
  return jsonResponse({ success: true, sheetName: REKAP_SHEET_NAME });
}

function refreshRecapSheetManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(REKAP_SHEET_NAME);
  if (!sheet) {
    setupRecapSheet(ss);
  } else {
    renderRecapSheetTable(ss, sheet, 'FILTER_CHANGED');
  }
}

/**
 * Membuat / menginisialisasi sheet 'rekap_nilai' beserta Dropdown Tahun Akademik,
 * Dropdown Kelas, Dropdown Mode Semester, dan merender tabel rekap nilai kelas.
 */
function setupRecapSheet(ssParam) {
  const ss = ssParam || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(REKAP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(REKAP_SHEET_NAME);
  }

  // Set tampilan Right-To-Left (RTL) persis seperti hasil Export Excel Admin
  try {
    sheet.setRightToLeft(true);
  } catch (e) {
    // Abaikan jika environment lama
  }

  // Ambil data tahun akademik & kelas
  const years = getSheetData(ss, 'academic_years');
  const classes = getSheetData(ss, 'classes');

  // Pilih tahun akademik yang aktif (atau tahun terakhir jika tidak ada yang aktif)
  let defaultYear = years.find(function(y) {
    return y.isActive === true || String(y.isActive).toLowerCase() === 'true';
  });
  if (!defaultYear && years.length > 0) {
    defaultYear = years[years.length - 1];
  }

  const yearNames = years
    .map(function(y) { return String(y.name || y.id || '').trim(); })
    .filter(function(n) { return n.length > 0; });

  const selectedYearName = defaultYear ? String(defaultYear.name || defaultYear.id).trim() : (yearNames[0] || '');
  const selectedYearId = defaultYear ? String(defaultYear.id).trim() : '';

  const classOptions = getFormattedClassOptionsForYear(classes, selectedYearId);
  const selectedClassLabel = classOptions.length > 0 ? classOptions[0] : '';

  // Bersihkan seluruh sheet terlebih dahulu
  sheet.clear();
  sheet.clearFormats();
  sheet.getRange(1, 1, 5, 15).clearDataValidations();

  // Set nilai awal Dropdown di Baris 2:
  // A2: Label Tahun Akademik | B2: Dropdown Tahun Akademik
  // C2: Label Kelas          | D2: Dropdown Kelas
  // E2: Label Mode Tampilan  | F2: Dropdown Mode Tampilan
  // G2: Label Jenis Rekap    | H2: Dropdown Jenis Rekap
  sheet.getRange('A2').setValue('العام الجامعي:');
  sheet.getRange('B2').setValue(selectedYearName);
  sheet.getRange('C2').setValue('الفصل الدراسي:');
  sheet.getRange('D2').setValue(selectedClassLabel);
  sheet.getRange('E2').setValue('نوع العرض:');
  sheet.getRange('F2').setValue('شامل (ف1 + ف2)');
  sheet.getRange('G2').setValue('نوع الكشف:');
  sheet.getRange('H2').setValue('الكشف العام');

  // Pasang Data Validation (Dropdown)
  applyRecapDropdownValidations(sheet, yearNames, classOptions);

  // Render tabel nilai persis seperti Export Excel Rekap Admin
  renderRecapSheetTable(ss, sheet, 'INIT');
}

function formatClassOptionLabel(cls) {
  if (!cls) return '';
  const name = String(cls.name || '').trim();
  const genderRaw = String(cls.gender || '').trim().toUpperCase();
  const isFemale = genderRaw === 'FEMALE' || genderRaw === 'F' || genderRaw === 'بنات' || genderRaw === 'طالبات';
  const genderLabel = isFemale ? 'بنات' : 'بنين';
  return name + ' (' + genderLabel + ')';
}

function getFormattedClassOptionsForYear(classes, yearId) {
  if (!Array.isArray(classes)) return [];
  const filtered = classes.filter(function(c) {
    return String(c.academicYearId || '').trim() === String(yearId || '').trim();
  });
  return filtered.map(formatClassOptionLabel).filter(function(lbl) { return lbl.length > 0; });
}

function applyRecapDropdownValidations(sheet, yearNames, classOptions) {
  // 1. Dropdown Tahun Akademik di B2
  if (Array.isArray(yearNames) && yearNames.length > 0) {
    const yearRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(yearNames, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B2').setDataValidation(yearRule);
  } else {
    sheet.getRange('B2').clearDataValidations();
  }

  // 2. Dropdown Kelas di D2
  if (Array.isArray(classOptions) && classOptions.length > 0) {
    const classRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(classOptions, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('D2').setDataValidation(classRule);
  } else {
    sheet.getRange('D2').clearDataValidations();
  }

  // 3. Dropdown Mode Semester di F2
  const modeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['شامل (ف1 + ف2)', 'الفصل الأول', 'الفصل الثاني'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('F2').setDataValidation(modeRule);

  // 4. Dropdown Jenis Rekap di H2
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['الكشف العام', 'كشف التكميلي (الأصلية)'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('H2').setDataValidation(typeRule);
}

/**
 * Merender ulang seluruh tabel di sheet 'rekap_nilai' agar 100% persis
 * dengan hasil Export Excel pada halaman Rekap Admin (ClassRecapManager).
 */
function renderRecapSheetTable(ssParam, sheetParam, reason) {
  const ss = ssParam || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetParam || ss.getSheetByName(REKAP_SHEET_NAME);
  if (!sheet) return;

  try {
    sheet.setRightToLeft(true);
  } catch (e) {}

  // Baca seluruh entitas dari Spreadsheet
  const years = getSheetData(ss, 'academic_years');
  const classes = getSheetData(ss, 'classes');
  const classSubjects = getSheetData(ss, 'class_subjects');
  const masterSubjects = getSheetData(ss, 'master_subjects');
  const enrollments = getSheetData(ss, 'student_enrollments');
  const users = getSheetData(ss, 'users');
  const grades = getSheetData(ss, 'grades');
  const remidiRecords = getSheetData(ss, 'remidi_records');

  // Baca nilai filter saat ini dari Baris 2 (B2, D2, F2, H2)
  let selectedYearName = String(sheet.getRange('B2').getValue() || '').trim();
  let selectedClassLabel = String(sheet.getRange('D2').getValue() || '').trim();
  let selectedViewModeLabel = String(sheet.getRange('F2').getValue() || '').trim();
  let selectedRecapTypeLabel = String(sheet.getRange('H2').getValue() || '').trim();

  // Temukan objek Tahun Akademik
  let selectedYear = years.find(function(y) {
    return String(y.name || '').trim() === selectedYearName || String(y.id || '').trim() === selectedYearName;
  });
  if (!selectedYear && years.length > 0) {
    selectedYear = years.find(function(y) {
      return y.isActive === true || String(y.isActive).toLowerCase() === 'true';
    }) || years[years.length - 1];
    selectedYearName = String(selectedYear.name || selectedYear.id || '').trim();
    sheet.getRange('B2').setValue(selectedYearName);
  }

  const selectedYearId = selectedYear ? String(selectedYear.id || '').trim() : '';
  const yearNames = years
    .map(function(y) { return String(y.name || y.id || '').trim(); })
    .filter(function(n) { return n.length > 0; });

  // Filter daftar kelas berdasarkan Tahun Akademik yang dipilih
  const classesInYear = classes.filter(function(c) {
    return String(c.academicYearId || '').trim() === selectedYearId;
  });
  const classOptions = classesInYear.map(formatClassOptionLabel);

  // Cari kelas yang cocok dengan pilihan di D2
  let selectedClass = classesInYear.find(function(c) {
    return formatClassOptionLabel(c) === selectedClassLabel || String(c.name || '').trim() === selectedClassLabel;
  });

  // Jika Tahun Akademik baru saja diganti atau kelas belum valid, pilih kelas pertama di tahun tersebut
  if ((reason === 'YEAR_CHANGED' || !selectedClass) && classesInYear.length > 0) {
    selectedClass = classesInYear[0];
    selectedClassLabel = formatClassOptionLabel(selectedClass);
    sheet.getRange('D2').setValue(selectedClassLabel);
  } else if (classesInYear.length === 0) {
    selectedClass = null;
    selectedClassLabel = '';
    sheet.getRange('D2').setValue('');
  }

  if (!selectedViewModeLabel) {
    selectedViewModeLabel = 'شامل (ف1 + ف2)';
    sheet.getRange('F2').setValue(selectedViewModeLabel);
  }
  if (!selectedRecapTypeLabel) {
    selectedRecapTypeLabel = 'الكشف العام';
    sheet.getRange('H2').setValue(selectedRecapTypeLabel);
  }

  // Perbarui validasi dropdown agar daftar tahun & kelas selalu sinkron
  applyRecapDropdownValidations(sheet, yearNames, classOptions);

  const viewMode = selectedViewModeLabel === 'الفصل الأول'
    ? 'SEM1'
    : (selectedViewModeLabel === 'الفصل الثاني' ? 'SEM2' : 'COMBINED');
  const recapType = selectedRecapTypeLabel.indexOf('التكميلي') !== -1 ? 'REMIDI' : 'REGULAR';

  // Bersihkan area tabel & header lama (mulai dari baris 1, kecuali nilai sel di baris 2)
  const maxRowsToClear = Math.max(sheet.getLastRow(), 30);
  const maxColsToClear = Math.max(sheet.getLastColumn(), 20);
  sheet.getRange(1, 1, 1, maxColsToClear).breakApart().clearContent().clearFormat();
  if (maxRowsToClear >= 3) {
    sheet.getRange(3, 1, maxRowsToClear - 2, maxColsToClear).breakApart().clearContent().clearFormat();
  }

  // Format Baris 2 (Panel Filter Dropdown)
  sheet.setRowHeight(2, 32);
  const filterRange = sheet.getRange(2, 1, 1, Math.max(8, maxColsToClear));
  filterRange.setBackground('#F8FAFC')
    .setFontFamily('Calibri')
    .setFontSize(11)
    .setVerticalAlignment('middle');

  const labelCells = ['A2', 'C2', 'E2', 'G2'];
  labelCells.forEach(function(a1) {
    sheet.getRange(a1)
      .setFontWeight('bold')
      .setFontColor('#064E3B')
      .setHorizontalAlignment('left')
      .setBackground('#ECFDF5');
  });

  const dropdownCells = ['B2', 'D2', 'F2', 'H2'];
  dropdownCells.forEach(function(a1) {
    sheet.getRange(a1)
      .setFontWeight('bold')
      .setFontColor('#1F2937')
      .setHorizontalAlignment('center')
      .setBackground('#FFFFFF')
      .setBorder(true, true, true, true, false, false, '#10B981', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  // Jika belum ada kelas pada tahun akademik ini, tampilkan pesan informasi
  if (!selectedClass) {
    const emptyCols = 8;
    sheet.getRange(1, 1, 1, emptyCols).merge()
      .setValue('جامعة الإمام الشافعي - كشف درجات الطلاب العام')
      .setBackground('#064E3B')
      .setFontColor('#FFFFFF')
      .setFontFamily('Calibri')
      .setFontSize(15)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(1, 36);

    sheet.getRange(4, 1, 1, emptyCols).merge()
      .setValue('لا توجد فصول دراسية مسجلة في هذا العام الجامعي')
      .setBackground('#FEF2F2')
      .setFontColor('#DC2626')
      .setFontFamily('Calibri')
      .setFontSize(12)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(4, 36);
    return;
  }

  const classId = String(selectedClass.id).trim();
  const className = formatClassOptionLabel(selectedClass);

  // Kumpulkan mata kuliah yang diajarkan di kelas ini (persis seperti getClassRecap di aplikasi)
  const assignedClassSubjects = classSubjects.filter(function(cs) {
    return String(cs.classId).trim() === classId;
  });

  const activeSubjects = [];
  const csToMaster = {};
  assignedClassSubjects.forEach(function(cs) {
    const mId = String(cs.masterSubjectId).trim();
    const m = masterSubjects.find(function(x) { return String(x.id).trim() === mId; });
    if (m) {
      if (!activeSubjects.some(function(s) { return String(s.id).trim() === String(m.id).trim(); })) {
        activeSubjects.push(m);
      }
      csToMaster[String(cs.id).trim()] = String(m.id).trim();
    }
  });

  // Hitung jumlah kolom tabel persis seperti handleExportExcel di AdminDashboard.tsx
  const totalCols = Math.max(
    8,
    viewMode === 'COMBINED'
      ? 3 + (activeSubjects.length * 3) + 2
      : 3 + activeSubjects.length + 2
  );

  // Siapkan peta indeks cepat untuk Grades & Remidi
  const gradeMap = {};
  grades.forEach(function(g) {
    const key = String(g.enrollmentId).trim() + '__' + String(g.classSubjectId).trim();
    gradeMap[key] = g;
  });

  const remidiMap = {};
  remidiRecords.forEach(function(r) {
    if (String(r.academicYearId).trim() === selectedYearId && String(r.classId).trim() === classId) {
      const rKey = String(r.classSubjectId).trim() + '__' + String(r.studentId).trim().toLowerCase() + '__' + Number(r.semester);
      remidiMap[rKey] = r;
    }
  });

  const userMap = {};
  users.forEach(function(u) {
    userMap[String(u.id).trim().toLowerCase()] = u;
  });

  // Ambil mahasiswa yang terdaftar di kelas ini dan urutkan berdasarkan nama (persis aplikasi)
  const classEnrollments = enrollments.filter(function(e) {
    return String(e.classId).trim() === classId;
  });

  const activeRows = [];
  classEnrollments.forEach(function(enr) {
    const st = userMap[String(enr.studentId).trim().toLowerCase()];
    if (!st) return;

    const rowGrades = {};
    const remidiDetails = {};

    assignedClassSubjects.forEach(function(cs) {
      const csId = String(cs.id).trim();
      const masterId = csToMaster[csId];
      if (!masterId) return;

      const g = gradeMap[String(enr.id).trim() + '__' + csId];
      const sem1Raw = g ? ((Number(g.sem1_uts) || 0) + (Number(g.sem1_uas) || 0)) : 0;
      const sem2Raw = g ? ((Number(g.sem2_uts) || 0) + (Number(g.sem2_uas) || 0)) : 0;

      const sIdLower = String(st.id).trim().toLowerCase();
      const rem1 = remidiMap[csId + '__' + sIdLower + '__1'];
      const rem2 = remidiMap[csId + '__' + sIdLower + '__2'];

      const hasRem1 = Boolean(
        rem1 &&
        (rem1.isEligible === true || String(rem1.isEligible).toLowerCase() === 'true') &&
        rem1.remidiScore !== undefined && rem1.remidiScore !== null && String(rem1.remidiScore).trim() !== ''
      );
      const hasRem2 = Boolean(
        rem2 &&
        (rem2.isEligible === true || String(rem2.isEligible).toLowerCase() === 'true') &&
        rem2.remidiScore !== undefined && rem2.remidiScore !== null && String(rem2.remidiScore).trim() !== ''
      );

      if (recapType === 'REMIDI') {
        const effSem1 = hasRem1 ? Number(rem1.remidiScore) : sem1Raw;
        const effSem2 = hasRem2 ? Number(rem2.remidiScore) : sem2Raw;
        const effAvg = (effSem1 + effSem2) / 2;
        rowGrades[masterId] = { sem1: effSem1, sem2: effSem2, avg: effAvg };
        remidiDetails[masterId] = { isRemidiSem1: hasRem1, isRemidiSem2: hasRem2 };
      } else {
        const avg = (sem1Raw + sem2Raw) / 2;
        rowGrades[masterId] = { sem1: sem1Raw, sem2: sem2Raw, avg: avg };
      }
    });

    activeRows.push({
      student: {
        id: String(st.id).trim(),
        name: String(st.name).trim()
      },
      grades: rowGrades,
      remidiDetails: remidiDetails
    });
  });

  activeRows.sort(function(a, b) {
    return a.student.name.localeCompare(b.student.name);
  });

  // =========================================================================
  // RENDER HEADER UTAMA & METADATA (BARIS 1, 3, 4)
  // =========================================================================
  const modeLabel = viewMode === 'SEM1'
    ? 'الفصل الدراسي الأول'
    : (viewMode === 'SEM2' ? 'الفصل الدراسي الثاني' : 'المعدل السنوي الشامل (ف1 + ف2)');
  const currentDate = formatArabicDate(new Date());

  // Baris 1: Judul Utama (Persis Baris 1 di Export Excel)
  sheet.setRowHeight(1, 36);
  const titleText = recapType === 'REMIDI'
    ? 'جامعة الإمام الشافعي - كشف درجات الاختبار التكميلي (الدرجات الأصلية المعتمدة)'
    : 'جامعة الإمام الشافعي - كشف درجات الطلاب العام';
  sheet.getRange(1, 1, 1, totalCols).merge()
    .setValue(titleText)
    .setBackground('#064E3B')
    .setFontColor('#FFFFFF')
    .setFontFamily('Calibri')
    .setFontSize(15)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Baris 3: Sub-judul / Metadata Kelas & Tahun Akademik (Persis Baris 2 di Export Excel)
  sheet.setRowHeight(3, 26);
  const metaText = 'الفصل: ' + className +
    '   |   العام الجامعي: ' + selectedYearName +
    '   |   نوع التقرير: ' + modeLabel + (recapType === 'REMIDI' ? ' (درجات أصلية)' : '') +
    '   |   تاريخ الاستخراج: ' + currentDate;
  sheet.getRange(3, 1, 1, totalCols).merge()
    .setValue(metaText)
    .setBackground('#E6F4EA')
    .setFontColor('#064E3B')
    .setFontFamily('Calibri')
    .setFontSize(11)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Baris 4: Catatan / Spacer
  sheet.setRowHeight(4, recapType === 'REMIDI' ? 20 : 10);
  if (recapType === 'REMIDI') {
    sheet.getRange(4, 1, 1, totalCols).merge()
      .setValue('* تنبيه: يتضمن هذا الكشف الدرجات الأصلية الكاملة المرصودة في الاختبار التكميلي لأغراض الأرشفة والتقييم الداخلي.')
      .setFontFamily('Calibri')
      .setFontSize(9)
      .setFontStyle('italic')
      .setFontColor('#047857')
      .setHorizontalAlignment('right')
      .setVerticalAlignment('middle');
  }

  // =========================================================================
  // RENDER HEADER TABEL (BARIS 5 & 6 UNTUK COMBINED, ATAU BARIS 5 UNTUK SEM1/SEM2)
  // =========================================================================
  const tableCols = viewMode === 'COMBINED'
    ? 3 + (activeSubjects.length * 3) + 2
    : 3 + activeSubjects.length + 2;

  let startDataRow = 6;

  if (viewMode === 'COMBINED') {
    sheet.setRowHeight(5, 28);
    sheet.setRowHeight(6, 24);

    const hRow1 = new Array(tableCols).fill('');
    const hRow2 = new Array(tableCols).fill('');

    hRow1[0] = 'م';
    hRow1[1] = 'رقم القيد';
    hRow1[2] = 'اسم الطالب';

    let colIdx = 3; // 0-based
    activeSubjects.forEach(function(s) {
      hRow1[colIdx] = String(s.name || '').trim();
      hRow2[colIdx] = 'ف1';
      hRow2[colIdx + 1] = 'ف2';
      hRow2[colIdx + 2] = 'المعدل';
      colIdx += 3;
    });

    hRow1[colIdx] = 'النتيجة النهائية';
    hRow2[colIdx] = 'المجموع';
    hRow2[colIdx + 1] = 'المعدل';

    const headerRange = sheet.getRange(5, 1, 2, tableCols);
    headerRange.setValues([hRow1, hRow2]);

    // Merge cells persis seperti handleExportExcel
    sheet.getRange(5, 1, 2, 1).merge();
    sheet.getRange(5, 2, 2, 1).merge();
    sheet.getRange(5, 3, 2, 1).merge();

    let mergeCol = 4; // 1-based
    activeSubjects.forEach(function() {
      sheet.getRange(5, mergeCol, 1, 3).merge();
      mergeCol += 3;
    });
    sheet.getRange(5, mergeCol, 1, 2).merge();

    // Format warna & font Header Tabel
    sheet.getRange(5, 1, 1, tableCols).setBackground('#064E3B');
    sheet.getRange(6, 1, 1, tableCols).setBackground('#047857');
    headerRange
      .setFontFamily('Calibri')
      .setFontSize(10)
      .setFontWeight('bold')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true)
      .setBorder(true, true, true, true, true, true, '#D1D5DB', SpreadsheetApp.BorderStyle.SOLID);

    startDataRow = 7;
  } else {
    sheet.setRowHeight(5, 30);
    const headers = ['م', 'رقم القيد', 'اسم الطالب']
      .concat(activeSubjects.map(function(s) { return String(s.name || '').trim(); }))
      .concat(['المجموع', 'النسبة / المعدل']);

    const headerRange = sheet.getRange(5, 1, 1, tableCols);
    headerRange.setValues([headers])
      .setBackground('#064E3B')
      .setFontFamily('Calibri')
      .setFontSize(11)
      .setFontWeight('bold')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true)
      .setBorder(true, true, true, true, true, true, '#D1D5DB', SpreadsheetApp.BorderStyle.SOLID);

    startDataRow = 6;
  }

  // =========================================================================
  // RENDER BARIS DATA MAHASISWA (BATCH SETVALUES + WARNA IDENTIK EXPORT EXCEL)
  // =========================================================================
  if (activeRows.length === 0) {
    sheet.setRowHeight(startDataRow, 28);
    sheet.getRange(startDataRow, 1, 1, tableCols).merge()
      .setValue('لا يوجد طلاب مسجلون في هذا الفصل الدراسي')
      .setBackground('#F9FAFB')
      .setFontColor('#6B7280')
      .setFontFamily('Calibri')
      .setFontSize(11)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#D1D5DB', SpreadsheetApp.BorderStyle.SOLID);
    return;
  }

  const valuesMatrix = [];
  const bgMatrix = [];
  const fontColorMatrix = [];
  const fontWeightMatrix = [];
  const fontSizeMatrix = [];
  const hAlignMatrix = [];

  activeRows.forEach(function(row, rowIdx) {
    let rowSum = 0;
    let count = 0;
    let hasFailingScore = false;

    if (viewMode === 'COMBINED') {
      activeSubjects.forEach(function(s) {
        const g = row.grades[String(s.id).trim()];
        if (g) {
          rowSum += g.avg;
          count++;
          if (g.sem1 < 60 || g.sem2 < 60 || g.avg < 60) {
            hasFailingScore = true;
          }
        }
      });
    } else {
      activeSubjects.forEach(function(s) {
        const g = row.grades[String(s.id).trim()];
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

    const rowFinalAvg = count > 0 ? (rowSum / count) : 0;
    if (rowFinalAvg < 60) {
      hasFailingScore = true;
    }

    const rVals = new Array(tableCols).fill('');
    const rBgs = new Array(tableCols).fill('#FFFFFF');
    const rColors = new Array(tableCols).fill('#1F2937');
    const rWeights = new Array(tableCols).fill('normal');
    const rSizes = new Array(tableCols).fill(10);
    const rAligns = new Array(tableCols).fill('center');

    // Kolom 1: م (Nomor)
    rVals[0] = rowIdx + 1;
    rColors[0] = '#6B7280';

    // Kolom 2: رقم القيد (NIM)
    rVals[1] = row.student.id;
    rColors[1] = hasFailingScore ? '#DC2626' : '#4B5563';

    // Kolom 3: اسم الطالب (Nama Mahasiswa)
    rVals[2] = row.student.name;
    rAligns[2] = 'right';
    rSizes[2] = 11;
    if (hasFailingScore) {
      rColors[2] = '#DC2626';
      rWeights[2] = 'bold';
      rBgs[2] = '#FFF1F2';
    } else {
      rColors[2] = '#1F2937';
      rWeights[2] = 'normal';
    }

    const remDetails = row.remidiDetails || {};
    let cIdx = 3; // 0-based

    if (viewMode === 'COMBINED') {
      activeSubjects.forEach(function(s) {
        const sId = String(s.id).trim();
        const g = row.grades[sId];
        const s1 = g ? g.sem1 : 0;
        const s2 = g ? g.sem2 : 0;
        const avg = g ? parseFloat(g.avg.toFixed(1)) : 0;
        const subRem = remDetails[sId];

        // Sem 1 (ف1)
        rVals[cIdx] = g ? s1 : '-';
        if (g && s1 < 60) {
          rColors[cIdx] = '#DC2626';
          rWeights[cIdx] = 'bold';
          rBgs[cIdx] = '#FEE2E2';
        } else if (subRem && subRem.isRemidiSem1) {
          rColors[cIdx] = '#065F46';
          rWeights[cIdx] = 'bold';
          rBgs[cIdx] = '#ECFDF5';
        } else {
          rColors[cIdx] = '#374151';
        }

        // Sem 2 (ف2)
        rVals[cIdx + 1] = g ? s2 : '-';
        if (g && s2 < 60) {
          rColors[cIdx + 1] = '#DC2626';
          rWeights[cIdx + 1] = 'bold';
          rBgs[cIdx + 1] = '#FEE2E2';
        } else if (subRem && subRem.isRemidiSem2) {
          rColors[cIdx + 1] = '#065F46';
          rWeights[cIdx + 1] = 'bold';
          rBgs[cIdx + 1] = '#ECFDF5';
        } else {
          rColors[cIdx + 1] = '#374151';
        }

        // Rata-rata Matkul (المعدل)
        rVals[cIdx + 2] = g ? avg : '-';
        rWeights[cIdx + 2] = 'bold';
        if (g && avg < 60) {
          rColors[cIdx + 2] = '#DC2626';
          rBgs[cIdx + 2] = '#FEE2E2';
        } else {
          rColors[cIdx + 2] = '#1F2937';
          rBgs[cIdx + 2] = '#F9FAFB';
        }

        cIdx += 3;
      });

      // Kolom المجموع (Total Sum)
      rVals[cIdx] = parseFloat(rowSum.toFixed(1));
      rColors[cIdx] = '#064E3B';
      rWeights[cIdx] = 'bold';
      rBgs[cIdx] = '#E6F4EA';

      // Kolom المعدل (Final Average)
      rVals[cIdx + 1] = parseFloat(rowFinalAvg.toFixed(2));
      rWeights[cIdx + 1] = 'bold';
      if (rowFinalAvg < 60) {
        rColors[cIdx + 1] = '#DC2626';
        rBgs[cIdx + 1] = '#FEE2E2';
      } else {
        rColors[cIdx + 1] = '#064E3B';
        rBgs[cIdx + 1] = '#E6F4EA';
      }
    } else {
      activeSubjects.forEach(function(s) {
        const sId = String(s.id).trim();
        const g = row.grades[sId];
        const val = g ? (viewMode === 'SEM1' ? g.sem1 : g.sem2) : 0;
        const subRem = remDetails[sId];
        const isRem = viewMode === 'SEM1' ? (subRem && subRem.isRemidiSem1) : (subRem && subRem.isRemidiSem2);

        rVals[cIdx] = g ? val : '-';
        if (g && val < 60) {
          rColors[cIdx] = '#DC2626';
          rWeights[cIdx] = 'bold';
          rBgs[cIdx] = '#FEE2E2';
        } else if (isRem) {
          rColors[cIdx] = '#065F46';
          rWeights[cIdx] = 'bold';
          rBgs[cIdx] = '#ECFDF5';
        } else {
          rColors[cIdx] = '#1F2937';
        }
        cIdx++;
      });

      // Kolom المجموع (Sum)
      rVals[cIdx] = rowSum;
      rColors[cIdx] = '#064E3B';
      rWeights[cIdx] = 'bold';
      rBgs[cIdx] = '#E6F4EA';

      // Kolom النسبة / المعدل (Final Avg)
      rVals[cIdx + 1] = parseFloat(rowFinalAvg.toFixed(2));
      rWeights[cIdx + 1] = 'bold';
      if (rowFinalAvg < 60) {
        rColors[cIdx + 1] = '#DC2626';
        rBgs[cIdx + 1] = '#FEE2E2';
      } else {
        rColors[cIdx + 1] = '#064E3B';
        rBgs[cIdx + 1] = '#E6F4EA';
      }
    }

    valuesMatrix.push(rVals);
    bgMatrix.push(rBgs);
    fontColorMatrix.push(rColors);
    fontWeightMatrix.push(rWeights);
    fontSizeMatrix.push(rSizes);
    hAlignMatrix.push(rAligns);
  });

  // Tulis seluruh baris mahasiswa sekaligus dengan Batch Operations
  const dataRange = sheet.getRange(startDataRow, 1, valuesMatrix.length, tableCols);
  dataRange
    .setValues(valuesMatrix)
    .setBackgrounds(bgMatrix)
    .setFontColors(fontColorMatrix)
    .setFontWeights(fontWeightMatrix)
    .setFontSizes(fontSizeMatrix)
    .setHorizontalAlignments(hAlignMatrix)
    .setFontFamily('Calibri')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#D1D5DB', SpreadsheetApp.BorderStyle.SOLID);

  sheet.setRowHeights(startDataRow, valuesMatrix.length, 24);

  // Set lebar kolom proporsional persis seperti handleExportExcel
  sheet.setColumnWidth(1, 55);   // م
  sheet.setColumnWidth(2, 115);  // رقم القيد
  sheet.setColumnWidth(3, 220);  // اسم الطالب
  for (let c = 4; c <= tableCols; c++) {
    sheet.setColumnWidth(c, 85);
  }
}

