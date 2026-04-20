/**
 * 베이비바우처 판매자 포털 백엔드 (Google Apps Script)
 * ----------------------------------------------------
 * 엔드포인트 하나로 다음 요청을 처리합니다:
 *   - POST { kind: 'submission', ... }       : 판매자 제출 저장 (Drive + Sheet)
 *   - POST { kind: 'inquiry', ... }          : 문의 접수
 *   - POST { kind: 'inquiry-answer', ... }   : 어드민 답변 반영
 *   - POST { kind: 'banner-download', ... }  : 배너 다운로드 로그
 *   - GET  ?kind=submissions                 : 전체 제출 목록 (admin에서 호출)
 *   - GET  ?kind=inquiries                   : 전체 문의 목록
 *
 * 최초 1회 아래 setUp() 함수를 실행하면 필요한 시트/폴더가 자동 생성됩니다.
 */

// ==================== CONFIG ====================
const CONFIG = {
  // 자동 생성: setUp() 실행 시 프로퍼티에 ID 저장
  ROOT_FOLDER_NAME: '베이비바우처_판매자제출',
  SHEET_FILE_NAME:  '베이비바우처_판매자제출_DB'
};

function props() { return PropertiesService.getScriptProperties(); }

/**
 * 공유 드라이브(또는 특정 폴더)에 저장하고 싶을 때 먼저 이 함수를 실행하세요.
 *
 * 1) drive.google.com에서 공유 드라이브 `베이비바우처_판매자제출` 생성 (또는 기존 폴더 준비)
 * 2) 공유 드라이브/폴더를 연 URL: https://drive.google.com/drive/folders/{여기에_긴_ID}
 * 3) 아래 SHARED_DRIVE_ID에 붙여넣고 ▶️ 실행
 * 4) 이후 setUp() 실행 시 이 폴더 하위에 시트/파일이 생성됨
 */
function bindSharedDrive() {
  const SHARED_DRIVE_ID = 'PASTE_FOLDER_OR_SHARED_DRIVE_ID_HERE';
  if (SHARED_DRIVE_ID === 'PASTE_FOLDER_OR_SHARED_DRIVE_ID_HERE') {
    throw new Error('먼저 bindSharedDrive() 안의 SHARED_DRIVE_ID를 실제 공유 드라이브 폴더 ID로 교체하세요.');
  }
  // 접근 가능한지 먼저 검증
  const folder = DriveApp.getFolderById(SHARED_DRIVE_ID);
  props().setProperty('ROOT_FOLDER_ID', SHARED_DRIVE_ID);
  Logger.log('Bound to: ' + folder.getName() + ' (' + folder.getUrl() + ')');
  return { ok:true, name: folder.getName(), url: folder.getUrl() };
}

// ==================== SETUP (1회 실행) ====================
function setUp() {
  // 1. Root folder — 공유 드라이브가 먼저 바인딩돼 있으면 그걸 사용
  const existingId = props().getProperty('ROOT_FOLDER_ID');
  let folder;
  if (existingId) {
    folder = DriveApp.getFolderById(existingId);
    Logger.log('Using pre-bound folder: ' + folder.getName());
  } else {
    // fallback: 개인 드라이브 루트에 생성 (공유 드라이브 미사용 시)
    folder = getFolderByName_(CONFIG.ROOT_FOLDER_NAME) || DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
    props().setProperty('ROOT_FOLDER_ID', folder.getId());
    Logger.log('⚠️ 공유 드라이브 미바인딩 → 개인 드라이브 "' + CONFIG.ROOT_FOLDER_NAME + '"에 저장됩니다. 공유 드라이브를 쓰려면 먼저 bindSharedDrive()를 실행하세요.');
  }

  // 2. Spreadsheet
  let ssId = props().getProperty('SHEET_ID');
  let ss;
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.SHEET_FILE_NAME);
    const file = DriveApp.getFileById(ss.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    props().setProperty('SHEET_ID', ss.getId());
  }

  // 3. Sheets (Submissions / Inquiries / BannerLogs)
  ensureSheet_(ss, 'Submissions', [
    'submittedAt','acctId','brandName','subvertical','contractType',
    'manager','phone','email','storeUrl',
    'brandDesc','solutionAdded','benefit1','benefit2','benefit3',
    'logoUrl','shotUrl','brandFolder','raw'
  ]);
  ensureSheet_(ss, 'Inquiries', [
    'id','createdAt','acctId','brandName','type','msg',
    'handoffName','handoffEmail','handoffPhone',
    'status','answer','answeredAt'
  ]);
  ensureSheet_(ss, 'BannerLogs', ['at','acctId','bannerId']);
  ensureSheet_(ss, 'Exports',    ['exportedAt','ym','count','zipUrl','by']);

  Logger.log('Setup complete. Folder: ' + folder.getUrl() + ' | Sheet: ' + ss.getUrl());
  return {
    folderUrl: folder.getUrl(),
    sheetUrl: ss.getUrl()
  };
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  // remove default "Sheet1"
  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0) ss.deleteSheet(s1);
}

function getFolderByName_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : null;
}

