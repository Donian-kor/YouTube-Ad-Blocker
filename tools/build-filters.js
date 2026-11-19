// EasyList / EasyPrivacy -> Chrome declarativeNetRequest 규칙 변환기
// 사용법: node tools/build-filters.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "filters");
const TMP_DIR = path.join(__dirname, "tmp");

const LISTS = [
  ["easylist", "https://easylist.to/easylist/easylist.txt"],
  ["easyprivacy", "https://easylist.to/easylist/easyprivacy.txt"],
];

// 보조 도메인 차단 규칙셋 소스 (한국 광고 + 간단 호스트 리스트)
// node tools/build-filters.js --korean  로 별도 규칙셋만 생성한다.
// 중복 도메인은 변환기의 seen Set이 자동으로 제거한다.
const KOREAN_LISTS = [
  ["noridev", "https://raw.githubusercontent.com/noridev/NoriDev-AdBlock-Filter/master/filter/filter.txt"],
  ["turtlecute", "https://adblock.turtlecute.org/d3host.adblock"],
  ["d3host", "https://raw.githubusercontent.com/d3ward/toolz/master/src/d3host.txt"],
];
const KOREAN_ONLY = process.argv.includes("--korean");
const ACTIVE_LISTS = KOREAN_ONLY ? KOREAN_LISTS : LISTS;

// EasyList 리소스 타입 -> DNR resourceTypes
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
  if (after.includes("/")) return [line, null]; // 정규식 필터 등은 통째로 처리
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
  // hosts 형식 ("0.0.0.0 example.com" / "127.0.0.1 example.com") → ||example.com^
  const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1|::1)\s+([a-zA-Z0-9.-]+)\s*$/);
  if (hostsMatch) {
    const domain = hostsMatch[1].toLowerCase();
    if (!domain || domain.indexOf(".") === -1) return null;
    return {
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter: "||" + domain + "^" }
    };
  }
  // HTML 필터링($$)과 요소 숨김 잔여물은 DNR urlFilter로 표현할 수 없으므로 제외
  if (line.includes("$$")) return null;
  if (/^[\w-]+$/.test(line.trim())) return null;
  // DNR의 urlFilter는 "||"(도메인 앵커) 바로 뒤에 "*"가 올 수 없다.
  // AdGuard 필터의 "||*.example.com^" 형태는 여기서 걸러낸다.
  if (/\|\|\*/.test(line)) return null;
  let allow = false;
  if (line.startsWith("@@")) {
    allow = true;
    line = line.slice(2);
  }

  let [filter, optStr] = splitOptions(line);
  filter = filter.trim();
  if (!filter || filter.length > 2000) return null;
  if (/[^\x20-\x7e]/.test(filter)) return null; // ASCII만 허용
  if (filter.startsWith("/")) return null;      // 정규식 필터 제외

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
      return null; // 알 수 없는 옵션은 안전하게 제외
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

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let allLines = [];
  for (const [name, url] of ACTIVE_LISTS) {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(name + " 다운로드 실패: HTTP " + res.status);
    const text = await res.text();
    fs.writeFileSync(path.join(TMP_DIR, name + ".txt"), text);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    allLines = allLines.concat(lines);
    console.log(name + ": " + lines.length + "줄");
  }

  // $badfilter 로 비활성화된 필터 수집
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

  if (KOREAN_ONLY) {
    const file = path.join(OUT_DIR, "ruleset_korean.json");
    fs.writeFileSync(file, JSON.stringify(rules));
    console.log("filters/" + path.basename(file) + ": " + rules.length + "개");
    if (rules.length === 0) throw new Error("변환된 규칙이 없습니다");
    return;
  }

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

main().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});
