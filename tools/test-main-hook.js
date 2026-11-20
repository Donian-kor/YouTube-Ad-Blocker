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

const TEST_TOKEN = "test-token-12345";
const documentObj = {
  documentElement: {
    getAttribute(name) {
      return name === "data-yab-state-token" ? TEST_TOKEN : null;
    }
  }
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
  document: documentObj,
  Response: MockResponse,
  Promise,
  JSON,
  Object,
  Function,
  Array,
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

function setEnabled(value, token) {
  messageListeners.forEach((fn) =>
    fn({ source: windowObj, data: { source: "yab-extension", token: token === undefined ? TEST_TOKEN : token, type: "enabled", value } })
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

  const raw = '{"adSlots":[1],"videoDetails":{"title":"t"}}';

  // 5) 토큰이 다른 위조 메시지는 무시되어야 함 (ON 상태 유지)
  setEnabled(true);
  setEnabled(false, "forged-token");
  check("위조 토큰 메시지 무시", JSON.parse(raw), { videoDetails: { title: "t" } });

  // 6) 토글 OFF면 원본 유지
  setEnabled(false);
  const kept = JSON.parse(raw);
  check("OFF 상태에서는 광고 키 유지", kept, { adSlots: [1], videoDetails: { title: "t" } });

  // 6) 다시 ON
  setEnabled(true);
  const cleaned = JSON.parse(raw);
  check("ON 상태에서는 광고 키 제거", cleaned, { videoDetails: { title: "t" } });

  // 7) adBreakHeartbeatParams 까지 제거 (신규 광고 키)
  const withHeartbeat = JSON.parse(
    '{"adBreakHeartbeatParams":"hb","playerAds":[1],"videoDetails":{"title":"t"}}'
  );
  check("adBreakHeartbeatParams 제거", withHeartbeat, { videoDetails: { title: "t" } });

  // 8) Shorts/재생목록의 중첩 adClientParams.isAd 플래그 무력화
  const shorts = JSON.parse(
    '{"reelWatchSequenceResponse":{"entries":[{"command":{"reelWatchEndpoint":{"adClientParams":{"isAd":true}}}}]},' +
      '"entries":[{"command":{"reelWatchEndpoint":{"adClientParams":{"isAd":true}}}}],"videoDetails":{"title":"t"}}'
  );
  check(
    "Shorts isAd 플래그 무력화",
    shorts,
    {
      reelWatchSequenceResponse: {
        entries: [{ command: { reelWatchEndpoint: { adClientParams: { isAd: false } } } }]
      },
      entries: [{ command: { reelWatchEndpoint: { adClientParams: { isAd: false } } } }],
      videoDetails: { title: "t" }
    }
  );

  // 9) Promise.then 콜백이 재귀 없이 한 번만 실행되는지 (무한 재귀 회귀 테스트)
  let callCount = 0;
  await new Promise((resolve) => {
    Promise.resolve('{"adSlots":[1],"videoDetails":{"title":"t"}}').then(
      hookableCallback(() => {
        callCount++;
      })
    );
    setTimeout(resolve, 10);
  });
  check("후킹 콜백 단일 실행 (무한 재귀 방지)", callCount, 1);

  if (failures > 0) {
    console.error("실패: " + failures + "건");
    process.exit(1);
  }
  console.log("모든 후킹 테스트 통과");
})();
