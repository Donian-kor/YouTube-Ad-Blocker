// background/filter-updater.js - 필터 전체 업데이트 로직

// === 필터 업데이트 소스 정의 ===
// 각 그룹의 소스 URL과 동적 규칙 배분 상한 (전체 합계 29,713개 ≤ 30,000)
const FILTER_SOURCES = {
  ads: {
    limit: 19000,
    urls: [
      "https://easylist.to/easylist/easylist.txt",
      "https://easylist.to/easylist/easyprivacy.txt",
      "https://filters.adtidy.org/extension/chromium/filters/2.txt",
    ],
  },
  korean: {
    limit: 30000,
    urls: [
      "https://raw.githubusercontent.com/noridev/NoriDev-AdBlock-Filter/master/filter/filter.txt",
      "https://adblock.turtlecute.org/d3host.adblock",
      "https://raw.githubusercontent.com/d3ward/toolz/master/src/d3host.txt",
      "https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-AdGuard.txt",
    ],
  },
  privacy: {
    limit: 30000,
    urls: [
      "https://www.fanboy.co.nz/fanboy-social.txt",
      "https://filters.adtidy.org/extension/chromium/filters/17.txt",
    ],
  },
  anti_circumvention: {
    limit: 30000,
    urls: [
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/english.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/chinese.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/czech.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/french.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/german.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/polish.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/portuguese.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/russian.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/spanish.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/turkish.txt",
      "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/vietnamese.txt",
    ],
  },
  annoyances: {
    limit: 30000,
    urls: [
      "https://www.fanboy.co.nz/fanboy-annoyance.txt",
    ],
  },
  security: {
    limit: 6000,
    urls: [
      "https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt",
      "https://gitlab.com/curben/urlhaus-filter/-/raw/master/urlhaus-filter.txt",
    ],
  },
};

const COMMIT_ID_START = 1000;    // 업데이트 규칙 ID 대역 (기존 1~68, 100~109와 충돌 없음)
const MAX_DYNAMIC_RULES = 30000; // Chrome 전체 동적 규칙 한도
const MAX_FILTER_BYTES = 10 * 1024 * 1024; // 파일 10MB 제한 (AdGuard Base 약 7MB 대응)
const FETCH_TIMEOUT_MS = 10000;
const UPDATE_DEBOUNCE_MS = 10000;
let lastUpdateAt = 0;
let updateInProgress = false;

async function fetchFilterText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    if (text.length > MAX_FILTER_BYTES) throw new Error("파일 크기 초과 (" + Math.round(text.length / 1024 / 1024) + "MB)");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function convertFilterText(text, limit) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cancelled = new Set();
  for (const line of lines) {
    if (!line.startsWith("!") && !line.startsWith("[") && line.includes("badfilter")) {
      cancelled.add(FilterConverter.normalizeBadfilter(line));
    }
  }
  const rules = [];
  const seen = new Set();
  for (const line of lines) {
    if (!line || line.startsWith("!") || line.startsWith("[") || line.includes("#")) continue;
    if (line.startsWith("/")) continue;
    if (cancelled.has(FilterConverter.normalizeBadfilter(line))) continue;
    const rule = FilterConverter.convertLine(line);
    if (!rule) continue;
    const key = JSON.stringify([rule.action.type, rule.condition]);
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(rule);
    if (rules.length >= limit) break;
  }
  return rules;
}

function dnrUpdate(options) {
  return new Promise((resolve, reject) => {
    chrome.declarativeNetRequest.updateDynamicRules(options, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

async function updateFilters() {
  const now = Date.now();
  if (updateInProgress) return { ok: false, reason: "진행 중" };
  if (now - lastUpdateAt < UPDATE_DEBOUNCE_MS) return { ok: false, reason: "너무 빠른 재요청" };
  updateInProgress = true;
  lastUpdateAt = now;

  try {
    const allRules = [];
    for (const groupKey of Object.keys(FILTER_SOURCES)) {
      const src = FILTER_SOURCES[groupKey];
      let groupRules = [];
      for (const url of src.urls) {
        try {
          const text = await fetchFilterText(url);
          const converted = convertFilterText(text, src.limit - groupRules.length);
          groupRules = groupRules.concat(converted);
        } catch (e) {
          console.error("[필터 업데이트] " + url + " 실패: " + e.message);
        }
      }
      allRules.push(...groupRules.slice(0, src.limit));
    }

    if (allRules.length === 0) throw new Error("변환된 규칙이 없습니다");
    if (allRules.length > MAX_DYNAMIC_RULES) allRules.length = MAX_DYNAMIC_RULES;

    // 이전 업데이트 규칙 ID 수 계산 (저장된 개수만큼만 제거)
    const prev = await new Promise((resolve) => {
      chrome.storage.local.get(["dynamicRuleCount"], (res) => resolve(res.dynamicRuleCount || 0));
    });
    const oldIds = [];
    for (let i = 0; i < prev; i++) oldIds.push(COMMIT_ID_START + i);

    // 새 규칙을 COMMIT ID 대역으로 준비
    const committed = allRules.map((r, i) => Object.assign({}, r, { id: COMMIT_ID_START + i }));

    // 원자적 교체: 제거 + 추가를 한 번의 호출로 처리
    // 주의: 스테이징(임시 추가) 방식은 기존 규칙 + 신규 규칙이 동시에 존재해
    //       Chrome 전체 동적 규칙 한도(30,000개)를 초과하므로 사용하지 않는다.
    await dnrUpdate({ removeRuleIds: oldIds, addRules: committed });

    chrome.storage.local.set({
      updateStatus: { updatedAt: now, count: committed.length },
      dynamicRuleCount: committed.length,
    });
    updateInProgress = false;
    return { ok: true, count: committed.length };
  } catch (e) {
    // 실패 시 새로 추가된 규칙 롤백 (이전 확정 규칙은 보존됨)
    const rollbackIds = [];
    for (let i = 0; i < MAX_DYNAMIC_RULES; i++) rollbackIds.push(COMMIT_ID_START + i);
    try { await dnrUpdate({ removeRuleIds: rollbackIds }); } catch (ignore) { /* 무시 */ }
    updateInProgress = false;
    return { ok: false, reason: e.message };
  }
}

// === 메시지 핸들러: 필터 전체 업데이트 ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateFilters") {
    updateFilters().then((result) => sendResponse(result));
    return true;
  }
});
