// YouTube Ad Blocker - MAIN world 스크립틀릿
// 유튜브 페이지의 "메인 세계"에서 실행되어 플레이어 응답의 광고 데이터를 제거한다.
// (content script는 격리된 세계라 페이지의 Promise/JSON.parse에 접근할 수 없음)
(function () {
  "use strict";
  if (window.__yabInstalled) return;
  window.__yabInstalled = true;

  const AD_KEYS = ["adSlots", "playerAds", "adPlacements", "adBreakHeartbeatParams"];
  const AD_KEY_REGEX = /"(adSlots|playerAds|adPlacements|adBreakHeartbeatParams)"\s*:/g;

  let enabled = true;

  // content script(격리 세계)에서 토글 상태를 전달받는다
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.source === "yab-extension" && data.type === "enabled") {
      enabled = data.value !== false;
    }
  });

  function cleanObject(value) {
    if (!value || typeof value !== "object") return value;
    for (const key of AD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key)) delete value[key];
    }
    // playerResponse 같은 한 겹 감싼 구조도 처리
    if (value.playerResponse && typeof value.playerResponse === "object") {
      for (const key of AD_KEYS) {
        if (Object.prototype.hasOwnProperty.call(value.playerResponse, key)) {
          delete value.playerResponse[key];
        }
      }
    }
    return value;
  }

  function cleanText(text) {
    if (typeof text !== "string") return text;
    if (
      text.indexOf("adSlots") === -1 &&
      text.indexOf("playerAds") === -1 &&
      text.indexOf("adPlacements") === -1
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
  const hookableCache = new WeakMap();
  function isHookable(fn) {
    if (hookableCache.has(fn)) return hookableCache.get(fn);
    let ok = false;
    try {
      const src = Function.prototype.toString.call(fn);
      ok = src.indexOf(".next(") !== -1 || src.indexOf("jspbResponseCtor") !== -1;
    } catch (e) {
      ok = false;
    }
    hookableCache.set(fn, ok);
    return ok;
  }

  const nativeThen = Promise.prototype.then;
  Promise.prototype.then = new Proxy(nativeThen, {
    apply(target, thisArg, args) {
      if (enabled) {
        for (let i = 0; i < args.length; i++) {
          const fn = args[i];
          if (typeof fn !== "function" || !isHookable(fn)) continue;
          args[i] = function (value) {
            return fn.call(this, clean(value));
          };
        }
      }
      return Reflect.apply(target, thisArg, args);
    }
  });

  // === 2) JSON.parse 후킹 ===
  const nativeParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const result = nativeParse.call(this, text, reviver);
    return enabled ? cleanObject(result) : result;
  };

  // === 3) Response.json 후킹 ===
  if (window.Response && Response.prototype.json) {
    const nativeJson = Response.prototype.json;
    Response.prototype.json = function () {
      return nativeJson.call(this).then(clean);
    };
  }

  // === 4) initial player response 후킹 ===
  // 페이지가 인라인 스크립트로 넣는 ytInitialPlayerResponse 는 JSON.parse를 거치지 않는다.
  // document_start 시점에는 아직 없으므로, setter를 미리 정의해 나중에 대입되는 값을 잡는다.
  try {
    let initial = window.ytInitialPlayerResponse;
    if (initial && typeof initial === "object") cleanObject(initial);
    Object.defineProperty(window, "ytInitialPlayerResponse", {
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
})();
