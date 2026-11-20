// options/stats.js - 통계 표시 및 재설정
export function initStats() {
  function loadStats() {
    chrome.storage.local.get(["adBlockerStats"], (result) => {
      const stats = result.adBlockerStats || {
        blockedAds: 0,
        blockedRequests: 0,
        removedDomAds: 0,
        lastReset: null
      };

      const network = stats.blockedRequests || 0;
      const dom = stats.removedDomAds || 0;
      document.getElementById("optTotal").textContent = (network + dom).toLocaleString();
      document.getElementById("optNetwork").textContent = network.toLocaleString();
      document.getElementById("optDom").textContent = dom.toLocaleString();

      if (stats.lastReset) {
        const date = new Date(stats.lastReset);
        document.getElementById("optReset").textContent =
          date.toLocaleDateString("ko-KR") + " " + date.toLocaleTimeString("ko-KR", { hour12: false });
      } else {
        document.getElementById("optReset").textContent = "-";
      }
    });
  }

  document.getElementById("optResetBtn").addEventListener("click", () => {
    if (confirm("통계를 재설정하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      chrome.runtime.sendMessage({ type: "resetStats" }, () => {
        loadStats();
      });
    }
  });

  loadStats();
  setInterval(loadStats, 3000);
}
