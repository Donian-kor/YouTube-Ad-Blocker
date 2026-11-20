// 필터 소스 -> Chrome declarativeNetRequest 정적 규칙셋 빌더
// 소스 정의는 shared/filter-registry.js 단일 진실 공급원을 사용한다.
//
// 사용법:
//   node tools/build-filters.js                     기본(EasyList/EasyPrivacy, 레거시)
//   node tools/build-filters.js --all               전체 그룹 빌드
//   node tools/build-filters.js --group=korean      특정 그룹만 빌드
//   node tools/build-filters.js --all --offline     다운로드 없이 tools/tmp 캐시 사용
//   node tools/build-filters.js --korean            레거시: 한국 그룹만
//   node tools/build-filters.js --adblockultimate   레거시: intl_ads+korean+anti_cv
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "filters");
const TMP_DIR = path.join(__dirname, "tmp");
const { normalizeBadfilter, convertLine } = require("../shared/filter-converter.js");
const REG = require("../shared/filter-registry.js");

// 레지스트리 -> 그룹 정의 (소스 id, 위치)
const GROUPS = {};
for (const group of REG.FILTER_GROUPS) {
  GROUPS[group.id] = {
    name: group.name,
    sources: REG.getGroupSources(group.id).map((s) => [s.id, s.file ? "file:" + s.file : s.url]),
  };
}

const LISTS = REG.getGroupSources("easylist").map((s) => [s.id, s.url]);

// === 명령행 인자 처리 ===
const args = process.argv.slice(2);
const ALL_MODE = args.includes("--all");
const OFFLINE = args.includes("--offline");
const GROUP_MODE = args.find((a) => a.startsWith("--group="));
const KOREAN_ONLY = args.includes("--korean");
const ADULT_ONLY = args.includes("--adblockultimate");

let selectedGroups = null;
if (GROUP_MODE) {
  const groupKey = GROUP_MODE.replace("--group=", "");
  if (GROUPS[groupKey]) selectedGroups = [groupKey];
  else {
    console.error("알 수 없는 그룹: " + groupKey);
    console.error("사용 가능한 그룹: " + Object.keys(GROUPS).join(", "));
    process.exit(1);
  }
}
if (KOREAN_ONLY) selectedGroups = ["korean"];
if (ADULT_ONLY) selectedGroups = ["intl_ads", "korean", "anti_cv"].filter((g) => GROUPS[g]);

// 레거시 그룹명 매핑 (기존 스크립트 호환)
const LEGACY_ALIAS = {
  ads: ["easylist", "adguard", "peterlowe", "uassets"],
  privacy: ["social"],
  anti_circumvention: ["anti_cv"],
  security: ["malware", "mining"],
};
if (selectedGroups) {
  selectedGroups = selectedGroups.flatMap((g) => LEGACY_ALIAS[g] || [g]);
}

function sourcePath(name, url) {
  if (url.startsWith("file:")) return path.resolve(ROOT, url.slice(5));
  return path.join(TMP_DIR, name + ".txt");
}

async function downloadList(name, url) {
  const local = sourcePath(name, url);
  if (OFFLINE || url.startsWith("file:")) {
    if (!fs.existsSync(local)) throw new Error(name + " 캐시 없음: " + local);
    return fs.readFileSync(local, "utf8");
  }
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(name + " 다운로드 실패: HTTP " + res.status);
  const text = await res.text();
  fs.writeFileSync(local, text);
  return text;
}

// 줄 -> DNR 규칙 변환 (공통 로직)
function convertLines(allLines) {
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
  return { rules, skipped };
}

const builtCounts = {};

