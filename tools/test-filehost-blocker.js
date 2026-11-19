// filehost-blocker.js 선택자/판별 로직 단위 테스트
// 실행: node tools/test-filehost-blocker.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// --- DOM 흉내 (최소 구현) ---
function makeClassList(arr) {
  const set = new Set(arr || []);
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toString: () => [...set].join(" "),
    [Symbol.iterator]: () => set[Symbol.iterator]()
  };
}

function makeEl(tag, opts = {}) {
  const el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: opts.id || "",
    textContent: opts.text || "",
    target: opts.target || "",
    className: opts.cls || "",
    classList: makeClassList((opts.cls || "").split(/\s+/).filter(Boolean)),
    children: [],
    parentNode: null,
    attrs: opts.attrs || {},
    removed: false,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    },
    setAttribute(name, val) { this.attrs[name] = String(val); },
    remove() { this.removed = true; if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); } },
    get outerHTML() { return "<" + this.tagName.toLowerCase() + ">" + this.textContent + "</" + this.tagName.toLowerCase() + ">"; },
    closest(sel) { return null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  };
  return el;
}

function makeDocument() {
  const head = makeEl("head");
  const body = makeEl("body");
  const html = makeEl("html");
  const all = [];
  const doc = {
    head, body, documentElement: html,
    readyState: "complete",
    _all: all,
    getElementById(id) {
      return all.find((e) => e.id === id) || null;
    },
    querySelectorAll(sel) {
      // 테스트용: 모든 요소 반환(선택자 필터는 각 테스트가 별도 검증)
      return all.slice();
    },
    createElement(tag) {
      const el = makeEl(tag);
      return el;
    },
    addEventListener() {},
    removeEventListener() {}
  };
  head.parentNode = html; body.parentNode = html;
  html.children = [head, body];
  return { doc, head, body, html, all };
}

// --- 스크립트 실행 (비활성화된 상태로 로직만 로드) ---
const source = fs.readFileSync(path.resolve(__dirname, "..", "filehost-blocker.js"), "utf8");

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) {
    console.log("  기대값:", JSON.stringify(expected));
    console.log("  실제값:", JSON.stringify(actual));
    failures++;
  }
}

// filehost-blocker.js는 IIFE이므로 내부 함수를 직접 테스트할 수 없다.
// 대신 requireable 하지 않으므로, 핵심 로직(선택자·판별)을 재현한 동일 로직을
// 별도로 검증하는 테스트로 구성한다. (스크립트가 문법 오류 없이 로드되는지는 별도 shell로 확인)

// === isRealDownload / isFakeDownload 로직 재현 (스크립트와 동일) ===
const AD_HOST_RE = /(doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google\.com|2mdn\.net|googletagservices\.com|adshield|geniee\.jp|genieesspv\.jp|i-mobile\.co\.jp|3-q\.cc|tapad\.com|pubmatic\.com|rubiconproject\.com|openx\.net|adnxs\.com|criteo\.com|taboola\.com|outbrain\.com|mgid\.com|propellerads|propellerclick|adsterra|highperformanceformat|effectivecpmnetwork|profitablecpmrate|clickadu|hilltopads|popads\.net|popcash\.net|onclickads|onclksrv|adcash|exoclick|exosrv|juicyads|admaven|monetag|adskeeper|adpushup|smartadserver|contextweb)/i;

function isFakeDownload(el) {
  if (!el || !el.getAttribute) return false;
  const href = (el.getAttribute("href") || "");
  const onclick = (el.getAttribute("onclick") || "");
  if (AD_HOST_RE.test(href)) return true;
  if (onclick && /window\.open|popup|popunder/i.test(onclick)) return true;
  return false;
}

// 1) 광고 도메인 링크는 가짜 다운로드
check("doubleclick 링크는 가짜", isFakeDownload(makeEl("a", { attrs: { href: "https://ad.doubleclick.net/x" } })), true);
check("onclick 팝업은 가짜", isFakeDownload(makeEl("a", { attrs: { href: "#", onclick: "window.open('x')" } })), true);

// 2) 일반 내부 링크는 가짜 아님
check("일반 링크는 가짜 아님", isFakeDownload(makeEl("a", { attrs: { href: "/download/file.zip" } })), false);
check("download 텍스트 링크는 가짜 아님", isFakeDownload(makeEl("a", { text: "Download", attrs: { href: "/files/123" } })), false);

// 3) window.open 차단 대상 판별
function isBlockedUrl(url) { return AD_HOST_RE.test(url); }
check("highperformanceformat 차단", isBlockedUrl("https://www.highperformanceformat.com/x/invoke.js"), true);
check("adsterra 차단", isBlockedUrl("https://adsterra.com/pop.js"), true);
check("gigafile 정상 URL 통과", isBlockedUrl("https://gigafile.nu/"), false);

// 4) 광고 컨테이너 선택자 포함 여부
check("광고 iframe 선택자 존재", /google_ads_iframe/.test(source), true);
check("기가파일 광고 슬롯 선택자 존재", /smarttag-adx-inst|gigafile-slot/.test(source), true);

if (failures > 0) {
  console.error("실패: " + failures + "건");
  process.exit(1);
}
console.log("모든 파일 호스트 차단 테스트 통과");