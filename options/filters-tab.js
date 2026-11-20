// options/filters-tab.js - 2단 필터 토글(카테고리 + 소스 그룹), 업데이트, 이력
import { FILTER_LIST, GROUP_LIST, LOCKED_SOURCE_GROUPS } from "./config.js";

function groupsOf(categoryId) {
  return GROUP_LIST.filter((g) => g.category === categoryId);
}

function makeToggle(id, locked) {
  const toggle = document.createElement("label");
  toggle.className = "toggle" + (locked ? " locked" : "");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  if (locked) input.disabled = true;
  const slider = document.createElement("span");
  slider.className = "slider";
  toggle.appendChild(input);
  toggle.appendChild(slider);
  return { toggle, input };
}

function renderFilterList() {
  const container = document.getElementById("filterList");
  container.textContent = "";

  FILTER_LIST.forEach((category) => {
    const card = document.createElement("div");
    card.className = "filter-card category-card" + (category.locked ? " locked-card" : "");
    card.id = "filter-card-" + category.id;

    const left = document.createElement("div");
    left.className = "filter-info";

    const nameRow = document.createElement("div");
    nameRow.className = "filter-name-row";

    const icon = document.createElement("span");
    icon.className = "filter-icon";
    icon.textContent = category.icon;
    nameRow.appendChild(icon);

    const name = document.createElement("span");
    name.className = "filter-name";
    name.textContent = category.name;
    nameRow.appendChild(name);

    const badge = document.createElement("span");
    badge.className = "filter-badge count" + (category.locked ? " lock" : "");
    badge.textContent = "규칙 " + (category.filterCount || 0).toLocaleString() + "개";
    nameRow.appendChild(badge);

    // 펼치기 버튼
    const expand = document.createElement("button");
    expand.className = "expand-btn";
    expand.type = "button";
    expand.dataset.category = category.id;
    expand.textContent = "▼";
    expand.title = "소스별 필터 보기";
    expand.addEventListener("click", () => {
      const panel = document.getElementById("subgroups-" + category.id);
      if (!panel) return;
      const opening = !panel.classList.contains("open");
      panel.classList.toggle("open", opening);
      expand.textContent = opening ? "▲" : "▼";
    });
    nameRow.appendChild(expand);

    const desc = document.createElement("div");
    desc.className = "filter-desc";
    desc.textContent = category.description;

    // 소스 그룹 하위 목록
    const subPanel = document.createElement("div");
    subPanel.className = "subgroups";
    subPanel.id = "subgroups-" + category.id;
    groupsOf(category.id).forEach((group) => {
      const row = document.createElement("label");
      row.className = "subgroup-row";
      row.htmlFor = "group-" + group.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "group-" + group.id;
      cb.dataset.group = group.id;
      cb.dataset.category = category.id;
      if (group.locked) cb.disabled = true;
      cb.addEventListener("change", saveFilterStates);

      const label = document.createElement("span");
      label.className = "subgroup-name";
      label.textContent = group.name;

      const count = document.createElement("span");
      count.className = "subgroup-count";
      count.textContent = (group.filterCount || 0).toLocaleString();

      row.appendChild(cb);
      row.appendChild(label);
      row.appendChild(count);
      subPanel.appendChild(row);
    });

    left.appendChild(nameRow);
    left.appendChild(desc);
    left.appendChild(subPanel);

    const { toggle, input } = makeToggle("filter-" + category.id, category.locked);
    input.dataset.category = category.id;
    input.addEventListener("change", () => {
      const checked = input.checked;
      groupsOf(category.id).forEach((g) => {
        const cb = document.getElementById("group-" + g.id);
        if (cb && !cb.disabled) cb.checked = checked;
      });
      saveFilterStates();
    });

    card.appendChild(left);
    card.appendChild(toggle);
    container.appendChild(card);
  });
}

function loadFilterStates() {
  chrome.storage.local.get(["filterStates", "adBlockerEnabled"], (result) => {
    const states = result.filterStates || {};
    const masterOn = result.adBlockerEnabled !== false;

    GROUP_LIST.forEach((group) => {
      const cb = document.getElementById("group-" + group.id);
      if (!cb) return;
      const effective = group.locked ? true : (states[group.id] !== undefined ? states[group.id] : true);
      cb.checked = masterOn && effective;
      cb.disabled = group.locked || !masterOn;
    });

    FILTER_LIST.forEach((category) => {
      const input = document.getElementById("filter-" + category.id);
      if (!input) return;
      const groupBoxes = groupsOf(category.id)
        .map((g) => document.getElementById("group-" + g.id))
        .filter(Boolean);
      const onCount = groupBoxes.filter((cb) => cb.checked).length;
      input.checked = groupBoxes.length > 0 && onCount === groupBoxes.length;
      input.indeterminate = onCount > 0 && onCount < groupBoxes.length;
      input.disabled = category.locked || !masterOn;
      const card = document.getElementById("filter-card-" + category.id);
      if (card) card.classList.toggle("master-off", !masterOn);
    });
  });
}

function saveFilterStates() {
  const states = {};
  GROUP_LIST.forEach((group) => {
    if (LOCKED_SOURCE_GROUPS.has(group.id)) {
      states[group.id] = true;
      return;
    }
    const cb = document.getElementById("group-" + group.id);
    if (cb) states[group.id] = cb.checked;
  });
  chrome.storage.local.set({ filterStates: states }, () => {
    chrome.runtime.sendMessage({ type: "applyFilterStates", states }, () => {
      void chrome.runtime.lastError;
    });
  });
  // 카테고리 체크박스 상태도 즉시 갱신
  loadFilterStates();
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
    GROUP_LIST.forEach((group) => {
      const cb = document.getElementById("group-" + group.id);
      if (cb && !cb.disabled) cb.checked = true;
    });
    saveFilterStates();
  });

  document.getElementById("filterAllOffBtn").addEventListener("click", () => {
    if (confirm("잠금 필터(국제 광고·보안)를 제외한 필터를 비활성화하시겠습니까?")) {
      GROUP_LIST.forEach((group) => {
        if (LOCKED_SOURCE_GROUPS.has(group.id)) return;
        const cb = document.getElementById("group-" + group.id);
        if (cb) cb.checked = false;
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
          currentHistory = [res.historyEntry].filter(Boolean).concat(currentHistory);
          renderUpdateHistory(currentHistory);
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
