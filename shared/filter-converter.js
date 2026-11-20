// filter-converter.js - Adblock/Rulet 변환 -> Chrome declarativeNetRequest 규칙
// 빌드 시점(tools/build-filters.js)과 런타임(background.filter-updater)에서 공용으로 사용한다.
// UMD 패턴: Node(CommonJS)와 브라우저(전역 FilterConverter) 모두 지원.
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.FilterConverter = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 리소스 타입 매핑
  const TYPE_MAP = {
    script: "script",
    image: "image",
    stylesheet: "stylesheet",
    css: "stylesheet",
    object: "object",
    xmlhttprequest: "xmlhttprequest",
    xhr: "xmlhttprequest",
    subdocument: "sub_frame",
    frame: "sub_frame",
    document: "main_frame",
    doc: "main_frame",
    media: "media",
    font: "font",
    ping: "ping",
    beacon: "ping",
    websocket: "websocket",
    other: "other",
  };

  // DNR로 표현할 수 없는 옵션 -> 해당 규칙 제외
  const SKIP_KEYS = new Set([
    "popup", "csp", "redirect", "redirect-rule", "removeparam", "rewrite", "empty", "mp4",
    "elemhide", "generichide", "genericblock", "specifichide", "cname", "webrtc",
    "header", "cookie", "method", "to", "denyallow", "permissions", "uritransform",
    "inline-script", "inline-font", "badfilter",
  ]);

  function normalizeBadfilter(line) {
    const i = line.lastIndexOf("$");
    if (i <= 0) return line;
    const opts = line.slice(i + 1).split(",").map((o) => o.trim());
    if (!opts.includes("badfilter")) return line;
    const rest = opts.filter((o) => o && o !== "badfilter");
    return rest.length ? line.slice(0, i) + "$" + rest.join(",") : line.slice(0, i);
  }

  function splitOptions(line) {
    const i = line.lastIndexOf("$");
    if (i <= 0) return [line, null];
    const after = line.slice(i + 1);
    if (after.includes("/")) return [line, null];
    return [line.slice(0, i), after];
  }

  function sanitizeDomain(d) {
    d = d.trim().toLowerCase();
    if (d.startsWith(".")) d = d.slice(1);
    if (!d) return null;
    if (/[*:/?#\s]/.test(d)) return null;
    return d;
  }

  function convertLine(rawLine) {
    let line = rawLine;
    // hosts 형식 ("0.0.0.0 example.com") → ||example.com^
    const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1|::1)\s+([a-zA-Z0-9.-]+)\s*$/);
    if (hostsMatch) {
      const domain = hostsMatch[1].toLowerCase();
      if (!domain || domain.indexOf(".") === -1) return null;
      return {
        priority: 11,
        action: { type: "block" },
        condition: { urlFilter: "||" + domain + "^" }
      };
    }
    // HTML 필터링($$)과 요소 숨김 잔여물은 DNR urlFilter로 표현할 수 없으므로 제외
    if (line.includes("$$")) return null;
    if (/^[\w-]+$/.test(line.trim())) return null;
    // DNR urlFilter는 "||" 바로 뒤에 "*"가 올 수 없음
    if (/\|\|\*/.test(line)) return null;
    let allow = false;
    if (line.startsWith("@@")) {
      allow = true;
      line = line.slice(2);
    }

    let [filter, optStr] = splitOptions(line);
    filter = filter.trim();
    if (!filter || filter.length > 2000) return null;
    if (/[^\x20-\x7e]/.test(filter)) return null;
    if (filter.startsWith("/")) return null;

    const condition = { urlFilter: filter };
    let resourceTypes = [];
    let excludedResourceTypes = [];
    let important = false;

    if (optStr) {
      for (let raw of optStr.split(",")) {
        raw = raw.trim();
        if (!raw) continue;

        let neg = false;
        if (raw.startsWith("~")) {
          neg = true;
          raw = raw.slice(1);
        }
        const eq = raw.indexOf("=");
        const key = (eq >= 0 ? raw.slice(0, eq) : raw).toLowerCase();
        const val = eq >= 0 ? raw.slice(eq + 1) : "";

        if (key === "domain") {
          const inc = [];
          const exc = [];
          for (let d of val.split("|")) {
            const clean = sanitizeDomain(d.replace(/^~/, ""));
            if (clean === null) return null;
            if (!clean) continue;
            if (d.startsWith("~")) exc.push(clean);
            else inc.push(clean);
          }
          if (inc.length) condition.initiatorDomains = inc;
          if (exc.length) condition.excludedInitiatorDomains = exc;
          continue;
        }
        if (key === "third-party" || key === "3p") {
          condition.domainType = neg ? "firstParty" : "thirdParty";
          continue;
        }
        if (key === "1p") {
          condition.domainType = neg ? "thirdParty" : "firstParty";
          continue;
        }
        if (key === "important") {
          important = true;
          continue;
        }
        if (key === "match-case") {
          condition.isUrlFilterCaseSensitive = true;
          continue;
        }
        if (key === "badfilter") return null;
        if (SKIP_KEYS.has(key)) return null;
        if (TYPE_MAP[key]) {
          if (neg) excludedResourceTypes.push(TYPE_MAP[key]);
          else resourceTypes.push(TYPE_MAP[key]);
          continue;
        }
        return null;
      }
    }

    if (resourceTypes.length) {
      condition.resourceTypes = [...new Set(resourceTypes)];
    } else if (excludedResourceTypes.length) {
      condition.excludedResourceTypes = [...new Set(excludedResourceTypes)];
    }

    return {
      priority: allow ? 10 : important ? 3 : 1,
      action: { type: allow ? "allow" : "block" },
      condition,
    };
  }

  return {
    TYPE_MAP,
    SKIP_KEYS,
    normalizeBadfilter,
    splitOptions,
    sanitizeDomain,
    convertLine,
  };
});
