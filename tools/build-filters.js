// EasyList / EasyPrivacy / AdBlocker Ultimate -> Chrome declarativeNetRequest 규칙 변환기
// 사용법: node tools/build-filters.js
//        node tools/build-filters.js --korean
//        node tools/build-filters.js --adblockultimate
//        node tools/build-filters.js --all
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "filters");
const TMP_DIR = path.join(__dirname, "tmp");

// === 필터 소스 정의 ===
// 각 필터 그룹은 여러 개의 소스 URL을 가질 수 있다.
// 라이선스는 각 소스의 LICENSE를 따른다.

const LISTS = [
  ["easylist", "https://easylist.to/easylist/easylist.txt"],
  ["easyprivacy", "https://easylist.to/easylist/easyprivacy.txt"],
];

const KOREAN_LISTS = [
  ["noridev", "https://raw.githubusercontent.com/noridev/NoriDev-AdBlock-Filter/master/filter/filter.txt"],
  ["turtlecute", "https://adblock.turtlecute.org/d3host.adblock"],
  ["d3host", "https://raw.githubusercontent.com/d3ward/toolz/master/src/d3host.txt"],
  ["extra-hosts", "file:tools/tmp/extra-hosts.txt"],
];

// AdBlocker Ultimate 전체 필터 (Ultimate Ad Filter + Fanboy's Korean + Fanboy's Annoyance)
const ADULT_LISTS = [
  ["adblockultimate-ultimate", "https://filters.adtidy.org/extension/chromium/filters/2.txt"],
  ["adblockultimate-korean", "https://www.fanboy.co.nz/fanboy-korean.txt"],
  ["adblockultimate-annoyance", "https://www.fanboy.co.nz/fanboy-annoyance.txt"],
];

// === 그룹별 필터 소스 ===
// 각 그룹은 settings 페이지에서 개별 토 vời로 제어된다.
// 그룹에 속한 모든 소스가 변환되어 하나의 규칙셋으로 생성된다.