// ==================== WEB ENDPOINTS ====================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let result;
    switch (body.kind) {
      case 'submission':       result = handleSubmission_(body); break;
      case 'inquiry':          result = handleInquiry_(body); break;
      case 'inquiry-answer':   result = handleInquiryAnswer_(body); break;
      case 'banner-download':  result = handleBannerLog_(body); break;
      default: result = { ok: false, error: 'unknown kind: ' + body.kind };
    }
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  const kind = (e.parameter.kind || '').trim();
  try {
    if (kind === 'submissions') return jsonResponse_(readSheet_('Submissions'));
    if (kind === 'inquiries')   return jsonResponse_(readSheet_('Inquiries'));
    if (kind === 'months')      return jsonResponse_(listMonths_());
    if (kind === 'exports')     return jsonResponse_(readSheet_('Exports'));
    if (kind === 'export') {
      const ym = (e.parameter.ym || '').trim() || defaultYm_();
      const by = (e.parameter.by || 'admin').trim();
      return jsonResponse_(exportMonthZip_(ym, by));
    }
    if (kind === 'ping')        return jsonResponse_({ ok: true, ts: new Date().toISOString() });
    return jsonResponse_({ ok: false, error: 'unknown kind' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheet_(name) {
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    if (obj.raw) {
      try { Object.assign(obj, JSON.parse(obj.raw)); delete obj.raw; } catch (e) {}
    }
    return obj;
  });
}

// ==================== HANDLERS ====================
function handleSubmission_(body) {
  const rootId = props().getProperty('ROOT_FOLDER_ID');
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));

  // 월별 상위 폴더 > 브랜드 폴더 (예: 2026-04 / 브랜드A (ACCTID))
  const root = DriveApp.getFolderById(rootId);
  const ym = Utilities.formatDate(new Date(body.submittedAt || Date.now()), 'Asia/Seoul', 'yyyy-MM');
  let monthFolder = getChildFolder_(root, ym) || root.createFolder(ym);
  const brandFolderName = (body.brandName || body.acctId || 'unknown') + ' (' + (body.acctId || '') + ')';
  let brandFolder = getChildFolder_(monthFolder, brandFolderName) || monthFolder.createFolder(brandFolderName);

  const brand = sanitize_(body.brandName || body.acctId || 'brand');

  // 로고 저장 (파일명: 로고_{브랜드명}.png)
  let logoUrl = '';
  if (body.logo && body.logo.dataUrl) {
    logoUrl = saveDataUrl_(brandFolder, body.logo.dataUrl, '로고_' + brand + '.png');
  }
  // 연출컷 저장 (단일, 파일명: 연출컷_{브랜드명}.png)
  let shotUrl = '';
  if (body.shot && body.shot.dataUrl) {
    shotUrl = saveDataUrl_(brandFolder, body.shot.dataUrl, '연출컷_' + brand + '.png');
  }

  // brandDesc.txt 로도 함께 기록
  if (body.brandDesc) {
    const descFile = 'brandDesc.txt';
    const existing = brandFolder.getFilesByName(descFile);
    while (existing.hasNext()) existing.next().setTrashed(true);
    brandFolder.createFile(descFile, body.brandDesc, 'text/plain');
  }

  // 시트 업서트 (acctId 기준)
  const sh = ss.getSheetByName('Submissions');
  const b = body.benefit || {};
  const info = body.info || {};
  const row = [
    body.submittedAt || new Date().toISOString(),
    body.acctId || '',
    body.brandName || '',
    body.subvertical || '',
    body.contractTypeName || body.contractType || '',
    info.manager || '',
    info.phone || '',
    info.email || '',
    info.storeUrl || '',
    body.brandDesc || '',
    body.solutionAdded ? 'O' : '',
    b.b1 ? 'O' : '',
    b.b2 ? 'O' : '',
    b.b3 ? 'O' : '',
    logoUrl,
    shotUrl,
    brandFolder.getUrl(),
    JSON.stringify({
      info: info, benefit: b, brandDesc: body.brandDesc,
      logoUrl: logoUrl, shotUrl: shotUrl, brandFolder: brandFolder.getUrl(),
      submittedAt: body.submittedAt
    })
  ];
  upsertRow_(sh, 1, body.acctId, row);

  return { ok: true, logoUrl: logoUrl, shotUrl: shotUrl, folder: brandFolder.getUrl() };
}

function handleInquiry_(body) {
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));
  const sh = ss.getSheetByName('Inquiries');
  const ho = body.handoff || {};
  sh.appendRow([
    body.id || ('q-' + Date.now()),
    body.createdAt || new Date().toISOString(),
    body.acctId || '',
    body.brandName || '',
    body.type || '',
    body.msg || '',
    ho.name || '',
    ho.mail || '',
    ho.phone || '',
    'pending',
    '',
    ''
  ]);
  // 담당자 교체 시 이메일 알림 (운영 dl)
  if (body.type === '담당자교체') {
    try {
      MailApp.sendEmail({
        to: 'dl_babyvoucher@navercorp.com',
        subject: '[베이비바우처] 담당자 교체 공유 - ' + (body.brandName || body.acctId),
        body: (body.msg || '') + '\n\n접수 시각: ' + new Date().toLocaleString('ko-KR')
      });
    } catch (e) { Logger.log('mail fail: ' + e); }
  }
  return { ok: true };
}

