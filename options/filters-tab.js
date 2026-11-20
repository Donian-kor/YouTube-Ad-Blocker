// options/filters-tab.js - 2단 필터 토글(카테고리 + 개별 소스), 업데이트, 이력
import { FILTER_LIST, SOURCE_LIST, LOCKED_SOURCES } from "./config.js";

function sourcesOf(categoryId) {
  return SOURCE_LIST.filter((s) => s.category === categoryId);
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

    const expand = document.createElement("button");
    expand.className = "expand-btn";
    expand.type = "button";
    expand.dataset.category = category.id;
    expand.textContent = "▼";
    expand.title = "소스별 필터 보기";
    expand.addEventListener("click", () => {
      const panel = document.getElementById("sources-" + category.id);
      if (!panel) return;
      const opening = !panel.classList.contains("open");
      panel.classList.toggle("open", opening);
      expand.textContent = opening ? "▲" : "▼";
    });
    nameRow.appendChild(expand);

    const desc = document.createElement("div");
    desc.className = "filter-desc";
    desc.textContent = category.description;

    // 소스별 목록 (그룹 이름을 함께 표시)
    const subPanel = document.createElement("div");
    subPanel.className = "subgroups";
    subPanel.id = "sources-" + category.id;
    sourcesOf(category.id).forEach((source) => {
      const row = document.createElement("label");
      row.className = "subgroup-row";
      row.htmlFor = "source-" + source.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "source-" + source.id;
      cb.dataset.source = source.id;
      cb.dataset.category = category.id;
      if (source.locked) cb.disabled = true;
      cb.addEventListener("change", saveFilterStates);

      const label = document.createElement("span");
      label.className = "subgroup-name";
      label.textContent = source.name;

      const groupTag = document.createElement("span");
      groupTag.className = "subgroup-group";
      groupTag.textContent = source.group;

      const count = document.createElement("span");
      count.className = "subgroup-count";
      count.textContent = (source.filterCount || 0).toLocaleString();

      row.appendChild(cb);
      row.appendChild(label);
      row.appendChild(groupTag);
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
      sourcesOf(category.id).forEach((s) => {
        const cb = document.getElementById("source-" + s.id);
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

    SOURCE_LIST.forEach((source) => {
      const cb = document.getElementById("source-" + source.id);
      if (!cb) return;
      const effective = source.locked ? true : (states[source.id] !== undefined ? states[source.id] : true);
      cb.checked = masterOn && effective;
      cb.disabled = source.locked || !masterOn;
    });

    FILTER_LIST.forEach((category) => {
      const input = document.getElementById("filter-" + category.id);
      if (!input) return;
      const boxes = sourcesOf(category.id)
        .map((s) => document.getElementById("source-" + s.id))
        .filter(Boolean);
      const onCount = boxes.filter((cb) => cb.checked).length;
      input.checked = boxes.length > 0 && onCount === boxes.length;
      input.indeterminate = onCount > 0 && onCount < boxes.length;
      input.disabled = category.locked || !masterOn;
      const card = document.getElementById("filter-card-" + category.id);
      if (card) card.classList.toggle("master-off", !masterOn);
    });
  });
}

function saveFilterStates() {
  const states = {};
  SOURCE_LIST.forEach((source) => {
    if (LOCKED_SOURCES.has(source.id)) {
      states[source.id] = true;
      return;
    }
    const cb = document.getElementById("source-" + source.id);
    if (cb) states[source.id] = cb.checked;
  });
  chrome.storage.local.set({ filterStates: states }, () => {
    chrome.runtime.sendMessage({ type: "applyFilterStates", states }, () => {
      void chrome.runtime.lastError;
    });
  });
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
    SOURCE_LIST.forEach((source) => {
      const cb = document.getElementById("source-" + source.id);
      if (cb && !cb.disabled) cb.checked = true;
    });
    saveFilterStates();
  });

  document.getElementById("filterAllOffBtn").addEventListener("click", () => {
    if (confirm("잠금 필터(국제 광고·보안)를 제외한 소스를 모두 비활성화하시겠습니까?")) {
      SOURCE_LIST.forEach((source) => {
        if (LOCKED_SOURCES.has(source.id)) return;
        const cb = document.getElementById("source-" + source.id);
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

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.adBlockerEnabled || changes.filterStates)) {
      loadFilterStates();
    }
  });
}

// === 업데이트 내역 ===
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
