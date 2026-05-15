#!/usr/bin/env node
/**
 * WORKS 캘린더 단방향 sync
 *   - 입력: WORKS_BEARER_TOKEN, WORKS_CALENDAR_ID (env)
 *   - 출력: portal/events.json
 *
 * WORKS API 정확한 spec 미확정이므로 두 가지 endpoint를 fallback 으로 시도:
 *   (A) https://www.worksapis.com/v1.0/users/me/calendar/events
 *   (B) https://kr0-prismgw.io.naver.com/mcp/api/tools/calendar_list_events  (MCP gateway)
 *
 * 환경:
 *   Node 20+ (global fetch)
 */

import fs from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.WORKS_BEARER_TOKEN;
const CALENDAR_ID = process.env.WORKS_CALENDAR_ID || "defaultCalendarId";
const OUT_PATH = path.resolve("portal/events.json");

if (!TOKEN) {
  console.error("[sync-works-calendar] ERROR: WORKS_BEARER_TOKEN env not set.");
  process.exit(1);
}

// 기간: 올해 1월 ~ 내년 1월
const now = new Date();
const from = `${now.getFullYear()}-01-01`;
const to = `${now.getFullYear() + 1}-01-31`;

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function pickColor(title = "") {
  const t = String(title).toLowerCase();
  if (/(퇴점|exit|중단|중지)/i.test(title)) return "red";
  if (/(입점|오픈|런칭|시작)/i.test(title)) return "blue";
  if (/(정산|완료|결재)/i.test(title)) return "green";
  if (/(마감|deadline|취합|제출)/i.test(title)) return "orange";
  if (/(회의|미팅|meeting)/i.test(title)) return "purple";
  return "blue";
}

function toEventItem(raw) {
  // WORKS 표준 응답은 start.date or start.dateTime
  const start =
    raw?.start?.date ||
    (raw?.start?.dateTime ? raw.start.dateTime.slice(0, 10) : null) ||
    raw?.startTime?.slice?.(0, 10) ||
    raw?.date ||
    null;
  if (!start) return null;

  const d = new Date(start + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;

  const title = raw?.summary || raw?.title || raw?.subject || "(제목 없음)";
  return {
    date: start,
    weekday: WEEKDAY_KO[d.getDay()],
    title,
    color: pickColor(title),
    source: "works",
    worksEventId: String(raw?.eventId || raw?.id || raw?.uid || ""),
  };
}

async function tryWorksApi() {
  const url = `https://www.worksapis.com/v1.0/users/me/calendar/events?fromDateTime=${from}T00:00:00&untilDateTime=${to}T23:59:59`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`worksapis.com ${res.status} ${res.statusText}`);
  const json = await res.json();
  const items = json?.events || json?.items || json?.value || [];
  return items;
}

async function tryMcpGateway() {
  const res = await fetch(
    "https://kr0-prismgw.io.naver.com/mcp/api/tools/calendar_list_events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ calendarId: CALENDAR_ID, from, to }),
    },
  );
  if (!res.ok) throw new Error(`mcp gateway ${res.status} ${res.statusText}`);
  const json = await res.json();
  const items = json?.events || json?.items || json?.data?.events || json?.result?.events || [];
  return items;
}

async function main() {
  let items = [];
  const errors = [];

  for (const fn of [tryWorksApi, tryMcpGateway]) {
    try {
      items = await fn();
      if (Array.isArray(items) && items.length >= 0) {
        console.log(`[sync-works-calendar] ${fn.name} OK (${items.length} events)`);
        break;
      }
    } catch (e) {
      errors.push(`${fn.name}: ${e.message}`);
      console.warn(`[sync-works-calendar] ${fn.name} failed: ${e.message}`);
    }
  }

  if (!items.length && errors.length === 2) {
    console.error("[sync-works-calendar] All endpoints failed:");
    errors.forEach((e) => console.error("  - " + e));
    if (/401|403/.test(errors.join(" "))) {
      console.error(
        "[sync-works-calendar] HINT: WORKS_BEARER_TOKEN 만료 가능성. 재발급 필요.",
      );
    }
    process.exit(2);
  }

  const events = items.map(toEventItem).filter(Boolean);
  events.sort((a, b) => a.date.localeCompare(b.date));

  await fs.writeFile(OUT_PATH, JSON.stringify(events, null, 2) + "\n", "utf8");
  console.log(`[sync-works-calendar] wrote ${events.length} events -> ${OUT_PATH}`);
}

main().catch((e) => {
  console.error("[sync-works-calendar] FATAL:", e);
  process.exit(1);
});
