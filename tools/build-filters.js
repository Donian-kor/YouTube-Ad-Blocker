// 필터 소스 -> Chrome declarativeNetRequest 정적 규칙셋 빌더
// 소스 정의는 shared/filter-registry.js 단일 진실 공급원을 사용한다.
// 전체 빌드는 소스별로 규칙셋을 만들어 소스마다 개별 토글할 수 있게 한다.
//
// 사용법:
//   node tools/build-filters.js --all               전체 소스 빌드 (권장)
//   node tools/build-filters.js --all --offline     캐시 사용
//   node tools/build-filters.js --source=noridev    특정 소스만
//   node tools/build-filters.js --group=korean      레거시: 그룹 단위
//   node tools/build-filters.js                     레거시: EasyList/EasyPrivacy
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "filters");
const TMP_DIR = path.join(__dirname, "tmp");
const { normalizeBadfilter, convertLine } = require("../shared/filter-converter.js");
const REG = require("../shared/filter-registry.js");

// 레지스트리 -> 그룹 정의 (레거시 그룹 빌드용)
const GROUPS = {};
for (const group of REG.FILTER_GROUPS) {
  GROUPS[group.id] = {
    name: group.name,
    sources: REG.getGroupSources(group.id).map((s) => [s.id, s.file ? "file:" + s.file : s.url]),
  };
}
const LISTS = REG.getGroupSources("easylist").map((s) => [s.id, s.url]);

// 소스 간 중복 제거 시 규칙의 소유 소스 결정 순서 (구체적인 소스가 먼저 소유)
// 예: 한국 소스 규칙이 EasyList에도 있어도 한국 소스에 귀속되어 한국 소스 토글로 제어된다.
const SOURCE_ORDER = [
  // 한국
  "noridev", "turtlecute", "d3host", "list-kr", "filterslists-ko", "extra-hosts",
  // 안티서클
  "anti-cv-en", "anti-cv-zh", "anti-cv-cs", "anti-cv-fr", "anti-cv-de", "anti-cv-pl",
  "anti-cv-ru", "anti-cv-es",
  // 개인정보 / 성가신 요소 (Social이 Annoyance와 겹치므로 먼저 소유)
  "fanboy-social", "url-tracking", "uassets-privacy", "fanboy-annoyance",
  // 보안
  "nocoin", "urlhaus", "uassets-badware", "uassets-resource-abuse",
  // 국제 광고
  "uassets-filters", "uassets-general", "uassets-2024", "uassets-2025", "uassets-2026",
  "peter-lowe", "easylist", "easyprivacy", "ultimate",
];
// 누락된 소스가 있어도 빠짐없이 빌드되도록 나머지를 뒤에 추가
for (const s of REG.FILTER_REGISTRY) if (!SOURCE_ORDER.includes(s.id)) SOURCE_ORDER.push(s.id);

// === 명령행 인자 처리 ===
const args = process.argv.slice(2);
const ALL_MODE = args.includes("--all");
const OFFLINE = args.includes("--offline");
const SOURCE_MODE = args.find((a) => a.startsWith("--source="));
const GROUP_MODE = args.find((a) => a.startsWith("--group="));
const KOREAN_ONLY = args.includes("--korean");
const ADULT_ONLY = args.includes("--adblockultimate");

let selectedSources = null;
let selectedGroups = null;
if (SOURCE_MODE) {
  const id = SOURCE_MODE.replace("--source=", "");
  if (!REG.FILTER_REGISTRY.some((s) => s.id === id)) {
    console.error("알 수 없는 소스: " + id);
    process.exit(1);
  }
  selectedSources = [id];
}
if (GROUP_MODE) {
  const groupKey = GROUP_MODE.replace("--group=", "");
  if (GROUPS[groupKey]) selectedGroups = [groupKey];
  else { console.error("알 수 없는 그룹: " + groupKey); process.exit(1); }
}
if (KOREAN_ONLY) selectedGroups = ["korean"];
if (ADULT_ONLY) selectedGroups = ["intl_ads", "korean", "anti_cv"].filter((g) => GROUPS[g]);
const LEGACY_ALIAS = {
  ads: ["easylist", "adguard", "peterlowe", "uassets"],
  privacy: ["social"], anti_circumvention: ["anti_cv"], security: ["malware", "mining"],
};
if (selectedGroups) selectedGroups = selectedGroups.flatMap((g) => LEGACY_ALIAS[g] || [g]);

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

