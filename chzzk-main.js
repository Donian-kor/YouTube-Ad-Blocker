// chzzk-main.js — 치지직(CHZZK) 광고 제거 (MAIN world)
// 기법 출처: FilteringDev/crackle (MPL-2.0) — 응답 후킹으로 광고 스케줄을 빈 응답으로 대체
//   - GFP Video Ad Schedule → 빈 스케줄
//   - Naver SSP Waterfall List → 빈 광고 목록
//   - /seoraksan endpoint → preRoll/midRoll=false
//   - 안티애드블록: display 계산 결과를 'block'으로 속임 + OPTIONS 요청 200 위조
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (!/chzzk\.naver\.com$/.test(location.hostname)) return;
  if (window.__yabChzzkMainInstalled) return;
  window.__yabChzzkMainInstalled = true;

  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  const NAVER_TRACK_RE = /^https:\/\/(?:siape\.veta|tivan)\.naver\.com\//;

  function isGfpSchedule(o) {
    try {
      return o && o.head && o.head.version === "0.0.1" && o.head.description === "GFP Video Ad Schedule" &&
        typeof o.requestId === "string" && UUID_RE.test(o.requestId) &&
        Array.isArray(o.adBreaks);
    } catch (e) { return false; }
  }
  function isWaterfall(o) {
    try {
      return o && o.head && o.head.version === "0.0.1" && o.head.description === "Naver SSP Waterfall List" &&
        Array.isArray(o.ads);
    } catch (e) { return false; }
  }
  function isSeoraksan(o) {
    try {
      return o && o.code === 200 && o.content && o.content.playerAdDisplayResponse &&
        typeof o.content.playerAdDisplayResponse.preRoll === "boolean";
    } catch (e) { return false; }
  }

  function emptyGfp() {
    return {
      head: { version: "0.0.1", description: "GFP Video Ad Schedule" },
      requestId: "vas-" + crypto.randomUUID(),
      videoAdScheduleId: "LIVE_CHZZK_NDP_SCH",
      adBreaks: [{ id: "", startDelay: 0, preFetch: 0, adUnitId: "", adSources: [] }]
    };
  }
  function emptyWaterfall() {
    return {
      requestId: Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      head: { version: "0.0.1", description: "Naver SSP Waterfall List" },
      eventTracking: {
        ackImpressions: [{ url: "https://siape.veta.naver.com/openrtb/nbackimp?" }],
        activeViewImpressions: [{ url: "https://siape.veta.naver.com/openrtb/nbackimp?" }],
        clicks: [{ url: "https://siape.veta.naver.com/openrtb/nbackimp?" }],
        completions: [{ url: "https://siape.veta.naver.com/openrtb/nbackimp?" }],
        attached: [{ url: "https://siape.veta.naver.com/openrtb/nbackimp?" }]
      },
      adUnit: "w_live_chzzk_naver_va",
      randomNumber: "00",
      adDivId: "live_player_layout",
      videoSkipMin: 5,
      videoSkipAfter: 5,
      ads: []
    };
  }
  function disableAds(o) {
    o.content.playerAdDisplayResponse.preRoll = false;
    o.content.playerAdDisplayResponse.midRoll = false;
    return o;
  }

  // 1) Uint8Array 생성자 프록시 — JSON 응답 디코딩 시 광고 응답을 빈 응답으로 교체
  try {
    const prefix = new TextEncoder().encode('{"');
    const OriginalU8 = window.Uint8Array;
    window.Uint8Array = new Proxy(OriginalU8, {
      construct(target, args) {
        if (!args.length || typeof args[0] === "number" || !(ArrayBuffer.isView(args[0]) || args[0] instanceof ArrayBuffer)) {
          return Reflect.construct(target, args);
        }
        try {
          const bytes = new Uint8Array(args[0]);
          if (bytes.length < 2 || bytes[0] !== prefix[0] || bytes[1] !== prefix[1]) {
            return Reflect.construct(target, args);
          }
          const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          const obj = JSON.parse(text);
          let replaced = null;
          if (isGfpSchedule(obj)) replaced = emptyGfp();
          else if (isWaterfall(obj)) replaced = emptyWaterfall();
          else if (isSeoraksan(obj)) replaced = disableAds(obj);
          if (replaced) {
            const encoded = new TextEncoder().encode(JSON.stringify(replaced));
            return Reflect.construct(target, [encoded]);
          }
        } catch (e) { /* 무시 */ }
        return Reflect.construct(target, args);
      }
    });
  } catch (e) { /* 프록시 실패해도 나머지는 동작 */ }

  // 2) 안티애드블록 우회 — 광고 클래스 요소의 display를 'block'으로 속임
  try {
    const adClasses = [
      ".TopAdBox", ".ad--dart", ".ad-container-side", ".ad-tag__wrapper", ".ad_regular1",
      ".ad_slot_inread", ".advert-loader", ".advertisementContainer", ".breaker-ad",
      ".inlineAd", ".ad-container1", ".ad-outline", ".ad-bottom-container", ".ads-468"
    ].map((s) => s.replace(/^\./, ""));
    const flagged = new WeakSet();

    const origGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (el) {
      const style = origGetComputedStyle.apply(this, arguments);
      if (el instanceof HTMLElement && el.classList) {
        const hit = adClasses.some((c) => el.classList.contains(c));
        if (hit) flagged.add(style);
      }
      return style;
    };
    const origGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
    CSSStyleDeclaration.prototype.getPropertyValue = function (prop) {
      if (prop === "display" && flagged.has(this)) return "block";
      return origGetPropertyValue.apply(this, arguments);
    };
  } catch (e) { /* 무시 */ }

  // 3) XHR OPTIONS 요청 위조 — nam.veta.naver.com 에 200/OK 반환
  try {
    const proto = XMLHttpRequest.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "status");
    if (desc && desc.get && desc.configurable) {
      const origStatus = desc.get;
      const origOpen = proto.open;
      const flags = new WeakMap();

      proto.open = function (method, url) {
        const isOptions = String(method).toUpperCase() === "OPTIONS" &&
          /^https:\/\/nam\.veta\.naver\.com\//.test(String(url));
        flags.set(this, isOptions);
        return origOpen.apply(this, arguments);
      };
      Object.defineProperty(proto, "status", {
        configurable: desc.configurable,
        enumerable: desc.enumerable,
        get: function () {
          if (flags.get(this) && this.readyState >= XMLHttpRequest.HEADERS_RECEIVED) return 200;
          return origStatus.call(this);
        }
      });
      const statusTextDesc = Object.getOwnPropertyDescriptor(proto, "statusText");
      if (statusTextDesc && statusTextDesc.configurable) {
        const origStatusText = statusTextDesc.get;
        Object.defineProperty(proto, "statusText", {
          configurable: true, enumerable: statusTextDesc.enumerable,
          get: function () {
            if (flags.get(this) && this.readyState >= XMLHttpRequest.HEADERS_RECEIVED) return "OK";
            return origStatusText ? origStatusText.call(this) : "OK";
          }
        });
      }
    }
  } catch (e) { /* 무시 */ }

  console.log("[www_AD_Blocker] 치지직 광고 응답 후킹 활성화 (crackle 기법)");
})();
