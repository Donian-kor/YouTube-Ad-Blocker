// YouTube Ad Blocker - Background Service Worker
// 네트워크 레벨 광고 차단 + 통계 관리

// === 광고 차단 규칙 ===
// 광고 전용 도메인만 전체 차단. 영상 재생용 도메인(googlevideo 등)은 차단하지 않음
const adBlockRules = [
  // 광고/추적 전용 도메인 (YouTube 필수 리소스와 무관)
  { id: 1, priority: 1, action: { type: "block" }, condition: { urlFilter: "||doubleclick.net^" } },
  { id: 2, priority: 1, action: { type: "block" }, condition: { urlFilter: "||googlesyndication.com^" } },
  { id: 3, priority: 1, action: { type: "block" }, condition: { urlFilter: "||googleadservices.com^" } },
  { id: 4, priority: 1, action: { type: "block" }, condition: { urlFilter: "||google-analytics.com^" } },
  { id: 5, priority: 1, action: { type: "block" }, condition: { urlFilter: "||googletagmanager.com^" } },
  // YouTube 광고 스탯/추적 경로
  { id: 6, priority: 1, action: { type: "block" }, condition: { urlFilter: "||youtube.com/api/stats/ads" } },
  { id: 7, priority: 1, action: { type: "block" }, condition: { urlFilter: "||youtube.com/pagead/" } },
  // 구글 검색/콘텐츠 광고 경로
  { id: 8, priority: 1, action: { type: "block" }, condition: { urlFilter: "||google.com/pagead/" } },
  // 참고 필터(AdAway / NoriDev / List-KR) 기준 광고 전용 도메인 추가
  { id: 9,  priority: 1, action: { type: "block" }, condition: { urlFilter: "||2mdn.net^" } },
  { id: 10, priority: 1, action: { type: "block" }, condition: { urlFilter: "||googletagservices.com^" } },
  { id: 11, priority: 1, action: { type: "block" }, condition: { urlFilter: "||adservice.google.com^" } },
  { id: 12, priority: 1, action: { type: "block" }, condition: { urlFilter: "||ad.daum.net^" } },
  { id: 13, priority: 1, action: { type: "block" }, condition: { urlFilter: "||ad.naver.com^" } },
  { id: 14, priority: 1, action: { type: "block" }, condition: { urlFilter: "||wcs.naver.net^" } },
  // d3ward.com 광고 차단 테스트에서 누락된 도메인/스크립트
  // priority 11: 정적 필터의 allow(priority 10) 규칙을 덮어 차단되도록 보장
  { id: 15, priority: 11, action: { type: "block" }, condition: { urlFilter: "||udc.yahoo.com^" } },
  { id: 16, priority: 11, action: { type: "block" }, condition: { urlFilter: "||metrics.icloud.com^" } },
  { id: 17, priority: 11, action: { type: "block" }, condition: { urlFilter: "||iadsdk.apple.com^" } },
  { id: 18, priority: 11, action: { type: "block" }, condition: { urlFilter: "||d3ward.com/js/widget/ads.js" } },
  { id: 19, priority: 11, action: { type: "block" }, condition: { urlFilter: "||d3ward.com/js/pagead.js" } },
  // paileactivist/toolz (d3ward 구버전) 테스트에서 누락된 도메인
  { id: 20, priority: 11, action: { type: "block" }, condition: { urlFilter: "||ads.google.com^" } },
  { id: 21, priority: 11, action: { type: "block" }, condition: { urlFilter: "||affiliationjs.s3.amazonaws.com^" } },
  { id: 22, priority: 11, action: { type: "block" }, condition: { urlFilter: "||advertising-api-eu.amazon.com^" } },
  { id: 23, priority: 11, action: { type: "block" }, condition: { urlFilter: "||ads.facebook.com^" } },
  { id: 24, priority: 11, action: { type: "block" }, condition: { urlFilter: "||advertising.twitter.com^" } },
  { id: 25, priority: 11, action: { type: "block" }, condition: { urlFilter: "||ads-dev.pinterest.com^" } },
  { id: 26, priority: 11, action: { type: "block" }, condition: { urlFilter: "||widgets.pinterest.com^" } },
  { id: 27, priority: 11, action: { type: "block" }, condition: { urlFilter: "||ads.reddit.com^" } },
  { id: 28, priority: 11, action: { type: "block" }, condition: { urlFilter: "||d.reddit.com^" } },
  { id: 29, priority: 11, action: { type: "block" }, condition: { urlFilter: "||data.mistat.intl.xiaomi.com^" } },
  { id: 30, priority: 11, action: { type: "block" }, condition: { urlFilter: "||tracking.intl.miui.com^" } },
  { id: 31, priority: 11, action: { type: "block" }, condition: { urlFilter: "||tracking.india.miui.com^" } },
  { id: 32, priority: 11, action: { type: "block" }, condition: { urlFilter: "||securemetrics.apple.com^" } },
  { id: 33, priority: 11, action: { type: "block" }, condition: { urlFilter: "||supportmetrics.apple.com^" } },
  // raymondhill.net/ublock 네트워크 필터 테스트용 광고 iframe
  { id: 34, priority: 11, action: { type: "block" }, condition: { urlFilter: "||raymondhill.net/ublock/ad.html" } },
  { id: 35, priority: 11, action: { type: "block" }, condition: { urlFilter: "||usrpubtrck.com^" } },

  // === 해외 파일 공유 사이트 광고/추적 도메인 (v3.0) ===
  // gigafile / gofile / akirabox / buzzheavier 에서 사용하는 광고·추적·리다이렉트 도메인
  // - GigaFile: Ad-Shield, Geniee, i-mobile, tapad, gliastudios
  { id: 36, priority: 11, action: { type: "block" }, condition: { urlFilter: "||ad-shield.io^" } },
  { id: 37, priority: 11, action: { type: "block" }, condition: { urlFilter: "||geniee.jp^" } },
  { id: 38, priority: 11, action: { type: "block" }, condition: { urlFilter: "||genieesspv.jp^" } },
  { id: 39, priority: 11, action: { type: "block" }, condition: { urlFilter: "||i-mobile.co.jp^" } },
  { id: 40, priority: 11, action: { type: "block" }, condition: { urlFilter: "||3-q.cc^" } },
  { id: 41, priority: 11, action: { type: "block" }, condition: { urlFilter: "||tapad.com^" } },
  { id: 42, priority: 11, action: { type: "block" }, condition: { urlFilter: "||gliastudios.com^" } },
  { id: 43, priority: 11, action: { type: "block" }, condition: { urlFilter: "||shop.gliastudios.com^" } },
  // - 공통: 애드터스크(Adsterra) 계열 팝오버/언더 리다이렉트
  { id: 44, priority: 11, action: { type: "block" }, condition: { urlFilter: "||highperformanceformat.com^" } },
  { id: 45, priority: 11, action: { type: "block" }, condition: { urlFilter: "||effectivecpmnetwork.com^" } },
  { id: 46, priority: 11, action: { type: "block" }, condition: { urlFilter: "||profitablecpmrate.com^" } },
  { id: 47, priority: 11, action: { type: "block" }, condition: { urlFilter: "||profitablegatecpm.com^" } },
  { id: 48, priority: 11, action: { type: "block" }, condition: { urlFilter: "||clickadu.com^" } },
  { id: 49, priority: 11, action: { type: "block" }, condition: { urlFilter: "||hilltopads.net^" } },
  { id: 50, priority: 11, action: { type: "block" }, condition: { urlFilter: "||popads.net^" } },
  { id: 51, priority: 11, action: { type: "block" }, condition: { urlFilter: "||popcash.net^" } },
  { id: 52, priority: 11, action: { type: "block" }, condition: { urlFilter: "||onclickads.net^" } },
  { id: 53, priority: 11, action: { type: "block" }, condition: { urlFilter: "||onclksrv.com^" } },
  { id: 54, priority: 11, action: { type: "block" }, condition: { urlFilter: "||adcash.com^" } },
  { id: 55, priority: 11, action: { type: "block" }, condition: { urlFilter: "||exoclick.com^" } },
  { id: 56, priority: 11, action: { type: "block" }, condition: { urlFilter: "||exosrv.com^" } },
  { id: 57, priority: 11, action: { type: "block" }, condition: { urlFilter: "||juicyads.com^" } },
  { id: 58, priority: 11, action: { type: "block" }, condition: { urlFilter: "||admaven.com^" } },
  { id: 59, priority: 11, action: { type: "block" }, condition: { urlFilter: "||monetag.com^" } },
  { id: 60, priority: 11, action: { type: "block" }, condition: { urlFilter: "||adskeeper.com^" } },
  { id: 61, priority: 11, action: { type: "block" }, condition: { urlFilter: "||adpushup.com^" } },
  { id: 62, priority: 11, action: { type: "block" }, condition: { urlFilter: "||propellerads.com^" } },
  { id: 63, priority: 11, action: { type: "block" }, condition: { urlFilter: "||propellerclick.com^" } },
  { id: 64, priority: 11, action: { type: "block" }, condition: { urlFilter: "||adsterra.com^" } },
  { id: 65, priority: 11, action: { type: "block" }, condition: { urlFilter: "||adsco.re^" } },
  { id: 66, priority: 11, action: { type: "block" }, condition: { urlFilter: "||pushpros.com^" } },
  { id: 67, priority: 11, action: { type: "block" }, condition: { urlFilter: "||trafficforce.com^" } },
  { id: 68, priority: 11, action: { type: "block" }, condition: { urlFilter: "||clickfuse.com^" } },
];

