// options/blocked-log-tab.js - 자동 차단 기록 (네트워크 / DOM 각각 최대 5,000건)
// 데이터: stats.blockedLog(네트워크), AppState.domLog(DOM), 전체 차단 횟수

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
  const modeButtons = document.querySelectorAll(".log-tab-btn");
  if (!container || !summaryEl) return;

  let networkLog = [];
  let domLog = [];
  let totalBlocked = 0;   // 네트워크 요청 차단 횟수 (blockedRequests)
  let domRemoved = 0;     // DOM 제거 횟수 (removedDomAds)
  let mode = "network";   // "network" | "dom"
  let keyword = "";

  function currentLog() {
    return mode === "dom" ? domLog : networkLog;
  }

  function summarize(hosts, count) {
    const total = totalBlocked + domRemoved;
    const breakdown = "네트워크 " + totalBlocked.toLocaleString() + " · DOM " + domRemoved.toLocaleString();
    const prefix = "총 " + total.toLocaleString() + "건 차단 (" + breakdown + ") · ";
    if (!count) {
      summaryEl.textContent = prefix + "표시할 기록이 없습니다.";
      return;
    }
    const entries = currentLog();
    const latest = Math.max(...entries.map((e) => e.time || 0));
    summaryEl.textContent = prefix + "기록 " + count.toLocaleString() + "건 · " +
      hosts.size.toLocaleString() + "개 사이트 · 마지막 차단 " + timeAgo(latest);
  }

  function render() {
    container.textContent = "";
    const entries = currentLog();

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "log-empty-state";
      empty.textContent = mode === "dom"
        ? "아직 DOM 제거 기록이 없습니다. 광고 요소가 숨겨지면 여기에 표시됩니다."
        : "아직 차단 기록이 없습니다. 광고가 막히면 여기에 표시됩니다.";
      container.appendChild(empty);
      summarize(new Map(), 0);
      return;
    }

    // 사이트별로 묶기 (최신 기록 순서 유지)
    const groups = new Map();
    for (const entry of entries) {
      const host = mode === "dom"
        ? (entry.site || "알 수 없는 사이트")
        : hostOf(entry && entry.url ? entry.url : "");
      const haystack = mode === "dom"
        ? host
        : (entry.url || "").toLowerCase();
      if (keyword && !host.toLowerCase().includes(keyword) && !haystack.includes(keyword)) continue;
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

    summarize(groups, entries.length);

    // 건수 많은 사이트부터
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [host, items] of sorted) {
      const card = document.createElement("div");
      card.className = "site-log-card";

      const head = document.createElement("div");
      head.className = "site-log-head";

      const name = document.createElement("span");
      name.className = "site-log-name";
      name.textContent = host;

      const count = document.createElement("span");
      count.className = "site-log-count";
      count.textContent = items.length + "건";

      const arrow = document.createElement("span");
      arrow.className = "site-log-arrow";
      arrow.textContent = "▼";

      head.appendChild(name);
      head.appendChild(count);
      head.appendChild(arrow);

      const body = document.createElement("div");
      body.className = "site-log-body";
      for (const entry of items.slice(0, 50)) {
        const row = document.createElement("div");
        row.className = "site-log-row";

        const time = document.createElement("span");
        time.className = "site-log-time";
        time.textContent = timeAgo(entry.time);
        time.title = fullTime(entry.time);

        const detail = document.createElement("span");
        detail.className = "site-log-path";
        if (mode === "dom") {
          detail.textContent = "광고 요소 " + (entry.count || 1) + "개 제거";
          detail.title = host + "에서 " + (entry.count || 1) + "개 제거 · " + fullTime(entry.time);
        } else {
          detail.textContent = pathOf(entry.url || "");
          detail.title = entry.url || "";
        }

        row.appendChild(time);
        row.appendChild(detail);
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
      networkLog = (res && res.log) || [];
      render();
    });
    chrome.runtime.sendMessage({ type: "getDomLog" }, (res) => {
      domLog = (res && res.log) || [];
      render();
    });
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.log || "network";
      render();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      keyword = searchInput.value.trim().toLowerCase();
      render();
    });
  }

  load();

  // 통계 초기화·토글 변경·DOM 기록 저장 시 목록 갱신
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.adBlockerStats || changes.adBlockerDomLog || changes.adBlockerEnabled)) {
      load();
    }
  });
}
