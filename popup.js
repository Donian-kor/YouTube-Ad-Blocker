// popup.js - 팝업 UI 로직
(function () {
  "use strict";

  // === 토글 기능 ===
  const toggle = document.getElementById("enabledToggle");
  const toggleStatus = document.getElementById("toggleStatus");
  const statusText = document.getElementById("statusText");

  chrome.storage.local.get(["adBlockerEnabled"], (result) => {
    const enabled = result.adBlockerEnabled !== undefined ? result.adBlockerEnabled : true;
    toggle.checked = enabled;
    updateToggleUI(enabled);
  });

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ adBlockerEnabled: enabled });
    updateToggleUI(enabled);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes("youtube.com")) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "toggle", enabled }, () => {
          void chrome.runtime.lastError; // content script가 없으면 무시
        });
      }
    });
  });

  function updateToggleUI(enabled) {
    if (enabled) {
      toggleStatus.textContent = "활성화됨";
      toggleStatus.style.color = "#4ade80";
      statusText.classList.add("on");
      statusText.innerHTML = '<span class="dot"></span><span>광고 차단 중</span>';
    } else {
      toggleStatus.textContent = "비활성화됨";
      toggleStatus.style.color = "#888";
      statusText.classList.remove("on");
      statusText.innerHTML = '<span class="dot"></span><span>광고 차단 일시 중지</span>';
    }
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

  // === 차단 주소 목록 ===
  const totalCard = document.getElementById("totalCard");
  const logPanel = document.getElementById("logPanel");
  const logList = document.getElementById("logList");
  const logClose = document.getElementById("logClose");

  function renderLog() {
    chrome.runtime.sendMessage({ type: "getBlockedLog" }, (response) => {
      logList.innerHTML = "";

      if (!response || !response.log || response.log.length === 0) {
        logList.innerHTML = '<li class="log-empty">차단된 주소가 없습니다</li>';
        return;
      }

      response.log.slice(0, 100).forEach((entry) => {
        const li = document.createElement("li");

        const time = document.createElement("div");
        time.className = "log-time";
        time.textContent = new Date(entry.time).toLocaleTimeString("ko-KR", { hour12: false });

        const url = document.createElement("div");
        url.className = "log-url";
        url.textContent = entry.url;

        li.appendChild(time);
        li.appendChild(url);
        li.title = "클릭하면 전체 주소가 펼쳐집니다";
        li.addEventListener("click", () => li.classList.toggle("open"));

        logList.appendChild(li);
      });
    });
  }

  totalCard.addEventListener("click", () => {
    const opening = !logPanel.classList.contains("open");
    logPanel.classList.toggle("open");
    if (opening) renderLog();
  });

  logClose.addEventListener("click", () => {
    logPanel.classList.remove("open");
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

  // === 실행 및 주기적 갱신 ===
  updatePageCount();
  updateTotal();
  setInterval(() => {
    updatePageCount();
    updateTotal();
  }, 2000);
})();