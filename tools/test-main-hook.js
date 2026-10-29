// youtube-main.js 후킹 로직 단위 테스트
// 실행: node tools/test-main-hook.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "youtube-main.js"), "utf8");

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

// 브라우저 환경 흉내
const messageListeners = [];
function MockResponse() {}
MockResponse.prototype.json = function () {
  // 실제 Response.json()처럼 객체를 반환 (JSON.parse 후킹 영향을 피하려고 직접 생성)
  return Promise.resolve({ adSlots: [1], videoDetails: { title: "t" } });
};

const windowObj = {
  addEventListener(type, fn) {
    if (type === "message") messageListeners.push(fn);
  },
  Response: MockResponse
};
windowObj.window = windowObj;

const sandbox = {
  window: windowObj,
  Response: MockResponse,
  Promise,
  JSON,
  Object,
  Function,
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

function setEnabled(value) {
  messageListeners.forEach((fn) =>
    fn({ source: windowObj, data: { source: "yab-extension", type: "enabled", value } })
  );
}

function hookableCallback(collect) {
  // 소스에 ".next(" 가 포함되어 후킹 대상이 되도록 함
  return function (value) {
    void ".next(";
    collect(value);
    return value;
  };
}

(async () => {
  // 1) 문자열 응답의 광고 키 치환
  let received = null;
  await new Promise((resolve) => {
    Promise.resolve('{"adSlots":[1],"playerAds":[2],"videoDetails":{"title":"t"}}').then(
      hookableCallback((v) => { received = v; })
    );
    setTimeout(resolve, 10);
  });
  check("문자열 응답 adSlots/playerAds 제거", received,
    '{"no_ads":[1],"no_ads":[2],"videoDetails":{"title":"t"}}');

  // 2) JSON.parse 객체 정리
  const parsed = JSON.parse('{"adSlots":[1],"playerAds":[2],"videoDetails":{"title":"t"}}');
  check("JSON.parse 광고 키 제거", parsed, { videoDetails: { title: "t" } });

  // 3) Response.json 정리
  const responseJson = await new MockResponse().json();
  check("Response.json 광고 키 제거", responseJson, { videoDetails: { title: "t" } });

  // 4) ytInitialPlayerResponse setter 정리
  windowObj.ytInitialPlayerResponse = { adSlots: [1], playerAds: [2], videoDetails: { title: "t" } };
  check("ytInitialPlayerResponse 광고 키 제거", windowObj.ytInitialPlayerResponse, {
    videoDetails: { title: "t" }
  });

  // 5) 토글 OFF면 원본 유지
  setEnabled(false);
  const raw = '{"adSlots":[1],"videoDetails":{"title":"t"}}';
  const kept = JSON.parse(raw);
  check("OFF 상태에서는 광고 키 유지", kept, { adSlots: [1], videoDetails: { title: "t" } });

  // 6) 다시 ON
  setEnabled(true);
  const cleaned = JSON.parse(raw);
  check("ON 상태에서는 광고 키 제거", cleaned, { videoDetails: { title: "t" } });

  if (failures > 0) {
    console.error("실패: " + failures + "건");
    process.exit(1);
  }
  console.log("모든 후킹 테스트 통과");
})();
