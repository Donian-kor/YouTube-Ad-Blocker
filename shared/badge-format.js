// shared/badge-format.js - 툴바 아이콘 뱃지 숫자 형식
// background/stats.js 에서 사용하고, tools/test-badge-format.js 에서 단위 검증한다.
// UMD 형태: Node(CommonJS)와 브라우저(서비스 워커) 모두 지원한다.
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BadgeFormat = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 크롬 뱃지는 4자만 표시된다. 5자 이상이면 앞부분만 잘려 보이므로
  // 1,000 이상은 k·M·B 단위로 줄여 항상 4자 안에 들어가게 한다.
  // - 1,000 ~ 9,999   : 1.0k ~ 9.9k  (소수점 1자리)
  // - 10,000 ~ 999,999: 10k ~ 999k   (정수 k)
  // - 1,000,000 이상  : 1.0M ~ 999M, 그 이상은 B
  function trimUnit(value) {
    const text = value.toFixed(1);
    // 9.95 이상이면 "10.0" 이 되어 5자가 되므로 정수로 내린다.
    return text.length > 3 ? String(Math.floor(value)) : text;
  }

  function format(total) {
    if (!Number.isFinite(total) || total <= 0) return "";
    if (total < 1000) return String(Math.floor(total));
    if (total < 10000) return trimUnit(total / 1000) + "k";
    if (total < 1000000) return Math.floor(total / 1000) + "k";
    if (total < 10000000) return trimUnit(total / 1000000) + "M";
    if (total < 1000000000) return Math.floor(total / 1000000) + "M";
    return Math.floor(total / 1000000000) + "B";
  }

  return { format };
});