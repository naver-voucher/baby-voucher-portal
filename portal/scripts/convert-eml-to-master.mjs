#!/usr/bin/env node
// EML → 양식 마스터 HTML 변환 스크립트 (무의존성)
// 사용법: node convert-eml-to-master.mjs

import fs from 'node:fs';
import path from 'node:path';

const EML_DIR_CANDIDATES = [
  '/Users/user/Desktop/베이비바우처/베이비바우처 운영 자동화/eml',
  '/Users/user/Desktop/베이비바우처/admin-portal/eml',
];
const OUT_DIR = path.resolve('/Users/user/Desktop/베이비바우처 운영 자동화/portal/mail-templates-master');
const CATALOG_OUT = path.resolve('/Users/user/Desktop/베이비바우처 운영 자동화/portal/mail-master-catalog.json');

const EML_DIR = EML_DIR_CANDIDATES.find(p => fs.existsSync(p));
if (!EML_DIR) { console.error('EML 폴더 없음'); process.exit(1); }
console.log('EML 폴더:', EML_DIR);

// 매핑: 파일명 키워드 → 마스터 메타
const MAPPING = [
  { match: /계약 안내.*디자인 소재/, exclude: /리마인드/, id: '01-신규입점-계약-안내', category: '신규입점', title: '계약 안내 + 소재 취합 (#1)', whenToUse: 'D-2주' },
  { match: /리마인드.*계약 안내/, id: '02-신규입점-리마인드', category: '신규입점', title: '계약 안내 리마인드 (#2)', whenToUse: 'D-1주' },
  { match: /신규입점사.*에셋 전달/, exclude: /\(1\)/, id: '03-신규입점-에셋-전달', category: '신규입점', title: '에셋 전달 + 세팅 요청 (#3)', whenToUse: 'D-3일' },
  { match: /신규입점사 명단 공유/, id: '04-신규입점-명단-공유-내부', category: '신규입점', title: '신규입점 명단 공유 (내부)', whenToUse: '입점 직후' },
  { match: /슈퍼적립.*웰컴쿠폰/, id: '05-월간-슈퍼적립-제외', category: '월간', title: '슈퍼적립 웰컴쿠폰 제외 안내', whenToUse: '월초' },
  { match: /통합프로모션 공지/, id: '06-통합프로모션-공지', category: '월간', title: '베이비+펫 통합프로모션 공지', whenToUse: '프로모션 D-1주' },
  { match: /외부 매체 광고/, id: '07-외부광고-신청-안내', category: '외부', title: '브랜드 영상/외부 매체 광고 신청', whenToUse: '월간' },
  { match: /퇴점/, id: '08-퇴점-안내', category: '퇴점', title: '퇴점 일정 및 가이드', whenToUse: '퇴점 D-2주' },
];

// ============= MIME 파싱 =============
function decodeQP(s) {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function decodeQPBytes(s) {
  // QP → 바이트 배열
  const cleaned = s.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length) {
      out.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(cleaned.charCodeAt(i));
    }
  }
  return Buffer.from(out);
}
function decodeBase64(s) { return Buffer.from(s.replace(/\s+/g, ''), 'base64'); }

function parseHeaders(block) {
  const lines = block.split(/\r?\n/);
  const headers = {};
  let cur = null;
  for (const ln of lines) {
    if (/^[ \t]/.test(ln) && cur) { headers[cur] += ' ' + ln.trim(); continue; }
    const m = ln.match(/^([A-Za-z\-]+):\s*(.*)$/);
    if (m) { cur = m[1].toLowerCase(); headers[cur] = m[2]; }
  }
  return headers;
}
function getBoundary(ct) {
  const m = ct && ct.match(/boundary="?([^";]+)"?/i);
  return m ? m[1] : null;
}
function getCharset(ct) {
  const m = ct && ct.match(/charset="?([^";]+)"?/i);
  return m ? m[1].toLowerCase() : 'utf-8';
}

function decodeMimeHeader(s) {
  if (!s) return '';
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, cs, enc, data) => {
    try {
      const buf = enc.toUpperCase() === 'B' ? decodeBase64(data) : decodeQPBytes(data.replace(/_/g, ' '));
      return new TextDecoder(cs.toLowerCase()).decode(buf);
    } catch (e) { return data; }
  });
}

function parseMime(raw) {
  // raw: string
  const idx = raw.indexOf('\r\n\r\n') >= 0 ? raw.indexOf('\r\n\r\n') : raw.indexOf('\n\n');
  const headerBlock = raw.slice(0, idx);
  const body = raw.slice(idx).replace(/^\r?\n\r?\n/, '');
  const headers = parseHeaders(headerBlock);
  const ct = headers['content-type'] || 'text/plain';
  const cte = (headers['content-transfer-encoding'] || '7bit').toLowerCase();

  if (/multipart\//i.test(ct)) {
    const boundary = getBoundary(ct);
    if (!boundary) return { headers, parts: [], body };
    const parts = [];
    const splitter = '--' + boundary;
    const segs = body.split(splitter);
    for (const seg of segs) {
      if (!seg || seg.trim() === '--' || seg.trim() === '') continue;
      const trimmed = seg.replace(/^\r?\n/, '').replace(/\r?\n--\s*$/, '');
      parts.push(parseMime(trimmed));
    }
    return { headers, parts };
  }

  // 단일 part
  let buf;
  if (cte === 'base64') buf = decodeBase64(body);
  else if (cte === 'quoted-printable') buf = decodeQPBytes(body);
  else buf = Buffer.from(body, 'binary');
  const charset = getCharset(ct);
  let text;
  try { text = new TextDecoder(charset).decode(buf); }
  catch (e) { text = buf.toString('utf-8'); }
  return { headers, body: text, contentType: ct };
}

