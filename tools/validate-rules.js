// 생성된 DNR 정적 규칙 파일 검증기
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "..", "filters");
const RESOURCE_TYPES = new Set([
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font",
  "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other",
]);
const CONDITION_KEYS = new Set([
  "urlFilter", "regexFilter", "isUrlFilterCaseSensitive", "resourceTypes",
  "excludedResourceTypes", "domainType", "initiatorDomains", "excludedInitiatorDomains",
  "requestDomains", "excludedRequestDomains", "requestMethods", "excludedRequestMethods",
]);

let errors = 0;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

for (const file of files) {
  const full = path.join(DIR, file);
  const rules = JSON.parse(fs.readFileSync(full, "utf8"));
  const ids = new Set();

  if (!Array.isArray(rules)) { console.error(file + ": 배열이 아님"); errors++; continue; }
  if (rules.length > 30000) { console.error(file + ": 규칙 30,000개 초과"); errors++; }

  for (const [i, rule] of rules.entries()) {
    const where = file + " #" + i;
    if (!rule || typeof rule !== "object") { console.error(where + ": 객체 아님"); errors++; continue; }
    if (!Number.isInteger(rule.id) || rule.id <= 0) { console.error(where + ": id 이상"); errors++; }
    if (ids.has(rule.id)) { console.error(where + ": id 중복 " + rule.id); errors++; }
    ids.add(rule.id);
    if (!Number.isInteger(rule.priority) || rule.priority < 1) { console.error(where + ": priority 이상"); errors++; }
    if (!rule.action || !["block", "allow", "redirect", "upgradeScheme", "modifyHeaders", "allowAllRequests"].includes(rule.action.type)) {
      console.error(where + ": action.type 이상"); errors++; continue;
    }
    if (!rule.condition || typeof rule.condition !== "object") { console.error(where + ": condition 누락"); errors++; continue; }

    for (const k of Object.keys(rule.condition)) {
      if (!CONDITION_KEYS.has(k)) { console.error(where + ": 알 수 없는 condition 키 " + k); errors++; }
    }
    const c = rule.condition;
    if (typeof c.urlFilter !== "string" || c.urlFilter.length < 1 || c.urlFilter.length > 2000) {
      console.error(where + ": urlFilter 길이 이상"); errors++;
    } else if (!/^[\x20-\x7e]+$/.test(c.urlFilter)) {
      console.error(where + ": urlFilter ASCII 아님: " + c.urlFilter); errors++;
    } else if (/\|\|\*/.test(c.urlFilter)) {
      // DNR urlFilter는 "||" 뒤에 "*"가 올 수 없음 (Chrome이 로드 거부)
      console.error(where + ": urlFilter에 '||*' 사용: " + c.urlFilter); errors++;
    }
    if (c.resourceTypes) {
      if (!Array.isArray(c.resourceTypes) || c.resourceTypes.length === 0) { console.error(where + ": resourceTypes 비었음"); errors++; }
      else for (const t of c.resourceTypes) {
        if (!RESOURCE_TYPES.has(t)) { console.error(where + ": resourceTypes 값 이상 " + t); errors++; }
      }
    }
    if (c.excludedResourceTypes) {
      for (const t of c.excludedResourceTypes) {
        if (!RESOURCE_TYPES.has(t)) { console.error(where + ": excludedResourceTypes 값 이상 " + t); errors++; }
      }
    }
    if (c.domainType && !["firstParty", "thirdParty"].includes(c.domainType)) {
      console.error(where + ": domainType 이상 " + c.domainType); errors++;
    }
    for (const key of ["initiatorDomains", "excludedInitiatorDomains", "requestDomains", "excludedRequestDomains"]) {
      if (!c[key]) continue;
      if (!Array.isArray(c[key])) { console.error(where + ": " + key + " 배열 아님"); errors++; continue; }
      for (const d of c[key]) {
        if (typeof d !== "string" || d.length === 0 || !/^[a-z0-9.-]+$/.test(d)) {
          console.error(where + ": " + key + " 도메인 이상 '" + d + "'"); errors++;
        }
      }
    }
    if (c.isUrlFilterCaseSensitive !== undefined && typeof c.isUrlFilterCaseSensitive !== "boolean") {
      console.error(where + ": isUrlFilterCaseSensitive 이상"); errors++;
    }
  }
  console.log(file + ": " + rules.length + "개 검사 완료");
}

if (errors > 0) {
  console.error("총 오류: " + errors);
  process.exit(1);
}
console.log("모든 규칙 검증 통과");
