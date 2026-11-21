// shared/badge-format.js 단위 테스트
// 실행: node tools/test-badge-format.js
const { format } = require("../shared/badge-format.js");

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) {
    console.log("  기대값: " + JSON.stringify(expected));
    console.log("  실제값: " + JSON.stringify(actual));
    failures++;
  }
}

// 0 이하·비숫자는 빈 문자열 (뱃지 숨김)
check("0은 빈 문자열", format(0), "");
check("음수는 빈 문자열", format(-5), "");
check("NaN 은 빈 문자열", format(NaN), "");
check("Infinity 는 빈 문자열", format(Infinity), "");

// 1,000 미만은 그대로
check("1 은 1", format(1), "1");
check("999 는 999", format(999), "999");

// A안: 1,000~9,999 는 소수점 1자리 k
check("1000 은 1.0k", format(1000), "1.0k");
check("1500 은 1.5k", format(1500), "1.5k");
check("9999 는 10.0k 가 아니라 4자 이내", format(9999).length <= 4, true);

// C안: 10,000 이상은 9999 로 뭉개지 않고 k 절사
check("10000 은 10k (예전 9999 상한 해소)", format(10000), "10k");
check("12345 는 12k", format(12345), "12k");
check("999999 는 999k", format(999999), "999k");

// M·B 단위
check("1000000 은 1.0M", format(1000000), "1.0M");
check("1500000 은 1.5M", format(1500000), "1.5M");
check("12345678 은 12M", format(12345678), "12M");
check("999999999 는 999M", format(999999999), "999M");
check("1000000000 은 1B", format(1000000000), "1B");

// 어떤 값이든 항상 4자 이내 (크롬 뱃지 제한)
let maxLen = 0;
for (let i = 0; i <= 2000000000; i += 7919) {
  const text = format(i);
  if (text.length > maxLen) maxLen = text.length;
}
check("2,000,000,000 까지 전 구간 4자 이내", maxLen <= 4, true);

if (failures > 0) {
  console.error("실패: " + failures + "건");
  process.exit(1);
}
console.log("모든 뱃지 형식 테스트 통과");