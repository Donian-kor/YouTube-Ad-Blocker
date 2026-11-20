// options/filters-tab.js - 필터 목록 렌더링 및 활성화/비활성화
import { FILTER_LIST } from "./config.js";

function loadFilterStates() {
  chrome.storage.local.get(["filterStates"], (result) => {
    const states = result.filterStates || {};
    FILTER_LIST.forEach((filter) => {
      const checkbox = document.getElementById("filter-" + filter.id);
      if (checkbox) {
        checkbox.checked = states[filter.id] !== undefined ? states[filter.id] : true;
      }
    });
  });
}

function saveFilterStates() {
  const states = {};
  FILTER_LIST.forEach((filter) => {
    const checkbox = document.getElementById("filter-" + filter.id);
    if (checkbox) {
      states[filter.id] = checkbox.checked;
    }
  });
  chrome.storage.local.set({ filterStates: states }, () => {
    chrome.runtime.sendMessage({ type: "applyFilterStates", states }, () => {
      void chrome.runtime.lastError;
    });
  });
}

function renderFilterList() {
  const container = document.getElementById("filterList");
  container.innerHTML = "";

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
    badge.className = "filter-badge";
    badge.textContent = filter.license;
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
    toggle.className = "toggle filter-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = "filter-" + filter.id;
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
    if (confirm("모든 필터를 비활성화하시겠습니까?\n광고 차단 기능이 크게 약화됩니다.")) {
      FILTER_LIST.forEach((filter) => {
        const checkbox = document.getElementById("filter-" + filter.id);
        if (checkbox) checkbox.checked = false;
      });
      saveFilterStates();
    }
  });
}