// 줄 -> DNR 규칙 변환 (seen: 전역 중복 제거 집합)
function convertLines(allLines, seen) {
  const dedupeSet = seen || new Set();
  const cancelled = new Set();
  for (const line of allLines) {
    if (!line.startsWith("!") && !line.startsWith("[") && line.includes("badfilter")) {
      cancelled.add(normalizeBadfilter(line));
    }
  }
  const rules = [];
  let skipped = 0;
  for (const line of allLines) {
    if (!line || line.startsWith("!") || line.startsWith("[") || line.includes("#")) continue;
    if (line.startsWith("/")) { skipped++; continue; }
    if (cancelled.has(normalizeBadfilter(line))) continue;
    const rule = convertLine(line);
    if (!rule) { skipped++; continue; }
    const key = JSON.stringify([rule.action.type, rule.condition]);
    if (dedupeSet.has(key)) continue;
    dedupeSet.add(key);
    rules.push(rule);
  }
  return { rules, skipped };
}

const builtCounts = {};      // 소스 ID -> 규칙 수
const CHUNK = 30000;

function saveRules(rules, prefix) {
  let fileIndex = 0;
  for (let i = 0; i < rules.length; i += CHUNK) {
    fileIndex++;
    const chunk = rules.slice(i, i + CHUNK).map((r, j) => Object.assign({}, r, { id: i + j + 1 }));
    const file = path.join(OUT_DIR, "ruleset_" + prefix + (fileIndex > 1 ? "_" + fileIndex : "") + ".json");
    fs.writeFileSync(file, JSON.stringify(chunk));
    console.log("  filters/" + path.basename(file) + ": " + chunk.length + "개");
  }
}

// 소스 하나를 규칙셋으로 빌드
async function buildSource(sourceId, globalSeen) {
  const source = REG.FILTER_REGISTRY.find((s) => s.id === sourceId);
  if (!source) return 0;
  let text;
  try {
    text = await downloadList(source.id, source.file ? "file:" + source.file : source.url);
  } catch (e) {
    console.error("  " + source.name + " 실패: " + e.message);
    return 0;
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  console.log("  " + source.name + ": " + lines.length + "줄" + (OFFLINE ? " (캐시)" : ""));
  const { rules } = convertLines(lines, globalSeen);
  saveRules(rules, source.id);
  builtCounts[source.id] = rules.length;
  return rules.length;
}

// 레거시: 그룹 단위 빌드
async function buildGroup(groupKey, globalSeen) {
  const group = GROUPS[groupKey];
  if (!group) return 0;
  let allLines = [];
  for (const [name, url] of group.sources) {
    try {
      const text = await downloadList(name, url);
      allLines = allLines.concat(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
      console.log("  " + name + ": 다운로드 완료");
    } catch (e) { console.error("  " + name + " 실패: " + e.message); }
  }
  if (!allLines.length) return 0;
  const { rules } = convertLines(allLines, globalSeen);
  saveRules(rules, groupKey);
  builtCounts[groupKey] = rules.length;
  return rules.length;
}

// 빌드 결과 메타데이터 기록
function writeBuildMeta(options) {
  const metaPath = path.join(ROOT, "shared", "build-meta.js");
  // 전체 빌드는 이전 메타를 병합하지 않는다 (오래된 그룹/소스 키가 섞여 총합이 왜곡됨)
  if (!(options && options.fresh) && fs.existsSync(metaPath)) {
    try {
      const prev = require(metaPath);
      for (const [k, v] of Object.entries(prev.sources || {})) {
        if (!(k in builtCounts)) builtCounts[k] = v;
      }
    } catch (e) { /* 무시 */ }
  }
  // 그룹별 합계는 소스 소유 관계로 계산
  const groupCounts = {};
  for (const src of REG.FILTER_REGISTRY) {
    groupCounts[src.group] = (groupCounts[src.group] || 0) + (builtCounts[src.id] || 0);
  }
  const rulesetSizes = {};
  for (const f of fs.readdirSync(OUT_DIR)) {
    const m = f.match(/^ruleset_(.+?)(?:_(\d+))?\.json$/);
    if (!m) continue;
    const id = m[2] ? m[1] + "_" + m[2] : m[1] + "_1";
    try {
      rulesetSizes[id] = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), "utf8")).length;
    } catch (e) { /* 무시 */ }
  }
  const body = [
    "// shared/build-meta.js - 빌드 시 자동 생성 (직접 수정하지 마세요)",
    "(function (root, factory) {",
    "  const api = factory();",
    "  if (typeof module !== 'undefined' && module.exports) module.exports = api;",
    "  else root.BuildMeta = api;",
    "})(typeof self !== 'undefined' ? self : this, function () {",
    "  return " + JSON.stringify({ groups: groupCounts, sources: builtCounts, rulesets: rulesetSizes }, null, 2) + ";",
    "});",
    "",
  ].join("\n");
  fs.writeFileSync(metaPath, body);
  console.log("shared/build-meta.js 갱신 (소스 " + Object.keys(builtCounts).length + "개)");
}

