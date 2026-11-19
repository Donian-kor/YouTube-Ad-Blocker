// popunder-blocker.js — skidrowreloaded.com의 클릭 시 광고 리다이렉트(popunder)를 막는다.
// 페이지 인라인 스크립트의 aclib.runPop({zoneId}) 호출을 무력화한다.
// MAIN world에서 실행되어 페이지의 window.aclib 정의를 가로챈다.
(function () {
  "use strict";
  if (window.__yabPopunderBlocked) return;
  window.__yabPopunderBlocked = true;

  let enabled = true;

  // aclib이 정의되어도 항상 실행 불가능한 noop 객체를 반환하게 한다.
  try {
    Object.defineProperty(window, "aclib", {
      configurable: false,
      get: function () {
        return { runPop: function () { return false; }, load: function () { return false; } };
      },
      set: function () {
        // 외부가 window.aclib = {...} 해도 무시한다
      }
    });
  } catch (e) {
    // redefine 실패 시 아래 window.open 가드가 fallback
  }

  // fallback: popunder가 window.open으로 새 창을 열 때 차단 (보험용)
  try {
    const nativeOpen = window.open;
    window.open = function (url, name, features) {
      if (enabled && typeof url === "string" &&
          /adbtg|popunder|affiliate|traffic|monetize|advert/i.test(url)) {
        return null;
      }
      return nativeOpen.apply(this, arguments);
    };
  } catch (e) {}

  // content script에서 토글 상태 전달
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (d && d.source === "yab-extension" && d.type === "enabled") {
      enabled = d.value !== false;
    }
  });
})();