// === 통계 관리 ===
// 차단 주소 로그는 최대 300개까지만 보관
const MAX_LOG_ENTRIES = 300;

let stats = {
  blockedAds: 0,
  blockedRequests: 0,
  removedDomAds: 0,
  blockedLog: [],   // [{ url, time }]
  lastReset: Date.now()
};

// 저장된 통계 로드
function loadStats() {
  chrome.storage.local.get(["adBlockerStats"], (result) => {
    if (result.adBlockerStats) {
      // 이전 버전에 없던 필드도 기본값으로 채움
      stats = Object.assign(
        { blockedAds: 0, blockedRequests: 0, removedDomAds: 0, blockedLog: [], lastReset: Date.now() },
        result.adBlockerStats
      );
      if (!Array.isArray(stats.blockedLog)) stats.blockedLog = [];
    } else {
      saveStats();
    }
  });
}

// 통계 저장 (1초 단위로 묶어서 저장 - 요청 폭주 대비)
let saveTimer = null;
function saveStats() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    chrome.storage.local.set({ adBlockerStats: stats });
  }, 1000);
}

// === 사이트(호스트)별 차단 수 + 뱃지 ===
// "www.youtube.com" -> { net: 네트워크 차단 수, dom: DOM 제거 수 }
// 페이지를 이동하거나 탭을 바꿔도 사이트별 숫자가 유지된다.
const siteCounts = new Map();
const tabSites = new Map();           // 탭 ID -> 현재 사이트(호스트)
const pendingTabLookups = new Map();  // 탭 ID -> 사이트 조회 대기 콜백
let activeTabId = -1;
let enabledState = true;

function siteOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "") || null;
  } catch (e) {
    return null;
  }
}

function getSiteCount(site) {
  if (!site) return null;
  if (!siteCounts.has(site)) siteCounts.set(site, { net: 0, dom: 0 });
  return siteCounts.get(site);
}

function siteTotal(site) {
  const c = site ? siteCounts.get(site) : null;
  return c ? c.net + c.dom : 0;
}

function formatBadge(total) {
  if (total <= 0) return "";
  if (total >= 10000) return "9999";
  if (total >= 1000) return (total / 1000).toFixed(1) + "k"; // 뱃지 최대 4자
  return String(total);
}

// 탭이 현재 보고 있는 사이트를 구한다. 매핑이 없으면 tabs.get으로 한 번만 조회한다.
function resolveTabSite(tabId, callback) {
  if (tabId === undefined || tabId === null || tabId < 0) {
    callback(null);
    return;
  }
  if (tabSites.has(tabId)) {
    callback(tabSites.get(tabId));
    return;
  }
  const waiting = pendingTabLookups.get(tabId);
  if (waiting) {
    waiting.push(callback);
    return;
  }
  pendingTabLookups.set(tabId, [callback]);
  chrome.tabs.get(tabId, (tab) => {
    const callbacks = pendingTabLookups.get(tabId) || [];
    pendingTabLookups.delete(tabId);
    const site = !chrome.runtime.lastError && tab && tab.url ? siteOf(tab.url) : null;
    if (site) tabSites.set(tabId, site);
    callbacks.forEach((cb) => cb(site));
  });
}