const GROUPS = {
  // 1. 광고 차단 (EasyList + EasyPrivacy + Ultimate Ad Filter)
  ads: {
    name: "광고 차단",
    sources: [
      ["easylist", "https://easylist.to/easylist/easylist.txt"],
      ["easyprivacy", "https://easylist.to/easylist/easyprivacy.txt"],
      ["ultimate", "https://filters.adtidy.org/extension/chromium/filters/2.txt"],
    ],
  },

  // 2. 한국 광고 필터
  korean: {
    name: "한국 광고 필터",
    sources: KOREAN_LISTS,
  },

  // 3. 개인정보 보호 (Fanboy's Social Blocking + URL Tracking)
  privacy: {
    name: "개인정보 보호",
    sources: [
      ["fanboy-social", "https://www.fanboy.co.nz/fanboy-social.txt"],
      ["url-tracking", "https://filters.adtidy.org/extension/chromium/filters/10.txt"],
    ],
  },

  // 4. 안티서클 (Anti-circumvention)
  anti_circumvention: {
    name: "안티서클",
    sources: [
      ["anti-cv-en", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/english.txt"],
      ["anti-cv-zh", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/chinese.txt"],
      ["anti-cv-cs", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/czech.txt"],
      ["anti-cv-fr", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/french.txt"],
      ["anti-cv-de", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/german.txt"],
      ["anti-cv-pl", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/polish.txt"],
      ["anti-cv-pt", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/portuguese.txt"],
      ["anti-cv-ru", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/russian.txt"],
      ["anti-cv-es", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/spanish.txt"],
      ["anti-cv-tr", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/turkish.txt"],
      ["anti-cv-vi", "https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/vietnamese.txt"],
    ],
  },

  // 5. 성가신 요소 (Fanboy's Annoyance + Cookie Notices + Popups)
  annoyances: {
    name: "성가신 요소",
    sources: [
      ["fanboy-annoyance", "https://www.fanboy.co.nz/fanboy-annoyance.txt"],
    ],
  },

  // 6. 보안 (NoCoin + urlhaus)
  security: {
    name: "보안",
    sources: [
      ["nocoin", "https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt"],
      ["urlhaus", "https://gitlab.com/curben/urlhaus-filter/-/raw/master/urlhaus-filter.txt"],
    ],
  },
};

// === 명령행 인자 처리 ===
const args = process.argv.slice(2);
const ALL_MODE = args.includes("--all");
const GROUP_MODE = args.find((a) => a.startsWith("--group="));
const KOREAN_ONLY = args.includes("--korean");
const ADULT_ONLY = args.includes("--adblockultimate");

// 그룹 모드: 특정 그룹만 생성
let selectedGroups = null;
if (GROUP_MODE) {
  const groupKey = GROUP_MODE.replace("--group=", "");
  if (GROUPS[groupKey]) {
    selectedGroups = [groupKey];
  } else {
    console.error("알 수 없는 그룹: " + groupKey);
    console.error("사용 가능한 그룹: " + Object.keys(GROUPS).join(", "));
    process.exit(1);
  }
}

// 기존 호환 모드
if (KOREAN_ONLY) selectedGroups = ["korean"];
if (ADULT_ONLY) selectedGroups = ["ads", "korean", "annoyances"]; // 기존 --adblockultimate와 동일

// === 변환 로직 (기존과 동일) ===

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
  if (line.includes("$$")) return null;
  if (/^[\w-]+$/.test(line.trim())) return null;
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

async function downloadList(name, url) {
  let text;
  if (url.startsWith("file:")) {
    const local = path.resolve(ROOT, url.slice(5));
    text = fs.readFileSync(local, "utf8");
  } else {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(name + " 다운로드 실패: HTTP " + res.status);
    text = await res.text();
  }
  fs.writeFileSync(path.join(TMP_DIR, name + ".txt"), text);
  return text;
}

async function buildGroup(groupKey) {
  const group = GROUPS[groupKey];
  if (!group) return;

  let allLines = [];
  for (const [name, url] of group.sources) {
    try {
      const text = await downloadList(name, url);
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      allLines = allLines.concat(lines);
      console.log("  " + name + ": " + lines.length + "줄");
    } catch (e) {
      console.error("  " + name + " 실패: " + e.message);
    }
  }

  if (allLines.length === 0) {
    console.error("변환할 라인이 없습니다");
    return;
  }

  const cancelled = new Set();
  for (const line of allLines) {
    if (!line.startsWith("!") && !line.startsWith("[") && line.includes("badfilter")) {
      cancelled.add(normalizeBadfilter(line));
    }
  }

  const rules = [];
  const seen = new Set();
  let skipped = 0;

  for (const line of allLines) {
    if (!line || line.startsWith("!") || line.startsWith("[") || line.includes("#")) continue;
    if (line.startsWith("/")) { skipped++; continue; }
    if (cancelled.has(normalizeBadfilter(line))) continue;

    const rule = convertLine(line);
    if (!rule) { skipped++; continue; }

    const key = JSON.stringify([rule.action.type, rule.condition]);
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(rule);
  }

  rules.forEach((r, i) => { r.id = i + 1; });

  const allowCount = rules.filter((r) => r.action.type === "allow").length;
  console.log("  변환 규칙: " + rules.length + "개 (allow " + allowCount + ", block " + (rules.length - allowCount) + ")");
  console.log("  제외된 줄: " + skipped);

  // DNR 30,000개 한도 준수하여 분할 저장
  const CHUNK = 30000;
  const fileBase = "ruleset_" + groupKey;
  let fileIndex = 0;
  for (let i = 0; i < rules.length; i += CHUNK) {
    fileIndex++;
    const chunk = rules.slice(i, i + CHUNK);
    const file = path.join(OUT_DIR, fileBase + (fileIndex > 1 ? "_" + fileIndex : "") + ".json");
    fs.writeFileSync(file, JSON.stringify(chunk));
    console.log("  filters/" + path.basename(file) + ": " + chunk.length + "개");
  }

  if (rules.length === 0) {
    console.error("  변환된 규칙이 없습니다");
  }
}

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (selectedGroups) {
    // 그룹 모드
    console.log("=== 그룹별 필터 생성 ===");
    for (const groupKey of selectedGroups) {
      console.log("\n[" + GROUPS[groupKey].name + "]");
      await buildGroup(groupKey);
    }
  } else if (ALL_MODE) {
    // 전체 그룹 생성
    console.log("=== 전체 필터 생성 ===");
    for (const groupKey of Object.keys(GROUPS)) {
      console.log("\n[" + GROUPS[groupKey].name + "]");
      await buildGroup(groupKey);
    }
  } else if (KOREAN_ONLY) {
    console.log("=== 한국 필터 생성 ===");
    await buildGroup("korean");
  } else if (ADULT_ONLY) {
    console.log("=== AdBlocker Ultimate 필터 생성 ===");
    await buildGroup("ads");
    await buildGroup("korean");
    await buildGroup("annoyances");
  } else {
    // 기본: EasyList/EasyPrivacy
    console.log("=== 기본 필터 생성 (EasyList/EasyPrivacy) ===");
    let allLines = [];
    for (const [name, url] of LISTS) {
      const text = await downloadList(name, url);
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      allLines = allLines.concat(lines);
      console.log(name + ": " + lines.length + "줄");
    }

    const cancelled = new Set();
    for (const line of allLines) {
      if (!line.startsWith("!") && !line.startsWith("[") && line.includes("badfilter")) {
        cancelled.add(normalizeBadfilter(line));
      }
    }

    const rules = [];
    const seen = new Set();
    let skipped = 0;

    for (const line of allLines) {
      if (!line || line.startsWith("!") || line.startsWith("[") || line.includes("#")) continue;
      if (line.startsWith("/")) { skipped++; continue; }
      if (cancelled.has(normalizeBadfilter(line))) continue;

      const rule = convertLine(line);
      if (!rule) { skipped++; continue; }

      const key = JSON.stringify([rule.action.type, rule.condition]);
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(rule);
    }

    rules.forEach((r, i) => { r.id = i + 1; });

    const allowCount = rules.filter((r) => r.action.type === "allow").length;
    console.log("변환 규칙: " + rules.length + "개 (allow " + allowCount + ", block " + (rules.length - allowCount) + ")");
    console.log("제외된 줄: " + skipped);

    const CHUNK = 25000;
    let fileIndex = 0;
    for (let i = 0; i < rules.length; i += CHUNK) {
      fileIndex++;
      const chunk = rules.slice(i, i + CHUNK);
      const file = path.join(OUT_DIR, "ruleset_" + fileIndex + ".json");
      fs.writeFileSync(file, JSON.stringify(chunk));
      const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
      console.log("filters/" + path.basename(file) + ": " + chunk.length + "개 (" + mb + "MB)");
    }
    if (rules.length === 0) throw new Error("변환된 규칙이 없습니다");
  }
}

main().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});