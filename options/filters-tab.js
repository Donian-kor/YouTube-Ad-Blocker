// options/filters-tab.js - 필터 목록 렌더링, 토글, 전체 업데이트
import { FILTER_LIST, LOCKED_GROUPS } from "./config.js";

function loadFilterStates() {
  chrome.storage.local.get(["filterStates", "adBlockerEnabled"], (result) => {
    const states = result.filterStates || {};
    const masterOn = result.adBlockerEnabled !== false; // 기본값 true
    FILTER_LIST.forEach((filter) => {
      const checkbox = document.getElementById("filter-" + filter.id);
      if (checkbox) {
        // 팝업에서 전체 일시중지 시 모든 필터가 꺼진 것으로 표시
        checkbox.checked = masterOn && (LOCKED_GROUPS.has(filter.id) ? true : (states[filter.id] !== undefined ? states[filter.id] : true));
        // 잠금 그룹은 원래 비활성화, 마스터 OFF 시에는 나머지도 조작 불가
        checkbox.disabled = LOCKED_GROUPS.has(filter.id) || !masterOn;
      }
      const card = document.getElementById("filter-card-" + filter.id);
      if (card) card.classList.toggle("master-off", !masterOn);
    });
  });
}

function saveFilterStates() {
  const states = {};
  FILTER_LIST.forEach((filter) => {
    if (LOCKED_GROUPS.has(filter.id)) {
      states[filter.id] = true;
      return;
    }
    const checkbox = document.getElementById("filter-" + filter.id);
    if (checkbox) states[filter.id] = checkbox.checked;
  });
  chrome.storage.local.set({ filterStates: states }, () => {
    chrome.runtime.sendMessage({ type: "applyFilterStates", states }, () => {
      void chrome.runtime.lastError;
    });
  });
}

function renderFilterList() {
  const container = document.getElementById("filterList");
  container.textContent = "";

  FILTER_LIST.forEach((filter) => {
    const card = document.createElement("div");
    card.className = "filter-card";
    card.id = "filter-card-" + filter.id;

    const left = document.createElement("div");
    left.className = "filter-info";

    const nameRow = document.createElement("div");
    nameRow.className = "filter-name-row";

    const icon = document.createElement("span");
    icon.className = "filter-icon";
    icon.textContent = filter.icon;
    nameRow.appendChild(icon);

    const name = document.createElement("span");
    name.className = "filter-name";
    name.textContent = filter.name;
    nameRow.appendChild(name);

    const badge = document.createElement("span");
    badge.className = "filter-badge count" + (LOCKED_GROUPS.has(filter.id) ? " lock" : "");
    badge.textContent = "규칙 " + (filter.filterCount || 0).toLocaleString() + "개";
    nameRow.appendChild(badge);

    const desc = document.createElement("div");
    desc.className = "filter-desc";
    desc.textContent = filter.description;

    left.appendChild(nameRow);
    left.appendChild(desc);

    const toggle = document.createElement("label");
    toggle.className = "toggle" + (LOCKED_GROUPS.has(filter.id) ? " locked" : "");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = "filter-" + filter.id;
    if (LOCKED_GROUPS.has(filter.id)) input.disabled = true;
    input.addEventListener("change", saveFilterStates);
    const slider = document.createElement("span");
    slider.className = "slider";
    toggle.appendChild(input);
    toggle.appendChild(slider);

    card.appendChild(left);
    card.appendChild(toggle);
    container.appendChild(card);
  });
}

function setUpdateStatus(message, kind) {
  const el = document.getElementById("filterUpdateStatus");
  el.textContent = message;
  el.className = "update-status" + (kind ? " " + kind : "");
}

export function initFiltersTab() {
  renderFilterList();
  loadFilterStates();

  document.getElementById("filterAllOnBtn").addEventListener("click", () => {
    FILTER_LIST.forEach((filter) => {
      const checkbox = document.getElementById("filter-" + filter.id);
      if (checkbox) checkbox.checked = true;
    });
    saveFilterStates();
  });

  document.getElementById("filterAllOffBtn").addEventListener("click", () => {
    if (confirm("광고 차단/보안을 제외한 필터를 비활성화하시겠습니까?")) {
      FILTER_LIST.forEach((filter) => {
        if (LOCKED_GROUPS.has(filter.id)) return;
        const checkbox = document.getElementById("filter-" + filter.id);
        if (checkbox) checkbox.checked = false;
      });
      saveFilterStates();
    }
  });

  const updateBtn = document.getElementById("filterUpdateBtn");
  updateBtn.addEventListener("click", () => {
    updateBtn.disabled = true;
    setUpdateStatus("필터를 업데이트하는 중...", "");
    chrome.runtime.sendMessage({ type: "updateFilters" }, (res) => {
      updateBtn.disabled = false;
      if (res && res.ok) {
        if (res.unchanged) {
          setUpdateStatus(res.reason ? "✅ " + res.reason : "신규 업데이트가 없습니다", "ok");
        } else {
          setUpdateStatus("✅ " + res.count.toLocaleString() + "개 규칙 업데이트 완료", "ok");
          renderUpdateHistory([res.historyEntry].filter(Boolean).concat(currentHistory));
          currentHistory = [res.historyEntry].filter(Boolean).concat(currentHistory);
        }
      } else {
        const reason = res && res.reason ? res.reason : "알 수 없는 오류";
        setUpdateStatus("❌ 업데이트 실패: " + reason, "err");
      }
    });
  });

  initUpdateHistory();

  // 팝업에서 전체 ON/OFF를 바꾸면 설정 페이지도 즉시 반영
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.adBlockerEnabled || changes.filterStates)) {
      loadFilterStates();
    }
  });
}

// === 업데이트 내역 (접기/펼치기) ===
let currentHistory = [];

function initUpdateHistory() {
  const toggleBtn = document.getElementById("historyToggleBtn");
  const panel = document.getElementById("historyPanel");
  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener("click", () => {
    const opening = !panel.classList.contains("open");
    panel.classList.toggle("open", opening);
    toggleBtn.textContent = opening ? "업데이트 내역 숨기기 ▲" : "업데이트 내역 보기 ▼";
    if (opening) loadUpdateHistory();
  });

  loadUpdateHistory();
}

function loadUpdateHistory() {
  if (typeof chrome === "undefined" || !chrome.runtime) return;
  chrome.runtime.sendMessage({ type: "getUpdateHistory" }, (res) => {
    currentHistory = (res && res.history) || [];
    renderUpdateHistory(currentHistory);
  });
}

function renderUpdateHistory(history) {
  const panel = document.getElementById("historyPanel");
  if (!panel) return;
  panel.textContent = "";

  if (!history || history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "업데이트 내역이 없습니다. '최신 필터 업데이트'를 눌러주세요.";
    panel.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    if (!entry || !entry.at) return;
    const row = document.createElement("div");
    row.className = "history-row";

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = new Date(entry.at).toLocaleString("ko-KR", { hour12: false });

    const detail = document.createElement("span");
    detail.className = "history-detail";
    detail.textContent = "신규 " + (entry.added || 0).toLocaleString() + "개" +
      (entry.duplicates ? " (중복 " + entry.duplicates.toLocaleString() + "개 제외)" : "");

    row.appendChild(date);
    row.appendChild(detail);
    panel.appendChild(row);
  });
}