// 현재 활성 탭의 뱃지만 갱신 (다른 탭 이벤트에는 반응하지 않음)
function updateBadgeForTab(tabId) {
  if (!enabledState) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  if (tabId !== activeTabId) return;
  resolveTabSite(tabId, (site) => {
    if (tabId !== activeTabId) return;
    chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
    chrome.action.setBadgeText({ text: formatBadge(siteTotal(site)) });
  });
}

// 사이트별 카운트를 local 저장소에 보관 (브라우저를 껐다 켜도 유지)
let siteSaveTimer = null;
function saveSiteCounts() {
  if (siteSaveTimer) return;
  siteSaveTimer = setTimeout(() => {
    siteSaveTimer = null;
    const obj = {};
    siteCounts.forEach((value, key) => {
      obj[key] = value;
    });
    chrome.storage.local.set({ siteCounts: obj });
  }, 1000);
}

// 워커 시작 시 저장된 사이트별 카운트 복원
chrome.storage.local.get(["siteCounts"], (result) => {
  const stored = result && result.siteCounts;
  if (stored && typeof stored === "object") {
    Object.keys(stored).forEach((key) => {
      const value = stored[key];
      if (value && typeof value.net === "number") {
        siteCounts.set(key, { net: value.net || 0, dom: value.dom || 0 });
      }
    });
    updateBadgeForTab(activeTabId);
  }
});

// 통계 초기화
function resetStats() {
  stats = {
    blockedAds: 0,
    blockedRequests: 0,
    removedDomAds: 0,
    blockedLog: [],
    lastReset: Date.now()
  };
  saveStats();

  // 사이트별 카운트와 뱃지도 함께 초기화
  siteCounts.clear();
  saveSiteCounts();
  updateBadgeForTab(activeTabId);
}

// === 네트워크 요청 차단 로그 ===
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  stats.blockedRequests++;

  // 차단 요청이 발생한 탭의 "현재 사이트"에 누적
  const tabId = info ? info.tabId : -1;
  resolveTabSite(tabId, (site) => {
    if (!site) return;
    getSiteCount(site).net++;
    saveSiteCounts();
    updateBadgeForTab(tabId);
  });

  const url = info && info.request ? info.request.url : null;
  if (url) {
    stats.blockedLog.unshift({ url, time: Date.now() });
    if (stats.blockedLog.length > MAX_LOG_ENTRIES) {
      stats.blockedLog.length = MAX_LOG_ENTRIES;
    }
  }
  saveStats();
});

