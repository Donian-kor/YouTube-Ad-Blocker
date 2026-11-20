// options/config.js - 설정 페이지 공용 상수
// manifest.json의 declarative_net_request.rule_resources와 1:1 대응
export const FILTER_LIST = [
  {
    id: "security",
    name: "보안",
    description: "악성 도메인, 피싱, cryptomining 차단",
    filterCount: 137434,
    source: "NoCoin, URLhaus, uAssets badware 등",
    icon: "🚨"
  },
  {
    id: "ads",
    name: "광고 차단",
    description: "전 세계 광고를 차단하는 기본 필터 (EasyList + EasyPrivacy + Ultimate Ad Filter)",
    filterCount: 127583,
    source: "EasyList, EasyPrivacy, AdBlocker Ultimate, Peter Lowe's, uAssets 등",
    icon: "📢"
  },
  {
    id: "korean",
    name: "한국 광고 필터",
    description: "국내 광고·트래커 차단 (NoriDev, Turtlecute, d3Host, List-KR)",
    filterCount: 2286,
    source: "NoriDev, Turtlecute, d3Host, List-KR, filterslists-KO",
    icon: "🇰🇷"
  },
  {
    id: "privacy",
    name: "개인정보 보호",
    description: "소셜 미디어 통합 제거 + URL 추적 파라미터 제거",
    filterCount: 1459,
    source: "Fanboy's Social, AdGuard URL Tracking, uAssets privacy",
    icon: "🔒"
  },
  {
    id: "anti_circumvention",
    name: "안티서클",
    description: "광고 우회 스크립트 차단 (영문/중문/유럽어권)",
    filterCount: 1041,
    source: "abp-filters-anti-cv (eyeo) 11개 언어",
    icon: "🛡️"
  },
  {
    id: "annoyances",
    name: "성가신 요소",
    description: "팝업, 쿠키 동의, 배너 등 성가신 요소 차단",
    filterCount: 2445,
    source: "Fanboy's Annoyance List",
    icon: "🧹"
  }
];

// 대용량 필터 그룹 — 항상 켜짐, 사용자가 끌 수 없음
export const LOCKED_GROUPS = new Set(["ads", "security"]);

// 출처 및 라이선스 표 데이터 — 개별 필터 소스별로 분리
export const LICENSE_TABLE = [
  { name: "NoCoin", group: "보안", license: "MIT", url: "https://github.com/hoshsadiq/adblock-nocoin-list" },
  { name: "URLhaus", group: "보안", license: "MIT / CC0 1.0", url: "https://gitlab.com/curben/urlhaus-filter" },
  { name: "uAssets badware / resource-abuse", group: "보안", license: "GPLv3", url: "https://github.com/uBlockOrigin/uAssets" },
  { name: "EasyList", group: "광고 차단", license: "CC BY-SA 3.0", url: "https://easylist.to/" },
  { name: "Peter Lowe Blocklist", group: "광고 차단", license: "See source", url: "https://pgl.yoyo.org/adservers/" },
  { name: "uAssets filters (general/2024~2026)", group: "광고 차단", license: "GPLv3", url: "https://github.com/uBlockOrigin/uAssets" },
  { name: "EasyPrivacy", group: "광고 차단", license: "CC BY-SA 3.0", url: "https://easylist.to/easylist/easyprivacy.txt" },
  { name: "AdGuard Base (Ultimate Ad Filter)", group: "광고 차단", license: "GNU GPLv3 / CC BY 3.0", url: "https://github.com/AdguardTeam/AdguardFilters" },
  { name: "NoriDev-AdBlock-Filter", group: "한국 광고", license: "CC BY-NC-SA 4.0", url: "https://github.com/noridev/NoriDev-AdBlock-Filter" },
  { name: "Turtlecute Host List", group: "한국 광고", license: "CC BY-NC-SA 4.0", url: "https://adblock.turtlecute.org/d3host.adblock" },
  { name: "d3Host", group: "한국 광고", license: "CC BY-NC-SA 4.0", url: "https://github.com/d3ward/toolz" },
  { name: "List-KR", group: "한국 광고", license: "GNU GPLv3", url: "https://github.com/List-KR/List-KR" },
  { name: "filterslists-KO (Unified)", group: "한국 광고", license: "GNU GPLv3", url: "https://github.com/FilteringDev/filterslists-KO" },
  { name: "Fanboy's Social Blocking", group: "개인정보 보호", license: "CC BY 3.0", url: "https://www.fanboy.co.nz/" },
  { name: "AdGuard URL Tracking", group: "개인정보 보호", license: "GNU GPLv3", url: "https://github.com/AdguardTeam/AdguardFilters" },
  { name: "uAssets privacy", group: "개인정보 보호", license: "GPLv3", url: "https://github.com/uBlockOrigin/uAssets" },
  { name: "abp-filters-anti-cv (eyeo)", group: "안티서클", license: "GNU GPLv3", url: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv" },
  { name: "Fanboy's Annoyance", group: "성가신 요소", license: "CC BY 3.0", url: "https://www.fanboy.co.nz/" },
];
