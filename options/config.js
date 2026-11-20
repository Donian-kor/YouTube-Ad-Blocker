// options/config.js - 설정 페이지 공용 상수
// manifest.json의 declarative_net_request.rule_resources와 1:1 대응
export const FILTER_LIST = [
  {
    id: "security",
    name: "보안",
    description: "악성 도메인, 피싱, cryptomining 차단",
    license: "MIT / CC0 1.0",
    source: "NoCoin, URLhaus",
    icon: "🚨"
  },
  {
    id: "ads",
    name: "광고 차단",
    description: "전 세계 광고를 차단하는 기본 필터 (EasyList + EasyPrivacy + Ultimate Ad Filter)",
    license: "CC BY-SA 3.0 / GNU GPLv3",
    source: "EasyList, EasyPrivacy, AdBlocker Ultimate",
    icon: "📢"
  },
  {
    id: "korean",
    name: "한국 광고 필터",
    description: "국내 광고·트래커 차단 (NoriDev, Turtlecute, d3Host, List-KR)",
    license: "CC BY-NC-SA 4.0 / GNU GPLv3",
    source: "NoriDev, Turtlecute, d3Host, List-KR",
    icon: "🇰🇷"
  },
  {
    id: "privacy",
    name: "개인정보 보호",
    description: "소셜 미디어 통합 제거 + URL 추적 파라미터 제거",
    license: "CC BY 3.0 / GNU GPLv3",
    source: "Fanboy's Social, AdGuard URL Tracking",
    icon: "🔒"
  },
  {
    id: "anti_circumvention",
    name: "안티서클",
    description: "광고 우회 스크립트 차단 (영문/중문/유럽어권)",
    license: "GNU GPLv3",
    source: "abp-filters/abp-filters-anti-cv",
    icon: "🛡️"
  },
  {
    id: "annoyances",
    name: "성가신 요소",
    description: "팝업, 쿠키 동의, 배너 등 성가신 요소 차단",
    license: "CC BY 3.0",
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
  { name: "EasyList", group: "광고 차단", license: "CC BY-SA 3.0", url: "https://easylist.to/" },
  { name: "EasyPrivacy", group: "광고 차단", license: "CC BY-SA 3.0", url: "https://easylist.to/easylist/easyprivacy.txt" },
  { name: "AdGuard Base (Ultimate Ad Filter)", group: "광고 차단", license: "GNU GPLv3 / CC BY 3.0", url: "https://github.com/AdguardTeam/AdguardFilters" },
  { name: "NoriDev-AdBlock-Filter", group: "한국 광고", license: "CC BY-NC-SA 4.0", url: "https://github.com/noridev/NoriDev-AdBlock-Filter" },
  { name: "Turtlecute Host List", group: "한국 광고", license: "CC BY-NC-SA 4.0", url: "https://adblock.turtlecute.org/d3host.adblock" },
  { name: "d3Host", group: "한국 광고", license: "CC BY-NC-SA 4.0", url: "https://github.com/d3ward/toolz" },
  { name: "List-KR", group: "한국 광고", license: "GNU GPLv3", url: "https://github.com/List-KR/List-KR" },
  { name: "Fanboy's Social Blocking", group: "개인정보 보호", license: "CC BY 3.0", url: "https://www.fanboy.co.nz/" },
  { name: "AdGuard URL Tracking", group: "개인정보 보호", license: "GNU GPLv3", url: "https://github.com/AdguardTeam/AdguardFilters" },
  { name: "abp-filters-anti-cv", group: "안티서클", license: "GNU GPLv3", url: "https://github.com/abp-filters/abp-filters-anti-cv" },
  { name: "Fanboy's Annoyance", group: "성가신 요소", license: "CC BY 3.0", url: "https://www.fanboy.co.nz/" },
];