function handleInquiryAnswer_(body) {
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));
  const sh = ss.getSheetByName('Inquiries');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.id) {
      sh.getRange(i+1, 10).setValue('done');       // status
      sh.getRange(i+1, 11).setValue(body.answer || '');
      sh.getRange(i+1, 12).setValue(new Date().toISOString());
      return { ok: true };
    }
  }
  return { ok: false, error: 'inquiry not found' };
}

function handleBannerLog_(body) {
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));
  ss.getSheetByName('BannerLogs').appendRow([
    body.at || new Date().toISOString(),
    body.acctId || '',
    body.bannerId || ''
  ]);
  return { ok: true };
}

// ==================== MONTHLY ZIP EXPORT ====================

function defaultYm_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
}

/**
 * 루트 폴더 하위의 월별(YYYY-MM) 폴더 목록 + 각 월 브랜드 폴더 수를 반환
 */
function listMonths_() {
  const root = DriveApp.getFolderById(props().getProperty('ROOT_FOLDER_ID'));
  const it = root.getFolders();
  const out = [];
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName();
    if (!/^\d{4}-\d{2}$/.test(name)) continue;
    let brandCount = 0;
    const bit = f.getFolders();
    while (bit.hasNext()) { bit.next(); brandCount++; }
    out.push({ ym: name, count: brandCount, folderUrl: f.getUrl() });
  }
  out.sort((a, b) => b.ym.localeCompare(a.ym));
  return out;
}

/**
 * 특정 월의 브랜드 폴더들을 ZIP 하나로 묶어 _exports/ 폴더에 저장
 * + summary.csv (제출 메타데이터) 포함
 * @return { ok, ym, count, zipUrl, directDownloadUrl }
 */
function exportMonthZip_(ym, by) {
  const root = DriveApp.getFolderById(props().getProperty('ROOT_FOLDER_ID'));
  const monthFolder = getChildFolder_(root, ym);
  if (!monthFolder) return { ok: false, error: '해당 월 폴더가 없습니다: ' + ym };

  // 1) 브랜드 폴더 순회 → Blob 리스트 구성 (경로를 포함한 이름으로)
  const blobs = [];
  const brands = [];
  const brandIt = monthFolder.getFolders();
  while (brandIt.hasNext()) {
    const brand = brandIt.next();
    const brandName = brand.getName();
    brands.push(brandName);
    const fileIt = brand.getFiles();
    while (fileIt.hasNext()) {
      const file = fileIt.next();
      const blob = file.getBlob().copyBlob();
      blob.setName(brandName + '/' + file.getName());
      blobs.push(blob);
    }
  }
  if (blobs.length === 0) return { ok: false, error: '이 달에 제출물이 없습니다: ' + ym };

  // 2) summary.csv 생성 (시트의 Submissions에서 해당 월 필터)
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));
  const rows = ss.getSheetByName('Submissions').getDataRange().getValues();
  const headers = rows.shift();
  const filtered = rows.filter(r => String(r[0] || '').startsWith(ym));
  const csvRows = [headers].concat(filtered);
  const csv = csvRows.map(r => r.map(csvEscape_).join(',')).join('\n');
  const csvBlob = Utilities.newBlob('\uFEFF' + csv, 'text/csv', '_summary.csv');
  blobs.push(csvBlob);

  // 3) ZIP 생성 + _exports 폴더에 저장
  const zipName = '베이비바우처_제출_' + ym + '.zip';
  const zipBlob = Utilities.zip(blobs, zipName);
  const exportsFolder = getChildFolder_(root, '_exports') || root.createFolder('_exports');
  // 같은 날짜에 여러 번 만들 수 있으므로 타임스탬프 suffix
  const stamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
  const finalName = zipName.replace('.zip', '_' + stamp + '.zip');
  zipBlob.setName(finalName);
  const zipFile = exportsFolder.createFile(zipBlob);
  zipFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 4) Exports 시트 로그
  ss.getSheetByName('Exports').appendRow([
    new Date().toISOString(), ym, brands.length, zipFile.getUrl(), by || ''
  ]);

  return {
    ok: true,
    ym: ym,
    count: brands.length,
    fileId: zipFile.getId(),
    zipUrl: zipFile.getUrl(),
    directDownloadUrl: 'https://drive.google.com/uc?export=download&id=' + zipFile.getId(),
    brands: brands
  };
}

function csvEscape_(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ==================== HELPERS ====================
function saveDataUrl_(folder, dataUrl, name) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return '';
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], name);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getChildFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}

function upsertRow_(sh, keyColIdx, keyVal, row) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][keyColIdx] === keyVal) {
      sh.getRange(i+1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

function sanitize_(name) {
  return String(name).replace(/[^\w.\-가-힣 ]/g, '_').slice(0, 80);
}
