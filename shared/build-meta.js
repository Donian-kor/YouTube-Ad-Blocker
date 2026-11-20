// shared/build-meta.js - 빌드 시 자동 생성 (직접 수정하지 마세요)
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuildMeta = api;
})(typeof self !== 'undefined' ? self : this, function () {
  return {
  "groups": {
    "easylist": 102818,
    "adguard": 69685,
    "peterlowe": 3568,
    "uassets": 2188,
    "korean": 2286,
    "social": 1459,
    "anti_cv": 1041,
    "annoyances": 2445,
    "malware": 137191,
    "mining": 243
  }
};
});