// === 규칙 활성화/비활성화 ===
// dogdrip.net은 광고 분석 스크립트가 로드되고 광고 영역이 보여야 서버가 정상 이용자로 판단한다.
// 차단 시 "광고 허용" 페이지로 리다이렉트되므로, dogdrip에서만 감지용 스크립트를 허용한다.
// (광고 배너 DOM은 general-blocker.js에서 계속 숨긴다.)
const DOGDRIP_DETECTION_DOMAINS = [
  "googletagmanager.com", "google-analytics.com", "googlesyndication.com",
  "doubleclick.net", "coupang.com", "optad360.io", "veta.naver.com",
  "cloudflareinsights.com", "daumcdn.net"
];
const dogdripAllowRules = DOGDRIP_DETECTION_DOMAINS.map((domain, i) => ({
  id: 101 + i,
  priority: 100,
  action: { type: "allow" },
  condition: { urlFilter: "||" + domain + "^", initiatorDomains: ["dogdrip.net"] }
}));

// 1~14: 이전 버전에서 등록된 잔여 규칙까지 모두 제거하기 위해 넓게 지정
// 100: YouTube Studio 허용 규칙 / 101~109: dogdrip 감지 우회 허용 규칙
// 36~68: 해외 파일 공유 사이트 광고 도메인 차단 규칙 (v3.0)
// 재적용 시 중복 ID 오류를 막기 위해 모두 함께 제거한다.
const ALL_RULE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64, 65, 66, 67, 68,
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109
];

// === 필터 활성화 상태 관리 ===
// manifest.json의 declarative_net_request.rule_resources와 1:1 대응
// 각 그룹은 여러 개의 규칙셋 파일로 분할될 수 있다.

// 그룹 -> manifest rule_resources ID 목록 매핑
const FILTER_TO_RULESET_IDS = {
  "ads": ["ads_1", "ads_2", "ads_3", "ads_4", "ads_5"],
  "korean": ["korean"],
  "privacy": ["privacy"],
  "anti_circumvention": ["anti_circumvention"],
  "annoyances": ["annoyances"],
  "security": ["security_1", "security_2", "security_3", "security_4", "security_5"],
};

// 모든 rule_resources ID (평탄화된 목록)
const STATIC_RULESET_IDS = Object.values(FILTER_TO_RULESET_IDS).flat();

// 필터 활성화 상태를 저장소에 저장하고 정적 규칙셋에 즉시 반영
function saveFilterStates(states, callback) {
  chrome.storage.local.set({ filterStates: states }, () => {
    applyStaticRulesetsByState(states);
    if (callback) callback();
  });
}

// 개별 필터 토글 상태를 rule_resources ID 배열로 변환
function expandFilterStates(states) {
  const expanded = {};
  Object.keys(FILTER_TO_RULESET_IDS).forEach((filterKey) => {
    const isOn = states[filterKey] !== undefined ? states[filterKey] : true;
    FILTER_TO_RULESET_IDS[filterKey].forEach((rid) => {
      expanded[rid] = isOn;
    });
  });
  return expanded;
}

// 필터 활성화 상태에 따라 정적 규칙셋을 개별적으로 켜고 끔
function applyStaticRulesetsByState(states) {
  const expanded = expandFilterStates(states);
  const enable = [];
  const disable = [];
  STATIC_RULESET_IDS.forEach((id) => {
    const isOn = expanded[id] !== undefined ? expanded[id] : true;
    if (isOn) enable.push(id);
    else disable.push(id);
  });
  const options = {};
  if (enable.length) options.enableRulesetIds = enable;
  if (disable.length) options.disableRulesetIds = disable;
  chrome.declarativeNetRequest.updateEnabledRulesets(options, () => {
    if (chrome.runtime.lastError) {
      console.error("정적 규칙 적용 실패:", chrome.runtime.lastError.message);
    }
  });
}

// 전체 ON/OFF 토글 시 정적 규칙셋 적용
// - enabled=true: filterStates를 존중하여 켜진 필터만 활성화
// - enabled=false: 모든 필터 비활성화
function applyStaticRulesets(enabled) {
  if (enabled) {
    // 필터 상태를 로드하여 개별 적용
    chrome.storage.local.get(["filterStates"], (result) => {
      const states = result.filterStates || {};
      applyStaticRulesetsByState(states);
    });
  } else {
    chrome.declarativeNetRequest.updateEnabledRulesets(
      { disableRulesetIds: STATIC_RULESET_IDS },
      () => {
        if (chrome.runtime.lastError) {
          console.error("정적 규칙 비활성화 실패:", chrome.runtime.lastError.message);
        }
      }
    );
  }
}

