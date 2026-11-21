// popup.js - 팝업 UI 로직
(function () {
  "use strict";

  // === 토글 기능 ===
  const toggle = document.getElementById("enabledToggle");
  const toggleRow = document.querySelector(".toggle-row");
  const toggleStatusText = document.getElementById("toggleStatusText");

  chrome.storage.local.get(["adBlockerEnabled"], (result) => {
    const enabled = result.adBlockerEnabled !== undefined ? result.adBlockerEnabled : true;
    toggle.checked = enabled;
    updateToggleUI(enabled);
    updateActionIcon(enabled);
  });

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ adBlockerEnabled: enabled });
    updateToggleUI(enabled);

    // 아이콘을 회색/원래 상태로 즉시 전환 (시각적 OFF 표시)
    updateActionIcon(enabled);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;
      if (tab.url && tab.url.includes("youtube.com")) {
        chrome.tabs.sendMessage(tab.id, { type: "toggle", enabled }, () => {
          void chrome.runtime.lastError; // content script가 없으면 무시
        });
      }
      // 토글 ON/OFF 후 페이지를 새로고침해 광고 차단 상태를 즉시 반영
      if (tab.id !== undefined) chrome.tabs.reload(tab.id);
    });
  });

  function updateActionIcon(enabled) {
    if (!chrome.action || !chrome.action.setIcon) return;
    const path = enabled
      ? { 16: "icon16.png", 48: "icon48.png", 128: "icon128.png" }
      : { 16: "icon16-off.png", 48: "icon48-off.png", 128: "icon128-off.png" };
    chrome.action.setIcon({ path }, () => void chrome.runtime.lastError);
  }

  function updateToggleUI(enabled) {
    // ON: 초록 테두리+글씨 / OFF: 빨강 테두리+글씨
    if (toggleRow) toggleRow.classList.toggle("off", !enabled);
    toggleStatusText.textContent = enabled ? "광고 차단 중" : "광고 차단 일시 중지";
  }

  // === 현재 사이트 누적 차단 수 (가운데 큰 숫자) ===
  const pageBlocked = document.getElementById("pageBlocked");

  function updatePageCount() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.runtime.sendMessage({ type: "getTabCount", tabId: tabs[0].id }, (res) => {
        if (!res) return;
        pageBlocked.textContent = (res.total || 0).toLocaleString();
      });
    });
  }

  // === 총 차단 수 (아래 작은 숫자) ===
  function updateTotal() {
    chrome.runtime.sendMessage({ type: "getStats" }, (response) => {
      if (!response) return;
      const total = (response.blockedRequests || 0) + (response.removedDomAds || 0);
      document.getElementById("totalBlocked").textContent = total.toLocaleString();
    });
  }

  // === 총 차단 목록 → 설정 페이지의 '차단 기록' 탭으로 바로 이동 ===
  const totalCard = document.getElementById("totalCard");
  totalCard.addEventListener("click", () => {
    const optionsUrl = chrome.runtime.getURL("options.html");
    const target = optionsUrl + "#log";
    chrome.tabs.query({}, (tabs) => {
      const existing = tabs.find((t) => t.url && t.url.startsWith(optionsUrl));
      if (existing && existing.id !== undefined) {
        // 이미 열려 있으면 그 탭을 활성화하고 해시만 변경 (새로고침 없이 이동)
        chrome.tabs.update(existing.id, { url: target, active: true });
      } else {
        chrome.tabs.create({ url: target });
      }
    });
  });

  // === 버튼 ===
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("통계를 재설정하시겠습니까?")) {
      chrome.runtime.sendMessage({ type: "resetStats" }, () => {
        updatePageCount();
        updateTotal();
      });
    }
  });

  document.getElementById("optionsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // 요소 차단 모드: 현재 탭의 모든 프레임에서 선택 시작 (iframe 안 광고도 선택 가능)
  document.getElementById("pickBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || tabs[0].id === undefined) return;
      // frameId 없이 보내면 해당 탭의 모든 content script 프레임에 전달된다
      chrome.tabs.sendMessage(tabs[0].id, { type: "startElementPick" }, () => {
        void chrome.runtime.lastError; // content script가 없는 페이지면 무시
      });
      window.close();
    });
  });

  // 설정 페이지에서 전체 ON/OFF를 바꾸면 팝업도 즉시 반영
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.adBlockerEnabled) {
      const enabled = changes.adBlockerEnabled.newValue !== false;
      toggle.checked = enabled;
      updateToggleUI(enabled);
      updateActionIcon(enabled);
    }
  });

  // === 실행 및 주기적 갱신 ===
  updatePageCount();
  updateTotal();
  setInterval(() => {
    updatePageCount();
    updateTotal();
  }, 2000);
})();