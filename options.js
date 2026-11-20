// options.js - 설정 페이지 로직
(function () {
  "use strict";

  // === 필터 목록 정의 ===
  // manifest.json의 declarative_net_request.rule_resources와 1:1 대응
  // 각 그룹은 사용자가 개별적으로 활성화/비활성화할 수 있다.
  const FILTER_LIST = [
    {
      id: "ads",
      name: "광고 차단",
      description: "전 세계 광고를 차단하는 기본 필터 (EasyList + EasyPrivacy + Ultimate Ad Filter)",
      license: "CC BY-SA 3.0 / GNU GPLv3",
      source: "EasyList, EasyPrivacy, AdBlocker Ultimate",
      icon: "📢"
    },
    {
      id: "korean",
      name: "한국 광고 필터",
      description: "국내 광고·트래커 차단 (NoriDev, Turtlecute, d3Host, 자체 목록)",
      license: "CC BY-NC-SA 4.0",
      source: "NoriDev, Turtlecute, d3Host, 자체 extra-hosts",
      icon: "🇰🇷"
    },
    {
      id: "privacy",
      name: "개인정보 보호",
      description: "소셜 미디어 통합 제거 + URL 추적 파라미터 제거",
      license: "CC BY-SA 3.0 / CC BY 3.0",
      source: "Fanboy's Social Blocking, URL Tracking filter",
      icon: "🔒"
    },
    {
      id: "anti_circumvention",
      name: "안티서클",
      description: "광고 우회 스크립트 차단 (영문/중문/유럽어권)",
      license: "GNU GPLv3",
      source: "abp-filters/abp-filters-anti-cv",
      icon: "🛡️"
    },
    {
      id: "annoyances",
      name: "성가신 요소",
      description: "팝업, 쿠키 동의, 배너 등 성가신 요소 차단",
      license: "CC BY 3.0",
      source: "Fanboy's Annoyance List",
      icon: "🧹"
    },
    {
      id: "security",
      name: "보안",
      description: "악성 도메인, 피싱, cryptomining 차단",
      license: "MIT / CC0 1.0",
      source: "NoCoin, URLhaus",
      icon: "🚨"
    }
  ];

  // === 통계 표시 ===
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

  // === 필터 활성화 상태 로드/저장 ===
  function loadFilterStates() {
    chrome.storage.local.get(["filterStates"], (result) => {
      const states = result.filterStates || {};
      FILTER_LIST.forEach((filter) => {
        const checkbox = document.getElementById("filter-" + filter.id);
        if (checkbox) {
          // 기본값은 true (켜짐)
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
      // background.js에 알려서 규칙 즉시 재적용
      chrome.runtime.sendMessage({ type: "applyFilterStates", states }, () => {
        void chrome.runtime.lastError;
      });
    });
  }

  // === 필터 목록 UI 렌더링 ===
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

  // === 통계 재설정 ===
  document.getElementById("optResetBtn").addEventListener("click", () => {
    if (confirm("통계를 재설정하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      chrome.runtime.sendMessage({ type: "resetStats" }, () => {
        loadStats();
      });
    }
  });

  // === 전체 필터 ON/OFF ===
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

  // === 초기화 ===
  renderFilterList();
  loadFilterStates();
  loadStats();
  setInterval(loadStats, 3000);
})();