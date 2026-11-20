// www_AD_Blocker - Content Script
// YouTube 페이지에 주입되어 광고 DOM을 제거하고 통계를 보고

(function () {
  "use strict";
  // 유튜브 스튜디오는 광고 차단 대상이 아니므로 건너뜀
  if (typeof location !== "undefined" && location.hostname === "studio.youtube.com") return;

  // === 활성화 상태 관리 ===
  let enabled = true;

  function applyEnabled(value) {
    enabled = value;
    const style = document.getElementById("yab-ad-hide-style");
    if (style) style.disabled = !enabled;

    // MAIN world(youtube-main.js)에 토글 상태 전달
    try {
      window.postMessage({ source: "yab-extension", type: "enabled", value: enabled }, "*");
    } catch (e) {
      // 전달 실패 시 무시
    }
  }

  function loadEnabled() {
    chrome.storage.local.get(["adBlockerEnabled"], (result) => {
      applyEnabled(result.adBlockerEnabled !== undefined ? result.adBlockerEnabled : true);
    });
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.adBlockerEnabled) {
      applyEnabled(changes.adBlockerEnabled.newValue);
    }
  });

  // 팝업에서 오는 toggle 메시지 수신
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "toggle") {
      applyEnabled(message.enabled);
    }
  });

  // === CSS로 광고 요소 즉시 숨김 (그려지기 전에 차단해 깜빡임 방지) ===
  function injectAdStyles() {
    if (document.getElementById("yab-ad-hide-style")) return;
    const style = document.createElement("style");
    style.id = "yab-ad-hide-style";
    const adSelectors = [
      "#masthead-ad",
      "#player-ads",
      "ytd-ad-slot-renderer",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-promoted-video-renderer",
      "ytd-in-feed-ad-layout-renderer",
      "ytd-display-ad-renderer",
      "ytd-banner-promo-renderer",
      "ytd-companion-slot-renderer",
      "ytd-merch-shelf-renderer",
      "ytd-inline-survey-renderer",
      "ytm-ad-banner-renderer",
      ".ytp-ad-overlay-container",
      ".ytp-ad-overlay-slot",
      ".ytp-ad-player-overlay",
      ".ytp-ad-progress-list",
      "[data-ad-t]",
      "[data-ad-slot]"
    ];
    // 유튜브 홈 그리드의 광고는 ytd-rich-item-renderer 셀 안에 들어 있다.
    // 광고 렌더러만 숨기면 셀이 빈 채로 남아 325x260px 공간이 보이므로 셀째로 숨긴다.
    const adGridCellSelector = "ytd-rich-item-renderer:has(ytd-ad-slot-renderer," +
      "ytd-promoted-sparkles-web-renderer,ytd-promoted-video-renderer," +
      "ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer," +
      "ytd-banner-promo-renderer,[data-ad-slot])";
    style.textContent = adSelectors.join(",") + "," + adGridCellSelector + "{display:none !important}";
    (document.head || document.documentElement).appendChild(style);
  }

  injectAdStyles();

  // === 광고 DOM 제거 ===
  const AD_SELECTORS = [
    // 데스크탑 유튜브 광고
    "#masthead-ad",
    "#player-ads",
    "ytd-ad-slot-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-display-ad-renderer",
    "ytd-banner-promo-renderer",
    "ytd-companion-slot-renderer",
    // 모바일/공통
    ".ytm-ad-banner-renderer",
    ".ad-banner",
    ".video-ads",
    ".ytp-ads-dialog",
    ".ytp-ad-overlay",
    ".ytp-ad-overlay-container",
    ".ytp-ad-image-overlay",
    ".ytp-ad-text-overlay",
    ".ytp-ad-button",
    ".ad-interrupting",
    "#player .ytp-ad-player-overlay",
    "#ad-player",
    ".html5-video-player .ad-",
    ".ytp-progress-list .ytp-ad",
    ".ytm-ad-slot-renderer",
    ".ytm-promoted-sparkles-video-renderer",
    ".ad-card",
    ".ads-card",
    ".skip-ads-button",
    ".ytp-button.ad-skip-button",
    ".ytm-ad-list-renderer",
    ".video-renderer .ad-badge",
    ".ad-under-video",
    ".ytp-ads",
    ".ytm-ad-player-overlay",
    // 최신 레이아웃 / 공통 광고 속성
    "ytd-merch-shelf-renderer",
    "ytd-inline-survey-renderer",
    ".ytp-ad-progress-list",
    "[data-ad-t]",
    "[data-ad-slot]"
  ];

  let removedCount = 0;

  // 선택자에 해당하는 요소를 "전부" 제거한다.
  // (querySelector 한 건만 지우면 같은 광고가 여러 개 있을 때 남는다)
  function removeAd(selector) {
    const elements = document.querySelectorAll(selector);
    let count = 0;
    for (const el of elements) {
      if (el && el.parentNode) {
        // 홈 그리드에서는 광고 렌더러를 감싼 셀도 함께 지워야 빈 칸이 남지 않는다.
        const cell = el.closest("ytd-rich-item-renderer");
        el.remove();
        if (cell && cell.parentNode) {
          const content = cell.querySelector("#content");
          if (content && content.children.length === 0) cell.remove();
        }
        count++;
      }
    }
    if (count > 0) removedCount += count;
    return count > 0;
  }

  function cleanupAds() {
    if (!enabled) return;
    AD_SELECTORS.forEach(removeAd);

    const overlays = document.querySelectorAll(
      "[class*='ad-overlay'], [class*='adOverlay'], [class*='ad-cover']"
    );
    overlays.forEach((el) => el.remove());

    skipVideoAds();
    restorePlayerControls();
  }

  // === 영상 광고 자동 스킵 ===
  // 유튜브 영상 광고는 본 영상과 같은 video 태그/CDN을 쓰기 때문에
  // 네트워크 차단 대신 "건너뛰기 버튼 클릭" 또는 "광고 끝으로 이동"으로 처리
  let adInProgress = false;

  function skipVideoAds() {
    if (!enabled) return;

    const player = document.querySelector(".html5-video-player.ad-showing");
    if (!player) {
      adInProgress = false;
      return;
    }

    const video = player.querySelector("video") || document.querySelector("video");
    const skipBtn = player.querySelector(
      ".ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button"
    );

    if (skipBtn && !skipBtn.disabled) {
      skipBtn.click();
    } else if (video && video.duration && isFinite(video.duration) && video.duration > 0) {
      // 광고 영상을 끝 지점으로 이동시켜 즉시 종료
      if (video.currentTime < video.duration - 0.5) {
        try {
          video.currentTime = video.duration - 0.1;
        } catch (e) {
          // 이동 실패 시 무시 (다음 틱에 재시도)
        }
      }
    }

    // 광고 1건당 한 번만 카운트
    if (!adInProgress) {
      adInProgress = true;
      removedCount++;
    }
  }

  function restorePlayerControls() {
    if (!enabled) return;
    const player = document.querySelector("#player");
    if (player) {
      player.style.visibility = "visible";
      player.style.opacity = "1";
    }
    const video = document.querySelector("video");
    if (video) {
      video.style.visibility = "visible";
    }
  }

  // === MutationObserver ===
  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    let changed = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        changed = true;
        break;
      }
    }
    if (changed) {
      setTimeout(cleanupAds, 300);
      setTimeout(cleanupAds, 1000);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 다른 스크립트(general-blocker.js)에 의해 안쪽만 지워진 그리드 셀도 정리한다.
  // 로딩 중인 셀을 지우지 않도록 일정 시간 이상 비어 있는 셀만 대상으로 한다.
  const emptyCellSince = new WeakMap();
  function cleanupEmptyGridCells() {
    if (!enabled) return;
    const now = Date.now();
    document.querySelectorAll("ytd-rich-item-renderer").forEach((cell) => {
      const content = cell.querySelector("#content");
      if (content && content.children.length === 0) {
        const since = emptyCellSince.get(cell);
        if (since === undefined) emptyCellSince.set(cell, now);
        else if (now - since >= 5000) cell.remove();
      } else {
        emptyCellSince.delete(cell);
      }
    });
  }

  // 주기적 재확인
  setInterval(() => {
    cleanupAds();
    cleanupEmptyGridCells();
  }, 2000);

  // 광고 스킵은 0.5초 간격으로 빠르게 감지
  setInterval(() => {
    skipVideoAds();
  }, 500);

  // 초기 실행
  setTimeout(() => {
    cleanupAds();
  }, 1000);

  // YouTube SPA 네비게이션 감지
  let lastUrl = location.href;
  const navObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(cleanupAds, 1500);
    }
  });
  navObserver.observe(document.body, { subtree: true, childList: true });

  // 제거된 광고 수를 주기적으로 background에 보고 (에러 핸들링 추가)
  setInterval(() => {
    if (!enabled) return;
    if (removedCount > 0) {
      try {
        chrome.runtime.sendMessage({ type: "adRemoved", count: removedCount }, () => {
          // chrome.runtime.lastError 무시 (background가 종료된 경우 등)
          if (chrome.runtime.lastError) {
            // 조용히 실패 처리
          }
        });
        removedCount = 0;
      } catch (e) {
        // 메시지 전송 실패 시 무시
      }
    }
  }, 3000);

  // 초기 상태 로드
  loadEnabled();
  console.log("www_AD_Blocker: 활성화됨");
})();