// ON/OFF 상태에 따라 툴바 아이콘을 교체한다 (OFF 시 회색 아이콘)
function updateActionIcon(enabled) {
  if (!chrome.action || !chrome.action.setIcon) return;
  const iconPath = enabled
    ? { 16: "icon16.png", 48: "icon48.png", 128: "icon128.png" }
    : { 16: "icon16-off.png", 48: "icon48-off.png", 128: "icon128-off.png" };
  chrome.action.setIcon({ path: iconPath }, () => void chrome.runtime.lastError);
  // OFF 상태임을 뱃지에도 표시 (통계 뱃지와 겹치지 않도록 빈 문자열 유지)
}

function applyRules(enabled) {
  applyStaticRulesets(enabled);
  updateActionIcon(enabled);
  // YouTube Studio 허용 규칙은 항상 적용 (광고 차단 대상이 아님)
  const studioAllowRule = { id: 100, priority: 100, action: { type: "allow" }, condition: { domainType: "firstParty", domains: ["studio.youtube.com"] } };
  // 항상 적용되는 허용 규칙: Studio + dogdrip 감지 우회
  const alwaysAllowRules = [studioAllowRule, ...dogdripAllowRules];
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      addRules: enabled ? [...alwaysAllowRules, ...adBlockRules] : alwaysAllowRules,
      removeRuleIds: ALL_RULE_IDS
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("규칙 적용 실패:", chrome.runtime.lastError.message);
      }
    }
  );
}

// 저장된 활성화 상태 로드 후 규칙 적용
function initRules() {
  chrome.storage.local.get(["adBlockerEnabled"], (result) => {
    const enabled = result.adBlockerEnabled !== undefined ? result.adBlockerEnabled : true;
    enabledState = enabled;
    applyRules(enabled);
    updateBadgeForTab(activeTabId);
  });
}

// === 확장 프로그램 설치 시 ===
chrome.runtime.onInstalled.addListener(() => {
  initRules();
  loadStats();
  console.log("YouTube Ad Blocker: 규칙 등록 완료");
});

// === 확장 프로그램 시작 시 ===
chrome.runtime.onStartup.addListener(() => {
  initRules();
  loadStats();
});

// === 토글 상태 변경 감지 ===
chrome.storage.onChanged.addListener((changes) => {
  if (changes.adBlockerEnabled) {
    const enabled = changes.adBlockerEnabled.newValue;
    enabledState = enabled;
    applyRules(enabled);
    updateBadgeForTab(activeTabId);
  }
});

// === 메시지 핸들러: 필터 활성화 상태 변경 ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "applyFilterStates" && message.states) {
    // 개별 필터 키를 rule_resources ID 배열로 확장하여 저장
    const expanded = {};
    Object.keys(message.states).forEach((filterKey) => {
      const ruleSetIds = FILTER_TO_RULESET_IDS[filterKey];
      if (ruleSetIds) {
        ruleSetIds.forEach((rid) => {
          expanded[rid] = message.states[filterKey];
        });
      }
    });
    saveFilterStates(expanded, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  // ... 나머지 메시지 핸들러
  else if (message.type === "adRemoved") {
    const count = message.count || 1;
    stats.removedDomAds += count;
    saveStats();

    // content script가 보낸 페이지 URL 기준으로 사이트에 누적
    const tabId = sender && sender.tab ? sender.tab.id : -1;
    const pageUrl = sender && sender.tab ? sender.tab.url : "";
    const site = siteOf(pageUrl);
    if (site) {
      if (tabId >= 0) tabSites.set(tabId, site);
      getSiteCount(site).dom += count;
      saveSiteCounts();
    }
    updateBadgeForTab(tabId);

    sendResponse({ success: true });
  }
  else if (message.type === "adBlocked") {
    stats.blockedAds++;
    saveStats();
    sendResponse({ success: true });
  }
  else if (message.type === "getStats") {
    // 로그 배열은 제외하고 요약만 전송 (2초마다 호출되므로 가볍게 유지)
    sendResponse({
      blockedAds: stats.blockedAds,
      blockedRequests: stats.blockedRequests,
      removedDomAds: stats.removedDomAds,
      lastReset: stats.lastReset
    });
  }
  else if (message.type === "resetStats") {
    resetStats();
    sendResponse({ success: true });
  }
  else if (message.type === "getBlockedLog") {
    sendResponse({ log: stats.blockedLog || [] });
  }
  else if (message.type === "getTabCount") {
    // 탭이 현재 보고 있는 사이트에 저장된 누적 차단 수
    resolveTabSite(message.tabId, (site) => {
      const c = site ? siteCounts.get(site) : null;
      sendResponse({
        total: c ? c.net + c.dom : 0,
        net: c ? c.net : 0,
        dom: c ? c.dom : 0,
        site: site || ""
      });
    });
    return true;
  }
  return true;
});