async function buildGroup(groupKey) {
  const group = GROUPS[groupKey];
  if (!group) return 0;

  let allLines = [];
  for (const [name, url] of group.sources) {
    try {
      const text = await downloadList(name, url);
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      allLines = allLines.concat(lines);
      console.log("  " + name + ": " + lines.length + "줄" + (OFFLINE ? " (캐시)" : ""));
    } catch (e) {
      console.error("  " + name + " 실패: " + e.message);
    }
  }
  if (allLines.length === 0) {
    console.error("변환할 라인이 없습니다");
    return 0;
  }

  const { rules, skipped } = convertLines(allLines);
  const allowCount = rules.filter((r) => r.action.type === "allow").length;
  console.log("  변환 규칙: " + rules.length + "개 (allow " + allowCount + ", block " + (rules.length - allowCount) + ")");
  console.log("  제외된 줄: " + skipped);

  // DNR 30,000개 한도 준수하여 그룹별로 분할 저장
  const CHUNK = 30000;
  let fileIndex = 0;
  for (let i = 0; i < rules.length; i += CHUNK) {
    fileIndex++;
    const chunk = rules.slice(i, i + CHUNK).map((r, j) => Object.assign({}, r, { id: i + j + 1 }));
    const file = path.join(OUT_DIR, "ruleset_" + groupKey + (fileIndex > 1 ? "_" + fileIndex : "") + ".json");
    fs.writeFileSync(file, JSON.stringify(chunk));
    console.log("  filters/" + path.basename(file) + ": " + chunk.length + "개");
  }
  if (rules.length === 0) console.error("  변환된 규칙이 없습니다");
  builtCounts[groupKey] = rules.length;
  return rules.length;
}

// 빌드 결과를 옵션 UI가 참조하는 메타데이터로 기록
function writeBuildMeta() {
  const metaPath = path.join(ROOT, "shared", "build-meta.js");
  // 부분 빌드 시 기존 메타데이터를 유지하고 이번 그룹만 덮어씀
  if (fs.existsSync(metaPath)) {
    try {
      const prev = require(metaPath);
      for (const [k, v] of Object.entries(prev.groups || {})) {
        if (!(k in builtCounts)) builtCounts[k] = v;
      }
    } catch (e) { /* 기존 메타 파싱 실패 시 무시 */ }
  }
  const body = [
    "// shared/build-meta.js - 빌드 시 자동 생성 (직접 수정하지 마세요)",
    "(function (root, factory) {",
    "  const api = factory();",
    "  if (typeof module !== 'undefined' && module.exports) module.exports = api;",
    "  else root.BuildMeta = api;",
    "})(typeof self !== 'undefined' ? self : this, function () {",
    "  return " + JSON.stringify({ groups: builtCounts }, null, 2) + ";",
    "});",
    "",
  ].join("\n");
  fs.writeFileSync(metaPath, body);
  console.log("shared/build-meta.js 갱신:", Object.keys(builtCounts).join(", "));
}

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (selectedGroups) {
    console.log("=== 그룹별 필터 생성 ===" + (OFFLINE ? " (오프라인 캐시)" : ""));
    for (const groupKey of selectedGroups) {
      console.log("\n[" + (GROUPS[groupKey]?.name || groupKey) + "]");
      await buildGroup(groupKey);
    }
    writeBuildMeta();
  } else if (ALL_MODE) {
    console.log("=== 전체 필터 생성 ===" + (OFFLINE ? " (오프라인 캐시)" : ""));
    for (const groupKey of Object.keys(GROUPS)) {
      console.log("\n[" + GROUPS[groupKey].name + "]");
      await buildGroup(groupKey);
    }
    writeBuildMeta();
  } else {
    // 기본: EasyList/EasyPrivacy (레거시ruleset_1.json)
    console.log("=== 기본 필터 생성 (EasyList/EasyPrivacy) ===");
    let allLines = [];
    for (const [name, url] of LISTS) {
      const text = await downloadList(name, url);
      allLines = allLines.concat(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
      console.log(name + ": 완료");
    }
    const { rules, skipped } = convertLines(allLines);
    console.log("변환 규칙: " + rules.length + "개 / 제외: " + skipped);
    const CHUNK = 25000;
    let fileIndex = 0;
    for (let i = 0; i < rules.length; i += CHUNK) {
      fileIndex++;
      const chunk = rules.slice(i, i + CHUNK).map((r, j) => Object.assign({}, r, { id: i + j + 1 }));
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