function writeStaticIndex() {
  const urlFilters = new Set();
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!/^ruleset_.+\.json$/.test(f)) continue;
    for (const r of JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), "utf8"))) {
      if (r.condition && r.condition.urlFilter) urlFilters.add(r.condition.urlFilter);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, "static-index.json"), JSON.stringify({ urlFilters: [...urlFilters] }));
  console.log("static-index.json 갱신:", urlFilters.size, "개");
}

function writeManifestResources() {
  const resources = [];
  for (const sourceId of SOURCE_ORDER) {
    let i = 1;
    while (true) {
      const name = `ruleset_${sourceId}${i > 1 ? "_" + i : ""}.json`;
      if (!fs.existsSync(path.join(OUT_DIR, name))) break;
      resources.push({ id: `${sourceId}_${i}`, enabled: false, path: `filters/${name}` });
      i++;
    }
  }
  const manifestPath = path.join(ROOT, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.declarative_net_request.rule_resources = resources;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("manifest rule_resources 갱신:", resources.length, "개");
}

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (ALL_MODE) {
    console.log("=== 전체 소스 빌드 (소스별 규칙셋 + 전역 중복 제거) ===" + (OFFLINE ? " (오프라인 캐시)" : ""));
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (/^ruleset_.+\.json$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
    }
    const globalSeen = new Set();
    for (const sourceId of SOURCE_ORDER) await buildSource(sourceId, globalSeen);
    console.log("\n전역 고유 규칙:", globalSeen.size, "개");
    writeBuildMeta({ fresh: true });
    writeStaticIndex();
    writeManifestResources();
  } else if (selectedSources) {
    console.log("=== 소스별 필터 생성 ===");
    for (const id of selectedSources) await buildSource(id);
    writeBuildMeta();
  } else if (selectedGroups) {
    console.log("=== 그룹별 필터 생성 (레거시) ===");
    for (const g of selectedGroups) await buildGroup(g);
    writeBuildMeta();
  } else {
    // 레거시 기본: EasyList/EasyPrivacy
    console.log("=== 기본 필터 생성 (EasyList/EasyPrivacy) ===");
    let allLines = [];
    for (const [name, url] of LISTS) {
      const text = await downloadList(name, url);
      allLines = allLines.concat(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    }
    const { rules } = convertLines(allLines);
    const CHUNK_LEGACY = 25000;
    let fileIndex = 0;
    for (let i = 0; i < rules.length; i += CHUNK_LEGACY) {
      fileIndex++;
      const chunk = rules.slice(i, i + CHUNK_LEGACY).map((r, j) => Object.assign({}, r, { id: i + j + 1 }));
      fs.writeFileSync(path.join(OUT_DIR, "ruleset_" + fileIndex + ".json"), JSON.stringify(chunk));
    }
    if (!rules.length) throw new Error("변환된 규칙이 없습니다");
  }
}

main().catch((e) => { console.error("실패:", e.message); process.exit(1); });
