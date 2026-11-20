// background/stats.js - 통계 수집/저장, 사이트별 카운트, 툴바 뱃지, 탭 추적
// AppState(background/state.js)를 통해 다른 모듈과 상태를 공유한다.

// 차단 주소 로그는 최대 5,000개까지만 보관 (전체 차단 횟수는 blockedRequests에 별도 누적)
const MAX_LOG_ENTRIES = 5000;
let saveTimer = null;
let siteSaveTimer = null;

// 저장된 통계 로드
function loadStats() {
  chrome.storage.local.get(["adBlockerStats"], (result) => {
    if (result.adBlockerStats) {
      // 이전 버전에 없던 필드도 기본값으로 채움
      AppState.stats = Object.assign(
        { blockedAds: 0, blockedRequests: 0, removedDomAds: 0, blockedLog: [], lastReset: Date.now() },
        result.adBlockerStats
      );
      if (!Array.isArray(AppState.stats.blockedLog)) AppState.stats.blockedLog = [];
    } else {
      saveStats();
    }
  });
}

// 통계 저장 (1초 단위로 묶어서 저장 - 요청 폭주 대비)
function saveStats() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    chrome.storage.local.set({ adBlockerStats: AppState.stats });
  }, 1000);
}

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
  if (!AppState.siteCounts.has(site)) AppState.siteCounts.set(site, { net: 0, dom: 0 });
  return AppState.siteCounts.get(site);
}

function siteTotal(site) {
  const c = site ? AppState.siteCounts.get(site) : null;
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
  if (AppState.tabSites.has(tabId)) {
    callback(AppState.tabSites.get(tabId));
    return;
  }
  const waiting = AppState.pendingTabLookups.get(tabId);
  if (waiting) {
    waiting.push(callback);
    return;
  }
  AppState.pendingTabLookups.set(tabId, [callback]);
  chrome.tabs.get(tabId, (tab) => {
    const callbacks = AppState.pendingTabLookups.get(tabId) || [];
    AppState.pendingTabLookups.delete(tabId);
    const site = !chrome.runtime.lastError && tab && tab.url ? siteOf(tab.url) : null;
    if (site) AppState.tabSites.set(tabId, site);
    callbacks.forEach((cb) => cb(site));
  });
}

// 현재 활성 탭의 뱃지만 갱신 (다른 탭 이벤트에는 반응하지 않음)
function updateBadgeForTab(tabId) {
  if (!AppState.enabledState) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  if (tabId !== AppState.activeTabId) return;
  resolveTabSite(tabId, (site) => {
    if (tabId !== AppState.activeTabId) return;
    chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
    chrome.action.setBadgeText({ text: formatBadge(siteTotal(site)) });
  });
}

// 사이트별 카운트를 local 저장소에 보관 (브라우저를 껐다 켜도 유지)
function saveSiteCounts() {
  if (siteSaveTimer) return;
  siteSaveTimer = setTimeout(() => {
    siteSaveTimer = null;
    const obj = {};
    AppState.siteCounts.forEach((value, key) => { obj[key] = value; });
    chrome.storage.local.set({ siteCounts: obj });
  }, 1000);
}

// 통계 초기화
function resetStats() {
  AppState.stats = {
    blockedAds: 0,
    blockedRequests: 0,
    removedDomAds: 0,
    blockedLog: [],
    lastReset: Date.now(),
  };
  saveStats();

  // 사이트별 카운트와 뱃지도 함께 초기화
  AppState.siteCounts.clear();
  saveSiteCounts();
  updateBadgeForTab(AppState.activeTabId);
}

// === 리스너 등록 ===

// 워커 시작 시 저장된 사이트별 카운트 복원
chrome.storage.local.get(["siteCounts"], (result) => {
  const stored = result && result.siteCounts;
  if (stored && typeof stored === "object") {
    Object.keys(stored).forEach((key) => {
      const value = stored[key];
      if (value && typeof value.net === "number") {
        AppState.siteCounts.set(key, { net: value.net || 0, dom: value.dom || 0 });
      }
    });
    updateBadgeForTab(AppState.activeTabId);
  }
});

// 네트워크 요청 차단 로그
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  AppState.stats.blockedRequests++;

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
    AppState.stats.blockedLog.unshift({ url, time: Date.now() });
    if (AppState.stats.blockedLog.length > MAX_LOG_ENTRIES) {
      AppState.stats.blockedLog.length = MAX_LOG_ENTRIES;
    }
  }
  saveStats();
});

// 탭 전환 / 페이지 이동 감지
chrome.tabs.onActivated.addListener(({ tabId }) => {
  AppState.activeTabId = tabId;
  updateBadgeForTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading") {
    const site = siteOf(changeInfo.url || (tab && tab.url));
    if (site) AppState.tabSites.set(tabId, site);
    else if (changeInfo.url) AppState.tabSites.delete(tabId);
    updateBadgeForTab(tabId);
  }
});

// 탭이 닫히면 탭-사이트 연결만 삭제 (사이트별 카운트는 유지)
chrome.tabs.onRemoved.addListener((tabId) => {
  AppState.tabSites.delete(tabId);
  AppState.pendingTabLookups.delete(tabId);
});

// 창 포커스가 바뀌어도 활성 탭 기준으로 갱신
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs[0]) {
      AppState.activeTabId = tabs[0].id;
      updateBadgeForTab(AppState.activeTabId);
    }
  });
});

// 초기 탭-사이트 매핑 복원 + 활성 탭 확인 후 뱃지 표시
chrome.tabs.query({}, (tabs) => {
  tabs.forEach((tab) => {
    const site = siteOf(tab.url);
    if (site) AppState.tabSites.set(tab.id, site);
    else AppState.tabSites.delete(tab.id);
  });
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (activeTabs) => {
    if (activeTabs[0]) {
      AppState.activeTabId = activeTabs[0].id;
      updateBadgeForTab(AppState.activeTabId);
    }
  });
});
