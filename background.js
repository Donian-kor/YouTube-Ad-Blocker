// YouTube Ad Blocker - Background Service Worker
// 네트워크 레벨 괉고 차단 + 통계 관리

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
// 1~14: 이전 버전에서 등록된 잔여 규칙까지 모두 제거하기 위해 넓게 지정
const ALL_RULE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// EasyList/EasyPrivacy 변환 규칙 (manifest의 정적 규칙 세트 ID)
const STATIC_RULESET_IDS = ["general_1", "general_2", "general_3", "general_4", "general_5"];

function applyStaticRulesets(enabled) {
  chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled
      ? { enableRulesetIds: STATIC_RULESET_IDS }
      : { disableRulesetIds: STATIC_RULESET_IDS },
    () => {
      if (chrome.runtime.lastError) {
        console.error("정적 규칙 적용 실패:", chrome.runtime.lastError.message);
      }
    }
  );
}

function applyRules(enabled) {
  applyStaticRulesets(enabled);
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      addRules: enabled ? adBlockRules : [],
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

// === content script로 부터 메시지 수신 ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "adRemoved") {
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