// background/state.js - 서비스 워커 모듈 간에 공유하는 상태
// importScripts로 로드되는 클래식 스크립트끼리 전역에서 참조한다.
const AppState = {
  enabledState: true,   // 전체 광고 차단 ON/OFF
  activeTabId: -1,

  // 통계 (blockedLog는 최대 300개)
  stats: {
    blockedAds: 0,
    blockedRequests: 0,
    removedDomAds: 0,
    blockedLog: [],   // [{ url, time }]
    lastReset: Date.now(),
  },

  // 사이트(호스트)별 차단 수: "youtube.com" -> { net, dom }
  siteCounts: new Map(),
  tabSites: new Map(),           // 탭 ID -> 현재 사이트(호스트)
  pendingTabLookups: new Map(),  // 탭 ID -> 사이트 조회 대기 콜백
};
