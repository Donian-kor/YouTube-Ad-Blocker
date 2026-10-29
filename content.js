// YouTube Ad Blocker - Content Script
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
    style.textContent = [
      "#masthead-ad",
      "#player-ads",
      "ytd-ad-slot-renderer",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-promoted-video-renderer",
      "ytd-in-feed-ad-layout-renderer",
      "ytd-display-ad-renderer",
      "ytd-banner-promo-renderer",
      "ytd-companion-slot-renderer",
      ".ytp-ad-overlay-container",
      ".ytp-ad-overlay-slot"
    ].join(",") + "{display:none !important}";
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
    ".ytm-ad-player-overlay"
  ];

  let removedCount = 0;

  function removeAd(selector) {
    const el = document.querySelector(selector);
    if (el && el.parentNode) {
      el.remove();
      removedCount++;
      return true;
    }
    return false;
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

  // 주기적 재확인
  setInterval(() => {
    cleanupAds();
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
  console.log("YouTube Ad Blocker: 활성화됨");
})();