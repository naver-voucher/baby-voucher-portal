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

// ==================== SETUP (1회 실행) ====================
function setUp() {
  // 1. Root folder
  let folder = getFolderByName_(CONFIG.ROOT_FOLDER_NAME) || DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
  props().setProperty('ROOT_FOLDER_ID', folder.getId());

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
    'submittedAt','acctId','brandName','manager','phone','email','storeUrl','address',
    'desc','faqCount','logoUrl','shotsFolder','shotsCount','contractAgreed','signName','signDate','raw'
  ]);
  ensureSheet_(ss, 'Inquiries', [
    'id','createdAt','acctId','brandName','type','msg','status','answer','answeredAt'
  ]);
  ensureSheet_(ss, 'BannerLogs', ['at','acctId','bannerId']);

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

  // 브랜드별 폴더
  const root = DriveApp.getFolderById(rootId);
  const brandFolderName = (body.brandName || body.acctId || 'unknown') + ' (' + body.acctId + ')';
  let brandFolder = getChildFolder_(root, brandFolderName) || root.createFolder(brandFolderName);

  // 로고 저장
  let logoUrl = '';
  if (body.logo && body.logo.dataUrl) {
    logoUrl = saveDataUrl_(brandFolder, body.logo.dataUrl, 'logo_' + sanitize_(body.logo.name || 'logo.png'));
  }
  // 연출컷 저장
  let shotsFolderUrl = '';
  let shotsCount = 0;
  if (Array.isArray(body.shots) && body.shots.length) {
    const shotsFolder = getChildFolder_(brandFolder, 'shots') || brandFolder.createFolder('shots');
    shotsFolderUrl = shotsFolder.getUrl();
    body.shots.forEach((s, idx) => {
      if (s.dataUrl) {
        saveDataUrl_(shotsFolder, s.dataUrl, 'shot_' + (idx+1) + '_' + sanitize_(s.name || 'shot.jpg'));
        shotsCount++;
      }
    });
  }

  // 시트 업서트 (acctId 기준)
  const sh = ss.getSheetByName('Submissions');
  const row = [
    body.submittedAt || new Date().toISOString(),
    body.acctId || '',
    body.brandName || '',
    (body.info && body.info.manager) || '',
    (body.info && body.info.phone) || '',
    (body.info && body.info.email) || '',
    (body.info && body.info.storeUrl) || '',
    (body.info && body.info.address) || '',
    (body.info && body.info.desc) || '',
    (body.faq || []).filter(f => f.q).length,
    logoUrl,
    shotsFolderUrl,
    shotsCount,
    (body.contract && body.contract.agreed1 && body.contract.agreed2 && body.contract.agreed3) ? 'O' : '',
    (body.contract && body.contract.signName) || '',
    (body.contract && body.contract.signDate) || '',
    JSON.stringify({
      contract: body.contract, info: body.info, faq: body.faq,
      logoUrl: logoUrl, shotsFolder: shotsFolderUrl, shotsCount: shotsCount,
      submittedAt: body.submittedAt
    })
  ];
  upsertRow_(sh, 1 /* acctId column index (0-based 1) */, body.acctId, row);

  return { ok: true, logoUrl, shotsFolderUrl };
}

function handleInquiry_(body) {
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));
  const sh = ss.getSheetByName('Inquiries');
  sh.appendRow([
    body.id || ('q-' + Date.now()),
    body.createdAt || new Date().toISOString(),
    body.acctId || '',
    body.brandName || '',
    body.type || '',
    body.msg || '',
    'pending',
    '',
    ''
  ]);
  return { ok: true };
}

function handleInquiryAnswer_(body) {
  const ss = SpreadsheetApp.openById(props().getProperty('SHEET_ID'));
  const sh = ss.getSheetByName('Inquiries');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.id) {
      sh.getRange(i+1, 7).setValue('done');
      sh.getRange(i+1, 8).setValue(body.answer || '');
      sh.getRange(i+1, 9).setValue(new Date().toISOString());
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
