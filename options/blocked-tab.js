// options/blocked-tab.js - 우클릭으로 추가한 차단 요소 목록 편집
const STORAGE_KEY = "blockedSelectors";

let allSelectors = {};

function load() {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    allSelectors = res[STORAGE_KEY] || {};
    render();
  });
}

function save() {
  chrome.storage.local.set({ [STORAGE_KEY]: allSelectors });
}

function isValidSelector(value) {
  if (!value || !value.trim()) return false;
  try {
    document.querySelector(value);
    return true;
  } catch (e) {
    return false;
  }
}

function render() {
  const list = document.getElementById("blockedList");
  list.textContent = "";
  const sites = Object.keys(allSelectors);

  if (sites.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "차단한 요소가 없습니다. 웹사이트에서 광고를 우클릭해 차단해 보세요.";
    list.appendChild(empty);
    return;
  }

  sites.forEach((site) => {
    const card = document.createElement("div");
    card.className = "site-card";

    const head = document.createElement("div");
    head.className = "site-head";
    const name = document.createElement("span");
    name.className = "site-name";
    name.textContent = site;
    const count = document.createElement("span");
    count.className = "site-count";
    count.textContent = allSelectors[site].length + "개";
    head.appendChild(name);
    head.appendChild(count);
    card.appendChild(head);

    allSelectors[site].forEach((selector, index) => {
      const row = document.createElement("div");
      row.className = "selector-row";

      const text = document.createElement("span");
      text.className = "selector-text";
      text.textContent = selector;
      row.appendChild(text);

      const editBtn = document.createElement("button");
      editBtn.className = "secondary tiny";
      editBtn.textContent = "편집";
      editBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.className = "selector-input";
        input.value = selector;
        row.replaceChild(input, text);
        editBtn.remove();
        delBtn.remove();

        const saveBtn = document.createElement("button");
        saveBtn.className = "primary tiny";
        saveBtn.textContent = "저장";
        saveBtn.addEventListener("click", () => {
          const value = input.value.trim();
          if (!isValidSelector(value)) {
            alert("올바른 CSS 선택자가 아닙니다.");
            return;
          }
          allSelectors[site][index] = value;
          save();
          render();
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "secondary tiny";
        cancelBtn.textContent = "취소";
        cancelBtn.addEventListener("click", render);

        row.appendChild(saveBtn);
        row.appendChild(cancelBtn);
      });

      const delBtn = document.createElement("button");
      delBtn.className = "danger tiny";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", () => {
        allSelectors[site].splice(index, 1);
        if (allSelectors[site].length === 0) delete allSelectors[site];
        save();
        render();
      });

      row.appendChild(editBtn);
      row.appendChild(delBtn);
      card.appendChild(row);
    });

    const addRow = document.createElement("div");
    addRow.className = "add-row";
    const input = document.createElement("input");
    input.className = "selector-input";
    input.placeholder = "새 CSS 선택자 입력";
    const addBtn = document.createElement("button");
    addBtn.className = "primary tiny";
    addBtn.textContent = "추가";
    addBtn.addEventListener("click", () => {
      const value = input.value.trim();
      if (!isValidSelector(value)) {
        alert("올바른 CSS 선택자가 아닙니다.");
        return;
      }
      if (!allSelectors[site].includes(value)) allSelectors[site].push(value);
      save();
      render();
    });
    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    card.appendChild(addRow);

    const clearBtn = document.createElement("button");
    clearBtn.className = "secondary tiny";
    clearBtn.textContent = "이 사이트 전체 해제";
    clearBtn.style.marginTop = "8px";
    clearBtn.addEventListener("click", () => {
      if (confirm(site + "의 모든 차단 요소를 해제하시겠습니까?")) {
        delete allSelectors[site];
        save();
        render();
      }
    });
    card.appendChild(clearBtn);

    list.appendChild(card);
  });
}

export function initBlockedTab() {
  document.getElementById("blockedResetBtn").addEventListener("click", () => {
    if (confirm("모든 사이트의 차단 요소를 초기화하시겠습니까?")) {
      allSelectors = {};
      save();
      render();
    }
  });
  load();
}