// === 우클릭 요소 차단 메뉴 ===
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "yab-block-element",
      title: "이 요소 차단",
      contexts: ["all"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    chrome.contextMenus.create({
      id: "yab-clear-site",
      title: "이 사이트의 직접 차단 요소 모두 해제",
      contexts: ["all"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
  });
}

setupContextMenus();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || tab.id === undefined) return;
  const frameId = info.frameId === undefined ? 0 : info.frameId;

  if (info.menuItemId === "yab-block-element") {
    // 우클릭한 프레임의 content script가 마지막 우클릭 요소를 차단한다.
    chrome.tabs.sendMessage(tab.id, { type: "blockLastRightClicked" }, { frameId }, () => {
      void chrome.runtime.lastError;
    });
  } else if (info.menuItemId === "yab-clear-site") {
    chrome.tabs.sendMessage(tab.id, { type: "clearSiteBlocks" }, { frameId: 0 }, () => {
      void chrome.runtime.lastError;
    });
  }
});

// === 탭 전환 / 페이지 이동 감지 ===
// 탭을 바꾸면 그 탭이 보고 있는 사이트의 저장된 차단 수를 표시
chrome.tabs.onActivated.addListener(({ tabId }) => {
  activeTabId = tabId;
  updateBadgeForTab(tabId);
});

// 페이지를 이동해도 사이트별 카운트는 유지하고, 새 사이트의 저장된 숫자를 표시
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading") {
    const site = siteOf(changeInfo.url || (tab && tab.url));
    if (site) tabSites.set(tabId, site);
    else if (changeInfo.url) tabSites.delete(tabId);
    updateBadgeForTab(tabId);
  }
});

// 탭이 닫히면 탭-사이트 연결만 삭제 (사이트별 카운트는 유지)
chrome.tabs.onRemoved.addListener((tabId) => {
  tabSites.delete(tabId);
  pendingTabLookups.delete(tabId);
});

// 창 포커스가 바뀌어도 활성 탭 기준으로 갱신
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs[0]) {
      activeTabId = tabs[0].id;
      updateBadgeForTab(activeTabId);
    }
  });
});

// 초기 탭-사이트 매핑 복원 + 활성 탭 확인 후 뱃지 표시
chrome.tabs.query({}, (tabs) => {
  tabs.forEach((tab) => {
    const site = siteOf(tab.url);
    if (site) tabSites.set(tab.id, site);
    else tabSites.delete(tab.id);
  });
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (activeTabs) => {
    if (activeTabs[0]) {
      activeTabId = activeTabs[0].id;
      updateBadgeForTab(activeTabId);
    }
  });
});

// 서비스 워커가 시작될 때마다 규칙을 현재 코드 기준으로 재적용
// (확장 새로고침 시 onInstalled가 안 불릴 수 있으므로)
initRules();
loadStats();