function findHtmlPart(node) {
  if (node.parts && node.parts.length) {
    // multipart/alternative: HTML 선호
    for (const p of node.parts) {
      const found = findHtmlPart(p);
      if (found) return found;
    }
    return null;
  }
  if (/text\/html/i.test(node.contentType || node.headers?.['content-type'] || '')) return node.body;
  return null;
}
function findTextPart(node) {
  if (node.parts && node.parts.length) {
    for (const p of node.parts) {
      const found = findTextPart(p);
      if (found) return found;
    }
    return null;
  }
  if (/text\/plain/i.test(node.contentType || node.headers?.['content-type'] || '')) return node.body;
  return null;
}

// ============= 변수 치환 =============
function applyVarPatterns(html) {
  const vars = new Set();
  let out = html;

  // 폼 URL
  out = out.replace(/https:\/\/naver\.me\/[A-Za-z0-9]+/g, () => { vars.add('{폼URL}'); return '{폼URL}'; });
  // 차수
  out = out.replace(/(\d+)\s*차(?=[\s가-힣<\.,])/g, () => { vars.add('{차수}'); return '{차수}차'; });
  // 풀 날짜
  out = out.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일(?:\([월화수목금토일]\))?/g, () => { vars.add('{날짜}'); return '{날짜}'; });
  // YYYY-MM-DD
  out = out.replace(/\b\d{4}-\d{2}-\d{2}\b/g, () => { vars.add('{마감일}'); return '{마감일}'; });
  // M/D 또는 M.D (간단 마감)
  out = out.replace(/(?<![\d\/])\d{1,2}\/\d{1,2}(?![\d\/])/g, () => { vars.add('{마감일}'); return '{마감일}'; });
  // 월 (단독 "5월" 등) — 변환 시 일반적 텍스트 보호 위해 본문 내 매칭만
  out = out.replace(/(?<=[\s>(\[，,。.\-~])\d{1,2}월(?=[\s<,.)\]，。\-~])/g, () => { vars.add('{월}'); return '{월}'; });

  return { html: out, vars: Array.from(vars) };
}

// ============= 메인 =============
fs.mkdirSync(OUT_DIR, { recursive: true });
const catalog = [];
const files = fs.readdirSync(EML_DIR).filter(f => f.endsWith('.eml'));

const subjectMap = {};

for (const file of files) {
  const map = MAPPING.find(m => m.match.test(file) && (!m.exclude || !m.exclude.test(file)));
  if (!map) { console.log('skip(no map):', file); continue; }
  // 중복 처리: 같은 ID는 첫 매칭만
  if (catalog.find(c => c.id === map.id)) { console.log('skip(dup):', file); continue; }

  const raw = fs.readFileSync(path.join(EML_DIR, file), 'utf-8');
  const parsed = parseMime(raw);
  const subject = decodeMimeHeader(parsed.headers['subject'] || '');
  let html = findHtmlPart(parsed);
  if (!html) {
    const text = findTextPart(parsed);
    html = text ? `<pre>${text.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>` : '<p>(본문 추출 실패)</p>';
  }

  // 변수 치환
  const { html: replaced, vars } = applyVarPatterns(html);

  // 본문만 추출 (body 태그 안)
  const bodyMatch = replaced.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : replaced;

  const headerComment = [
    `<!-- 마스터 ID: ${map.id} -->`,
    `<!-- 원본 Subject: ${subject.replace(/-->/g, '--&gt;')} -->`,
    `<!-- 사용 시점: ${map.whenToUse} -->`,
    `<!-- 변수 후보: ${vars.join(', ') || '(없음)'} -->`,
    `<!-- 사용법: 변수 자리에 실제 값 채워서 메일 클라이언트에 복사·붙여넣기. 브랜드명/회사명 등은 수동 변수화 권장 -->`,
  ].join('\n');

  const finalHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${map.title}</title>
${headerComment}
<style>body{font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111;line-height:1.6}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;

  const outPath = path.join(OUT_DIR, map.id + '.html');
  fs.writeFileSync(outPath, finalHtml, 'utf-8');
  subjectMap[map.id] = subject;
  catalog.push({
    id: map.id,
    category: map.category,
    title: map.title,
    whenToUse: map.whenToUse,
    variables: vars,
    originalSubject: subject,
    htmlPath: `mail-templates-master/${map.id}.html`,
  });
  console.log('OK:', map.id, '| vars:', vars.join(' '));
}

// 순서대로 정렬
catalog.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(CATALOG_OUT, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
console.log('\nCatalog written:', CATALOG_OUT);
console.log('Total:', catalog.length);
