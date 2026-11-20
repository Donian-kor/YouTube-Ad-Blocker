// shared/build-meta.js - 빌드 시 자동 생성 (직접 수정하지 마세요)
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuildMeta = api;
})(typeof self !== 'undefined' ? self : this, function () {
  return {
  "groups": {
    "korean": 2286,
    "anti_cv": 1041,
    "annoyances": 2442,
    "social": 1188,
    "mining": 243,
    "malware": 137191,
    "uassets": 2175,
    "peterlowe": 3493,
    "easylist": 101384,
    "adguard": 19972
  },
  "rulesets": {
    "adguard_1": 19972,
    "annoyances_1": 2442,
    "anti_cv_1": 1041,
    "easylist_1": 30000,
    "easylist_2": 30000,
    "easylist_3": 30000,
    "easylist_4": 11384,
    "korean_1": 2286,
    "malware_1": 30000,
    "malware_2": 30000,
    "malware_3": 30000,
    "malware_4": 30000,
    "malware_5": 17191,
    "mining_1": 243,
    "peterlowe_1": 3493,
    "social_1": 1188,
    "uassets_1": 2175
  }
};
});
