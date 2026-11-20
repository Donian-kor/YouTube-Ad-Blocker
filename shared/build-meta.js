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
  },
  "rulesets": {
    "adguard_1": 30000,
    "adguard_2": 30000,
    "adguard_3": 9685,
    "annoyances_1": 2445,
    "anti_cv_1": 1041,
    "easylist_1": 30000,
    "easylist_2": 30000,
    "easylist_3": 30000,
    "easylist_4": 12818,
    "korean_1": 2286,
    "malware_1": 30000,
    "malware_2": 30000,
    "malware_3": 30000,
    "malware_4": 30000,
    "malware_5": 17191,
    "mining_1": 243,
    "peterlowe_1": 3568,
    "social_1": 1459,
    "uassets_1": 2188
  }
};
});
