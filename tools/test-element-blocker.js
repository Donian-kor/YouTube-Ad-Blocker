// element-blocker.js 선택자 생성 테스트
// 실행: node tools/test-element-blocker.js
const { isStableToken, buildSelector, findBlockTarget } = require("../element-blocker.js");

let failures = 0;
function describe(value) {
  if (value && typeof value === "object" && value.tagName) {
    return "<" + value.tagName.toLowerCase() + ">";
  }
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}
function check(name, actual, expected) {
  let ok = actual === expected;
  if (!ok) {
    try {
      ok = JSON.stringify(actual) === JSON.stringify(expected);
    } catch (e) {
      ok = false;
    }
  }
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) {
    console.log("  기대값:", describe(expected));
    console.log("  실제값:", describe(actual));
    failures++;
  }
}

function makeEl(tag, opts = {}) {
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: opts.id || "",
    classList: opts.classes || [],
    children: [],
    parentElement: null,
    attrs: opts.attrs || {},
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    }
  };
}

function append(parent, child) {
  child.parentElement = parent;
  parent.children.push(child);
  return child;
}

const html = makeEl("html");
const body = append(html, makeEl("body"));
const root = append(body, makeEl("div", { classes: ["root-container"] }));
const content = append(root, makeEl("div", { classes: ["content-wrapper"] }));
const sidebar = append(content, makeEl("div", { classes: ["sidebar", "left-ad-area"] }));
const ad = append(
  sidebar,
  makeEl("div", {
    classes: ["ad", "small-ad"],
    attrs: { "data-ad-t": "zYa8sDuyBUyBIPa0", "data-ad-b": "t" }
  })
);
const img = append(ad, makeEl("img"));
const card = append(sidebar, makeEl("div", { classes: ["card"] }));
const title = append(card, makeEl("span", { classes: ["title"] }));
const main = append(content, makeEl("div", { id: "main-content", classes: ["main"] }));
const text = append(main, makeEl("p", { classes: ["text"] }));

// 1) 무작위 토큰 판별
check("일반 클래스 ad는 안정적", isStableToken("ad"), true);
check("small-ad는 안정적", isStableToken("small-ad"), true);
check("무작위 ID는 제외", isStableToken("zYa8sDuyBUyBIPa0"), false);
check("styled-components 클래스 제외", isStableToken("css-1x2y3z"), false);
check("숫자만 있는 값 제외", isStableToken("123"), false);

// 2) 광고 컨테이너 찾기 (이미지 → .ad div)
check("이미지에서 광고 컨테이너로 이동", findBlockTarget(img, body), ad);

// 3) arca.live처럼 data-ad-t가 있으면 사이트 전체 광고 슬롯 선택자
check("data-ad-t 선택자", buildSelector(ad, body), "[data-ad-t]");

// 4) 안정적인 ID를 가진 조상에서 경로를 끊음
check("안정적인 ID 선택자", buildSelector(text, body), "#main-content > p.text");

// 5) 일반 요소는 body부터 경로 생성 + nth-of-type 사용
const cardSelector = buildSelector(title, body);
check("일반 요소 경로 시작", cardSelector.startsWith("body > "), true);
check("일반 요소 경로에 nth-of-type 포함", cardSelector.includes("div.card:nth-of-type(2)"), true);

// 6) body 자체는 차단하지 않음
check("body는 차단 불가", buildSelector(body, body), null);

// 7) 유튜브 플레이어/영상은 실수로 숨기지 않음
const player = append(body, makeEl("div", { id: "movie_player", classes: ["html5-video-player", "ad-showing"] }));
const video = append(player, makeEl("video"));
const overlay = append(player, makeEl("div", { classes: ["ytp-ad-overlay-container"] }));
check("영상 요소는 차단 불가", buildSelector(video, body), null);
check("플레이어 자체는 차단 불가", buildSelector(player, body), null);
check("플레이어 내부 광고 오버레이는 차단 가능", findBlockTarget(overlay, body), overlay);

if (failures > 0) {
  console.error("실패: " + failures + "건");
  process.exit(1);
}
console.log("모든 요소 차단 선택자 테스트 통과");
