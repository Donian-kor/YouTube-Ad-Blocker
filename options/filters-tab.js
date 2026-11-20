// options/filters-tab.js - 필터 목록 렌더링, 토글, 전체 업데이트
import { FILTER_LIST, LOCKED_GROUPS } from "./config.js";

function loadFilterStates() {
  chrome.storage.local.get(["filterStates"], (result) => {
    const states = result.filterStates || {};
    FILTER_LIST.forEach((filter) => {
      const checkbox = document.getElementById("filter-" + filter.id);
      if (checkbox) {
        // 잠금 그룹은 항상 true
        checkbox.checked = LOCKED_GROUPS.has(filter.id) ? true : (states[filter.id] !== undefined ? states[filter.id] : true);
        checkbox.disabled = LOCKED_GROUPS.has(filter.id);
      }
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
    badge.className = "filter-badge" + (LOCKED_GROUPS.has(filter.id) ? " lock" : "");
    badge.textContent = LOCKED_GROUPS.has(filter.id) ? "🔒 항상 켜짐" : filter.license;
    nameRow.appendChild(badge);

    const desc = document.createElement("div");
    desc.className = "filter-desc";
    desc.textContent = filter.description;

    const source = document.createElement("div");
    source.className = "filter-source";
    source.textContent = "출처: " + filter.source;

    left.appendChild(nameRow);
    left.appendChild(desc);
    left.appendChild(source);

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
          setUpdateStatus("신규 업데이트가 없습니다", "ok");
        } else {
          setUpdateStatus("✅ " + res.count.toLocaleString() + "개 규칙 업데이트 완료", "ok");
        }
      } else {
        const reason = res && res.reason ? res.reason : "알 수 없는 오류";
        setUpdateStatus("❌ 업데이트 실패: " + reason, "err");
      }
    });
  });
}
