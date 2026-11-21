// www_AD_Blocker - MAIN world 스크립틀릿
// 유튜브 페이지의 "메인 세계"에서 실행되어 플레이어 응답의 광고 데이터를 제거한다.
// (content script는 격리된 세계라 페이지의 Promise/JSON.parse에 접근할 수 없음)
// 참고: uBlock Origin uAssets 의 ytInitialPlayerResponse set-constant / json-prune 기법
(function () {
  "use strict";
  // 유튜브 스튜디오는 광고 차단 대상이 아니므로 건너뜀
  if (typeof location !== "undefined" && location.hostname === "studio.youtube.com") return;
  if (window.__yabInstalled) return;
  window.__yabInstalled = true;

  // 광고 데이터 키 (uBO filters.txt / uAssets 기준)
  const AD_KEYS = ["adSlots", "playerAds", "adPlacements", "adBreakHeartbeatParams"];
  const NESTED_KEYS = ["playerResponse", "playerMicroformatRenderer"];
  const AD_KEY_REGEX = /"(adSlots|playerAds|adPlacements|adBreakHeartbeatParams)"\s*:/g;

  // content.js가 document_start에 심어둔 초기 토글 상태를 먼저 읽는다.
  // OFF 상태면 MAIN world 후킹 자체를 설치하지 않아 유튜브가 "광고 차단 중"으로
  // 감지하지 않도록 한다.
  let enabled = true;
  try {
    const initial = document.documentElement && document.documentElement.getAttribute("data-yab-enabled");
    if (initial === "0") {
      enabled = false;
      // 토글 메시지 리스너만 남기고 즉시 종료 — 후킹 흔적을 남기지 않는다
      installToggleListenerOnly();
      return;
    }
  } catch (e) { /* 무시 */ }

  // content script(격리 세계)에서 토글 상태를 전달받는다.
  // 고정 문자열만으로 위조할 수 없도록 매 로드마다 생성된 토큰을 함께 확인한다.
  function readStateToken() {
    try {
      return document.documentElement
        ? document.documentElement.getAttribute("data-yab-state-token")
        : null;
    } catch (e) {
      return null;
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "yab-extension" || data.type !== "enabled") return;
    const token = readStateToken();
    if (!token || data.token !== token) return; // 토큰 불일치 → 위조로 간주
    enabled = data.value !== false;
  });

  // OFF 상태에서 설치하는 최소 리스너: 토글이 켜지면 value=true 메시지를 받아
  // 페이지가 재로드되도록 popup이 처리하므로 여기서는 아무 후킹도 하지 않는다.
  function installToggleListenerOnly() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== "yab-extension" || data.type !== "enabled") return;
      const token = readStateToken();
      if (!token || data.token !== token) return;
      enabled = data.value !== false;
    });
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // 객체 한 겹에서 광고 키를 제거한다 (playerResponse 같은 중첩 구조는 호출부에서 처리)
  function deleteAdKeys(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const key of AD_KEYS) {
      if (hasOwn(obj, key)) delete obj[key];
    }
    // Shorts / 광고 클라이언트 파라미터의 isAd 플래그를 false로 되돌린다
    if (obj.adClientParams && typeof obj.adClientParams === "object") {
      obj.adClientParams.isAd = false;
    }
  }

  function cleanObject(value) {
    if (!value || typeof value !== "object") return value;
    deleteAdKeys(value);

    // playerResponse 로 한 번 더 감싼 구조도 처리
    for (const key of NESTED_KEYS) {
      const nested = value[key];
      if (nested && typeof nested === "object") deleteAdKeys(nested);
    }

    // Shorts 광고: reel_watch_sequence / get_watch 응답의 entries[].command...adClientParams.isAd
    const entryArrays = [];
    if (value.reelWatchSequenceResponse && value.reelWatchSequenceResponse.entries) {
      entryArrays.push(value.reelWatchSequenceResponse.entries);
    }
    if (value.entries) entryArrays.push(value.entries);
    for (const entries of entryArrays) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const endpoint = entry && entry.command && entry.command.reelWatchEndpoint;
        if (endpoint && endpoint.adClientParams) endpoint.adClientParams.isAd = false;
      }
    }
    return value;
  }

  function cleanText(text) {
    if (typeof text !== "string") return text;
    if (
      text.indexOf("adSlots") === -1 &&
      text.indexOf("playerAds") === -1 &&
      text.indexOf("adPlacements") === -1 &&
      text.indexOf("adBreakHeartbeatParams") === -1
    ) {
      return text;
    }
    return text.replace(AD_KEY_REGEX, '"no_ads":');
  }

  function clean(value) {
    if (!enabled) return value;
    return typeof value === "string" ? cleanText(value) : cleanObject(value);
  }

  // === 1) Promise.then 콜백 후킹 ===
  // 플레이어 응답을 처리하는 콜백(.next( 또는 jspbResponseCtor)만 골라 값을 정리한다.
  // 모든 then 콜백을 건드리면 유튜브 전체가 느려지므로 대상만 선별한다.
  const nativeThen = Promise.prototype.then;
  Promise.prototype.then = function (onFulfilled, onRejected) {
    if (typeof onFulfilled === "function" && enabled) {
      const src = Function.prototype.toString.call(onFulfilled);
      const isAdCallback = src.indexOf(".next(") !== -1 || src.indexOf("jsonpResponseCtor") !== -1;
      if (isAdCallback) {
        // 원본을 지역 변수에 반드시 캡처한다.
        // (그냥 onFulfilled를 재할당하면 클로저가 새 함수를 가리켜 무한 재귀가 발생한다)
        const original = onFulfilled;
        onFulfilled = function (value) {
          return original.call(this, clean(value));
        };
      }
    }
    return nativeThen.call(this, onFulfilled, onRejected);
  };

  // === 2) JSON.parse 후킹 ===
  const nativeParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const result = nativeParse.call(this, text, reviver);
    return enabled ? cleanObject(result) : result;
  };

  // === 3) Response.json 후킹 ===
  if (window.Response && window.Response.prototype && window.Response.prototype.json) {
    const nativeJson = window.Response.prototype.json;
    window.Response.prototype.json = function () {
      return nativeJson.call(this).then(clean);
    };
  }

  // === 4) XMLHttpRequest 응답 후킹 (uBO trusted-replace-xhr-response 대응) ===
  // 유튜브는 /youtubei/v1/player, /get_watch 응답을 XHR로 읽기도 한다.
  if (typeof XMLHttpRequest !== "undefined" && XMLHttpRequest.prototype) {
    ["responseText", "response"].forEach((prop) => {
      try {
        const desc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, prop);
        if (!desc || typeof desc.get !== "function") return;
        Object.defineProperty(XMLHttpRequest.prototype, prop, {
          configurable: true,
          get: function () {
            return clean(desc.get.call(this));
          }
        });
      } catch (e) {
        // 브라우저가 redefining을 막으면 이 후킹만 건너뛴다
      }
    });
  }

  // === 5) 초기 플레이어/데이터 응답 후킹 ===
  // 인라인 스크립트로 넣는 ytInitialPlayerResponse / ytInitialData 는 JSON.parse를 거치지 않는다.
  // document_start 시점에 setter를 미리 정의해 나중에 대입되는 값을 잡는다.
  function hookInitial(name) {
    try {
      let initial = window[name];
      if (initial && typeof initial === "object") cleanObject(initial);
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          return initial;
        },
        set(value) {
          initial = enabled ? cleanObject(value) : value;
        }
      });
    } catch (e) {
      // 정의 실패는 무시 (일반적인 경우 문제 없음)
    }
  }
  hookInitial("ytInitialPlayerResponse");
  hookInitial("ytInitialData");
})();
