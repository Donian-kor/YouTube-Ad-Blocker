// options/blocked-log-tab.js - 자동으로 차단된 요청 기록 (사이트별 그룹)
// 데이터: background의 stats.blockedLog(최대 5,000건) + 전체 차단 횟수(blockedRequests)

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "알 수 없는 주소";
  } catch (e) {
    return "알 수 없는 주소";
  }
}

function pathOf(url) {
  try {
    const u = new URL(url);
    return (u.pathname || "/") + (u.search || "");
  } catch (e) {
    return url;
  }
}

function timeAgo(ts) {
  if (!ts || Number.isNaN(ts)) return "-";
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return "방금 전";
  if (diff < 60 * 60 * 1000) return Math.floor(diff / (60 * 1000)) + "분 전";
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / (60 * 60 * 1000)) + "시간 전";
  return new Date(ts).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function fullTime(ts) {
  if (!ts || Number.isNaN(ts)) return "";
  return new Date(ts).toLocaleString("ko-KR", { hour12: false });
}

export function initBlockedLogTab() {
  const container = document.getElementById("siteLogList");
  const searchInput = document.getElementById("logSearch");
  const summaryEl = document.getElementById("logSummary");
  if (!container || !summaryEl) return;

  let log = [];
  let totalBlocked = 0;   // 네트워크 요청 차단 횟수 (blockedRequests)
  let domRemoved = 0;     // DOM 제거 횟수 (removedDomAds) — 팝업 총합에 포함됨
  let keyword = "";

  function summarize(hosts) {
    const total = totalBlocked + domRemoved;
    const breakdown = "네트워크 " + totalBlocked.toLocaleString() + " · DOM " + domRemoved.toLocaleString();
    if (!log.length) {
      summaryEl.textContent = total
        ? "총 " + total.toLocaleString() + "건 차단 (" + breakdown + ") · 표시할 기록이 없습니다."
        : "아직 기록이 없습니다.";
      return;
    }
    const latest = Math.max(...log.map((e) => e.time || 0));
    summaryEl.textContent =
      "총 " + total.toLocaleString() + "건 차단 (" + breakdown + ") · 기록 " + log.length.toLocaleString() + "건 · " +
      hosts.size.toLocaleString() + "개 사이트 · 마지막 차단 " + timeAgo(latest);
  }

  function render() {
    container.textContent = "";

    if (!log.length) {
      const empty = document.createElement("div");
      empty.className = "log-empty-state";
      empty.textContent = "아직 차단 기록이 없습니다. 광고가 막히면 여기에 표시됩니다.";
      container.appendChild(empty);
      return;
    }

    // 사이트별로 묶기 (최신 로그顺序 유지)
    const groups = new Map();
    for (const entry of log) {
      const url = entry && entry.url ? entry.url : "";
      const host = hostOf(url);
      if (keyword && !host.includes(keyword) && !url.toLowerCase().includes(keyword)) continue;
      if (!groups.has(host)) groups.set(host, []);
      groups.get(host).push(entry);
    }

    if (groups.size === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty-state";
      empty.textContent = "검색 결과가 없습니다.";
      container.appendChild(empty);
      return;
    }

    summarize(groups);

    // 건수 많은 사이트부터
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [host, entries] of sorted) {
      const card = document.createElement("div");
      card.className = "site-log-card";

      const head = document.createElement("div");
      head.className = "site-log-head";

      const name = document.createElement("span");
      name.className = "site-log-name";
      name.textContent = host;

      const count = document.createElement("span");
      count.className = "site-log-count";
      count.textContent = entries.length + "건";

      const arrow = document.createElement("span");
      arrow.className = "site-log-arrow";
      arrow.textContent = "▼";

      head.appendChild(name);
      head.appendChild(count);
      head.appendChild(arrow);

      const body = document.createElement("div");
      body.className = "site-log-body";
      for (const entry of entries.slice(0, 50)) {
        const row = document.createElement("div");
        row.className = "site-log-row";

        const time = document.createElement("span");
        time.className = "site-log-time";
        time.textContent = timeAgo(entry.time);
        time.title = fullTime(entry.time);

        const path = document.createElement("span");
        path.className = "site-log-path";
        path.textContent = pathOf(entry.url || "");
        path.title = entry.url || "";

        row.appendChild(time);
        row.appendChild(path);
        body.appendChild(row);
      }

      head.addEventListener("click", () => {
        const open = body.classList.toggle("open");
        arrow.textContent = open ? "▲" : "▼";
      });

      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    }
  }

  function load() {
    chrome.runtime.sendMessage({ type: "getStats" }, (res) => {
      totalBlocked = (res && res.blockedRequests) || 0;
      domRemoved = (res && res.removedDomAds) || 0;
      render();
    });
    chrome.runtime.sendMessage({ type: "getBlockedLog" }, (res) => {
      log = (res && res.log) || [];
      render();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      keyword = searchInput.value.trim().toLowerCase();
      render();
    });
  }

  load();

  // 팝업/다른 탭에서 통계가 초기화되면 목록도 갱신
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.adBlockerStats || changes.adBlockerEnabled)) {
      load();
    }
  });
}
