// background/state.js - 서비스 워커 모듈 간에 공유하는 상태
// importScripts로 로드되는 클래식 스크립트끼리 전역에서 참조한다.
const AppState = {
  enabledState: true,   // 전체 광고 차단 ON/OFF
  activeTabId: -1,

  // 통계 (blockedLog는 최대 5,000개, 전체 차단 수는 blockedRequests에 무제한 누적)
  stats: {
    blockedAds: 0,
    blockedRequests: 0,
    removedDomAds: 0,
    blockedLog: [],   // [{ url, time }]
    lastBlockAt: 0,   // 마지막 차단 시각 (통계 패널에 표시)
    lastReset: Date.now(),
  },

  // DOM 제거 기록: 네트워크 로그와 별도로 저장 (최대 5,000건)
  // 각 항목 = { site, count, time } — 요소 HTML/선택자는 저장하지 않음
  domLog: [],

  // 사이트(호스트)별 차단 수: "youtube.com" -> { net, dom }
  siteCounts: new Map(),
  tabSites: new Map(),           // 탭 ID -> 현재 사이트(호스트)
  pendingTabLookups: new Map(),  // 탭 ID -> 사이트 조회 대기 콜백
};
