// general-blocker.js — 일반 웹사이트의 인라인 DOM 광고를 CSS로 숨긴다.
// tryblock.org 계열 테스트 페이지와, 흔히 쓰이는 광고 클래스/속성을 대상으로 한다.
// DNR(네트워크 차단)로 잡히지 않는 페이지 내부 광고를 여기서 처리한다.
(function () {
  "use strict";
  if (typeof location === "undefined") return;
  // 유튜브는 content.js/content-main hook이 전담하므로 중복 처리하지 않는다.
  if (location.hostname === "studio.youtube.com") return;
  if (window.__yabGeneralInstalled) return;
  window.__yabGeneralInstalled = true;

  let enabled = true;

  // 숨길 광고 선택자. 광고 전용 클래스/속성만 골라 오차단을 줄인다.
  const SELECTORS = [
    // tryblock.org 기본/중급/고급 테스트
    ".ad-container", ".banner-ad", ".demo-ad", ".ad-content", ".ad-label",
    ".ad-button", ".banner-container", ".banner-image", ".banner-content",
    ".banner-title", ".banner-description", ".sidebar-ad", ".sponsored-content",
    ".sponsored-container", ".sponsored-image", ".sponsored-title",
    ".sponsored-description", ".sponsored-footer", ".advertiser",
    ".inline-ad-container", ".inline-ad-wrapper", ".inline-ad-content",
    ".dynamic-ad", ".interactive-ad", ".floating-ad", ".video-overlay-ad",
    ".overlay-content", ".overlay-message", ".deceptive-ad", ".popup-chain",
    ".popup-preview", ".anti-adblock-test", ".anti-adblock-message",
    ".fake-download-button", ".fake-alert", ".fake-redirect",
    ".trigger-popup", ".fake-close-button",
    // 악성 리디렉션 체인 (고급 테스트)
    ".redirect-test", ".redirect-preview", ".redirect-icon",
    // 광고 차단 우회 챌린지의 감지 결과 메시지
    ".test-area .text-center", ".test-area .text-red-400",
    // 일반 사이트에서 흔한 광고 클래스
    ".adsbygoogle", ".advertisement", ".advert", ".ad-banner", ".ad-slot",
    ".ad-wrapper", ".ad-unit", ".ad-overlay", ".ad-modal", ".ad-popup",
    ".sponsor", ".promoted", "[data-ad]", "[data-ad-slot]",
    "[aria-label='advertisement']", "ins.adsbygoogle",
    "iframe[src*='googlesyndication']", "iframe[src*='doubleclick']",
    // dogdrip.net 전용 광고 슬롯 (고유 마커 enjgioijew + 좌측 배너 클래스)
    "iframe[enjgioijew]", ".clayerbox-left-ad", ".clayerbox-right-ad",
    // d3ward.com 코스메틱 필터 테스트 대상
    "#cts_test", "#ad_ctd"
  ].join(",");

  const STYLE_ID = "yab-general-hide-style";
  const RULE = SELECTORS + "{display:none !important;visibility:hidden !important;opacity:0 !important;height:0 !important;overflow:hidden !important}";

  // dogdrip.net은 광고 영역이 "보이는 상태"여야 서버가 정상 이용자로 판단한다.
  // display:none 대신 화면 밖으로 밀어내 광고는 안 보이게 하되, 감지 스크립트는 속인다.
  const DOGDRIP_HIDE_SELECTORS = "iframe[enjgioijew],.clayerbox-left-ad,.clayerbox-right-ad,.ddnad-wrapper,ins.kakao_ad_area,.ddnad";
  const DOGDRIP_RULE = DOGDRIP_HIDE_SELECTORS +
    "{position:absolute !important;left:-99999px !important;top:-99999px !important;visibility:visible !important;opacity:0 !important;pointer-events:none !important}";
  const isDogdrip = /(^|\.)dogdrip\.net$/.test(location.hostname);

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = isDogdrip ? DOGDRIP_RULE : RULE;
    (document.head || document.documentElement).appendChild(style);
  }

  function applyEnabled(value) {
    enabled = value !== false;
    const style = document.getElementById(STYLE_ID);
    if (style) style.disabled = !enabled;
  }

  // 저장된 토글 상태 로드 + 변경 감지
  try {
    chrome.storage.local.get(["adBlockerEnabled"], (res) => {
      applyEnabled(res.adBlockerEnabled !== undefined ? res.adBlockerEnabled : true);
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.adBlockerEnabled) applyEnabled(changes.adBlockerEnabled.newValue);
    });
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "toggle") applyEnabled(message.enabled);
    });
  } catch (e) {
    // storage 접근 불가 시 기본 활성 유지
  }

  injectStyle();

  // 동적으로 추가되는 광고 요소도 숨긴다 (스타일은 이미 !important라 새 요소도 바로 적용됨)
  // 추가로 DOM에서 완전히 제거해 체크/카운팅 로직이 오인하지 않게 한다.
  let removedCount = 0;
  function removeAds() {
    if (!enabled) return;
    // dogdrip은 광고 요소를 DOM에 남겨야 서버 감지를 우회할 수 있다 (CSS 숨김만 적용)
    if (isDogdrip) return;
    let removed = 0;
    try {
      document.querySelectorAll(SELECTORS).forEach((el) => {
        if (el && el.parentNode) {
          el.remove();
          removed++;
        }
      });
    } catch (e) {}
    if (removed > 0) {
      removedCount += removed;
      try {
        chrome.runtime.sendMessage({ type: "adRemoved", count: removed }, () => {
          void chrome.runtime.lastError;
        });
      } catch (e) {}
    }
  }

  const observer = new MutationObserver(() => {
    if (!enabled) return;
    // 스타일이 이미 숨기므로 제거는 여유 있게 배치 처리
    clearTimeout(observer._t);
    observer._t = setTimeout(removeAds, 250);
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });

  window.addEventListener("DOMContentLoaded", () => setTimeout(removeAds, 300));
  setTimeout(removeAds, 800);
})();
