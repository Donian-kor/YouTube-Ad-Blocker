// shared/filter-registry.js - 필터 소스 단일 진실 공급원 (Single Source of Truth)
// 빌드(tools/build-filters.js), 런타임 업데이트(background/filter-updater.js),
// 설정 UI(options/config.js)가 모두 이 파일을 참조한다.
// UMD 패턴: Node(require), 확장 worker(importScripts), 옵션(ESM import) 모두 지원.
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.FilterRegistry = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // === UI 카테고리 (5개, 상위 토글 단위) ===
  const FILTER_CATEGORIES = [
    { id: "intl_ads", name: "국제 광고", icon: "📢", locked: true,
      description: "EasyList·AdGuard·uAssets 등 해외 광고 필터" },
    { id: "korean", name: "한국 필터", icon: "🇰🇷", locked: false,
      description: "NoriDev·List-KR 등 국내 광고·트래커 필터" },
    { id: "privacy", name: "개인정보", icon: "🔒", locked: false,
      description: "소셜 위젯·URL 추적 파라미터 차단" },
    { id: "anti_cv", name: "안티애드블록", icon: "🚫", locked: false,
      description: "광고 우회 스크립트·성가신 요소 차단" },
    { id: "security", name: "보안", icon: "🛡️", locked: true,
      description: "악성 도메인·cryptomining 차단" },
  ];

  // === 소스 그룹 (세분화, 정적 규칙셋·개별 토글 단위) ===
  const FILTER_GROUPS = [
    { id: "easylist", name: "EasyList", icon: "📢", category: "intl_ads",
      description: "EasyList + EasyPrivacy" },
    { id: "adguard", name: "AdGuard 기본", icon: "🛡️", category: "intl_ads",
      description: "AdGuard Base (Ultimate Ad Filter)" },
    { id: "peterlowe", name: "Peter Lowe", icon: "🚫", category: "intl_ads",
      description: "Peter Lowe's Ad Server List" },
    { id: "uassets", name: "uAssets 광고", icon: "🔧", category: "intl_ads",
      description: "uBlock Origin filters 계열" },
    { id: "korean", name: "한국 사이트", icon: "🇰🇷", category: "korean",
      description: "NoriDev·Turtlecute·List-KR 등" },
    { id: "social", name: "추적 차단", icon: "🔒", category: "privacy",
      description: "Fanboy's Social·URL Tracking·uAssets privacy" },
    { id: "anti_cv", name: "안티서클", icon: "⛔", category: "anti_cv",
      description: "abp-filters-anti-cv 11개 언어" },
    { id: "annoyances", name: "성가신 요소", icon: "🧹", category: "anti_cv",
      description: "Fanboy's Annoyance List" },
    { id: "malware", name: "악성 사이트", icon: "🦠", category: "security",
      description: "URLhaus·uAssets badware/resource-abuse" },
    { id: "mining", name: "코인마이닝", icon: "⛏️", category: "security",
      description: "NoCoin" },
  ];

  // === 개별 필터 소스 ===
  // url: 원격 소스 (런타임 업데이트 가능)
  // file: 로컬 소스 (빌드 전용, 런타임 업데이트 제외)
  // limit: 런타임 동적 규칙 상한 (그룹 합계 ≤ 30,000)
  const FILTER_REGISTRY = [
    //국제 광고 - EasyList
    { id: "easylist", name: "EasyList", group: "easylist", category: "intl_ads",
      license: "CC BY-SA 3.0", url: "https://easylist.to/easylist/easylist.txt", limit: 5000 },
    { id: "easyprivacy", name: "EasyPrivacy", group: "easylist", category: "intl_ads",
      license: "CC BY-SA 3.0", url: "https://easylist.to/easylist/easyprivacy.txt", limit: 3000 },

    // 국제 광고 - AdGuard
    { id: "ultimate", name: "AdGuard Base", group: "adguard", category: "intl_ads",
      license: "GNU GPLv3 / CC BY 3.0", url: "https://filters.adtidy.org/extension/chromium/filters/2.txt", limit: 4000 },

    // 국제 광고 - Peter Lowe
    { id: "peter-lowe", name: "Peter Lowe's Blocklist", group: "peterlowe", category: "intl_ads",
      license: "See source", url: "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext", limit: 2000 },

    // 국제 광고 - uAssets
    { id: "uassets-filters", name: "uAssets filters", group: "uassets", category: "intl_ads",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt", limit: 1500 },
    { id: "uassets-general", name: "uAssets general", group: "uassets", category: "intl_ads",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-general.txt", limit: 1500 },
    { id: "uassets-2024", name: "uAssets 2024", group: "uassets", category: "intl_ads",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2024.txt", limit: 1000 },
    { id: "uassets-2025", name: "uAssets 2025", group: "uassets", category: "intl_ads",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2025.txt", limit: 1000 },
    { id: "uassets-2026", name: "uAssets 2026", group: "uassets", category: "intl_ads",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2026.txt", limit: 1000 },

    // 한국 필터
    { id: "noridev", name: "NoriDev-AdBlock-Filter", group: "korean", category: "korean",
      license: "CC BY-NC-SA 4.0", url: "https://raw.githubusercontent.com/noridev/NoriDev-AdBlock-Filter/master/filter/filter.txt", limit: 1500 },
    { id: "turtlecute", name: "Turtlecute Host List", group: "korean", category: "korean",
      license: "CC BY-NC-SA 4.0", url: "https://adblock.turtlecute.org/d3host.adblock", limit: 500 },
    { id: "d3host", name: "d3Host", group: "korean", category: "korean",
      license: "CC BY-NC-SA 4.0", url: "https://raw.githubusercontent.com/d3ward/toolz/master/src/d3host.txt", limit: 500 },
    { id: "list-kr", name: "List-KR", group: "korean", category: "korean",
      license: "GNU GPLv3", url: "https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-AdGuard.txt", limit: 2000 },
    { id: "filterslists-ko", name: "filterslists-KO", group: "korean", category: "korean",
      license: "GNU GPLv3", url: "https://cdn.jsdelivr.net/npm/@filteringdev/filterslists-ko@latest/dist/filterslist-AdGuard-unified.txt", limit: 2000 },
    { id: "extra-hosts", name: "추가 호스트", group: "korean", category: "korean",
      license: "프로젝트 자체", file: "tools/tmp/extra-hosts.txt", limit: 0 },

    // 개인정보 - 소셜/추적
    { id: "fanboy-social", name: "Fanboy's Social Blocking", group: "social", category: "privacy",
      license: "CC BY 3.0", url: "https://www.fanboy.co.nz/fanboy-social.txt", limit: 1500 },
    { id: "url-tracking", name: "AdGuard URL Tracking", group: "social", category: "privacy",
      license: "GNU GPLv3", url: "https://filters.adtidy.org/extension/chromium/filters/17.txt", limit: 1000 },
    { id: "uassets-privacy", name: "uAssets privacy", group: "social", category: "privacy",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt", limit: 1000 },

    // 안티애드블록 - 안티서클 11개 언어
    { id: "anti-cv-en", name: "안티서클 (영문)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/english.txt", limit: 500 },
    { id: "anti-cv-zh", name: "안티서클 (중문)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/chinese.txt", limit: 200 },
    { id: "anti-cv-cs", name: "안티서클 (체코어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/czech.txt", limit: 200 },
    { id: "anti-cv-fr", name: "안티서클 (프랑스어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/french.txt", limit: 200 },
    { id: "anti-cv-de", name: "안티서클 (독일어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/german.txt", limit: 200 },
    { id: "anti-cv-pl", name: "안티서클 (폴란드어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/polish.txt", limit: 200 },
    { id: "anti-cv-pt", name: "안티서클 (포르투갈어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/portuguese.txt", limit: 200 },
    { id: "anti-cv-ru", name: "안티서클 (러시아어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/russian.txt", limit: 200 },
    { id: "anti-cv-es", name: "안티서클 (스페인어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/spanish.txt", limit: 200 },
    { id: "anti-cv-tr", name: "안티서클 (터키어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/turkish.txt", limit: 200 },
    { id: "anti-cv-vi", name: "안티서클 (베트남어)", group: "anti_cv", category: "anti_cv",
      license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/raw/master/vietnamese.txt", limit: 200 },

    // 안티애드블록 - 성가신 요소
    { id: "fanboy-annoyance", name: "Fanboy's Annoyance", group: "annoyances", category: "anti_cv",
      license: "CC BY 3.0", url: "https://www.fanboy.co.nz/fanboy-annoyance.txt", limit: 1500 },

    // 보안 - 악성 사이트
    { id: "urlhaus", name: "URLhaus", group: "malware", category: "security",
      license: "MIT / CC0 1.0", url: "https://gitlab.com/curben/urlhaus-filter/-/raw/master/urlhaus-filter.txt", limit: 2500 },
    { id: "uassets-badware", name: "uAssets badware", group: "malware", category: "security",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt", limit: 1000 },
    { id: "uassets-resource-abuse", name: "uAssets resource-abuse", group: "malware", category: "security",
      license: "GPLv3", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt", limit: 500 },

    // 보안 - 코인마이닝
    { id: "nocoin", name: "NoCoin", group: "mining", category: "security",
      license: "MIT", url: "https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt", limit: 500 },
  ];

  // 조회 헬퍼
  function getGroupSources(groupId) {
    return FILTER_REGISTRY.filter((s) => s.group === groupId);
  }
  function getCategoryGroups(categoryId) {
    return FILTER_GROUPS.filter((g) => g.category === categoryId);
  }
  function getCategory(id) {
    return FILTER_CATEGORIES.find((c) => c.id === id);
  }
  function getGroup(id) {
    return FILTER_GROUPS.find((g) => g.id === id);
  }
  function getRemoteSources() {
    return FILTER_REGISTRY.filter((s) => !!s.url);
  }

  return {
    FILTER_REGISTRY,
    FILTER_GROUPS,
    FILTER_CATEGORIES,
    getGroupSources,
    getCategoryGroups,
    getCategory,
    getGroup,
    getRemoteSources,
  };
});
