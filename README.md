# YouTube Ad Blocker

크롬(Chrome)에서 유튜브 영상 광고와 일반 사이트 광고를 차단하는 Manifest V3 확장 프로그램입니다.
개발자 모드에서 폴더 또는 ZIP을 불러와 사용합니다.

**현재 버전: 2.1**

## 주요 기능

- **유튜브 광고 차단** — 플레이어 응답의 `adSlots` / `playerAds` / `adPlacements` / `adBreakHeartbeatParams` 제거, Shorts `isAd` 플래그 무력화
- **네트워크 광고 차단** — EasyList + EasyPrivacy(약 10만 규칙) + 한국/Turtlecute/d3Host 도메인 규칙을 DNR로 차단
- **인라인 광고 차단** — 네트워크 차단으로 잡히지 않는 배너·사이드바·스폰서·팝업·오버레이 광고를 CSS 숨김 + DOM 제거 (`general-blocker.js`)
- **안티애드블록 우회** — 감지 경고창·베이트 요소를 숨기고, dogdrip.net 서버 감지도 우회
- **사이트별 누적 차단 수** — 툴바 뱃지와 팝업에 표시, 탭 전환·새로고침 후에도 유지
- **차단 URL 목록** — 팝업의 「총 차단」 클릭 시 확인
- **ON/OFF 토글** — 팝업에서 즉시 전환
- **우클릭 요소 차단** — 광고 영역 우클릭 → 「이 요소 차단」, 사이트별 저장

## 설치 방법

### ZIP 배포판 (권장)

1. GitHub Release에서 `youtube-ad-blocker-v2.1.zip` 다운로드
2. 압축 해제 (`manifest.json`이 들어있는 폴더 확인)
3. `chrome://extensions/` 접속 → **개발자 모드** ON
4. **압축해제된 확장 프로그램을 로드합니다** → 2번 폴더 선택
5. 이미 열린 탭은 **F5 새로고침**

### 소스에서 설치

1. `git clone` 또는 저장소 다운로드
2. 위 3~5단계 동일하게 진행

> Release ZIP에는 `tools/`, `_metadata/` 등 개발용 파일이 제외되어 있습니다.

## 파일 구조

```
manifest.json          확장 설정(권한, 스크립트, 규칙 세트)
background.js          DNR 규칙/통계/뱃지/우클릭 메뉴, 사이트별 allow 규칙
youtube-main.js        유튜브 MAIN world 응답 후킹
content.js             유튜브 DOM 정리/광고 스킵
general-blocker.js     일반 사이트 인라인 광고 숨김 (tryblock, dogdrip, d3ward, uBO 테스트)
anti-bypass.js         안티애드블록 감지 무력화
element-blocker.js     우클릭 요소 차단
popup.html / popup.js  팝업 UI
options.html / options.js  설정 페이지
filters/               DNR 정적 규칙셋 6개 (ruleset_1~5 + korean)
tools/                 필터 생성기·검증기·테스트 (배포 ZIP 미포함)
_metadata/             DNR 인덱스 캐시 (배포 ZIP 미포함)
```

## 개발

```bash
node tools/build-filters.js          # EasyList + EasyPrivacy → ruleset_1~5.json
node tools/build-filters.js --korean # NoriDev + Turtlecute + d3Host → ruleset_korean.json

node tools/validate-rules.js         # 규칙 검증
node tools/test-main-hook.js         # 유튜브 후킹 테스트
node tools/test-site-badge.js        # 사이트별 뱃지 테스트
node tools/test-element-blocker.js   # 우클릭 요소 차단 테스트
```

## 테스트 사이트 검증 내역

실제 크롬에서 아래 테스트 사이트들을 열어 차단 동작을 확인하고, 미차단 항목을 규칙에 반영했습니다.

| 사이트 | 테스트 내용 | 결과 / 조치 |
|---|---|---|
| [tryblock.org](https://tryblock.org/ko/adblock-test) | 기본/중급/고급 인라인 DOM 광고 3단계 | 배너·사이드바·스폰서·동적·오버레이·가짜 다운로드·리디렉션 체인 전부 숨김 |
| [tryblock.org 우회](https://tryblock.org/webgeeker/adblock-bypass) | 광고 탐지 우회 챌린지 | 감지 결과 메시지(`.test-area .text-center`) 숨김 |
| [dogdrip.net](https://www.dogdrip.net/) | 실제 한국 커뮤니티 | 고유 광고 마커 `enjgioijew` iframe 차단, 서버 측 "광고 허용" 감지 우회 (분석 스크립트 허용 + 화면 밖 이동) |
| [d3ward.com](https://d3ward.com/adblock) | 135개 도메인/스크립트/코스메틱 | 128 → 133+ 차단. 누락 도메인·`ads.js` 경로·우선순위 수정, d3Host 리스트 통합 |
| [paileactivist/toolz](https://paileactivist.github.io/toolz/adblock.html) | d3ward 구버전 80개 | 88% → 미차단 14개 도메인(Google/Amazon/Facebook/Twitter/Pinterest/Reddit/Apple/Xiaomi) 규칙 추가 |
| [raymondhill.net/ublock](https://raymondhill.net/ublock/tests.html) | uBO 공식 네트워크+코스메틱 | 광고 iframe(`ad.html`) 차단, `#ADSLOT_1` 코스메틱 제거 (대조군 iframe은 유지) |
| 유튜브 | 영상 전/중·Shorts·피드·배너 | 광고 필드·DOM 0개, 영상 정상 재생 확인 |

## 개선 내역 (버전별)

- **초기**: `Promise.then` 후킹 무한 재귀 수정, 유튜브 광고 키/Shorts 처리 확대, DOM 전체 제거, Observer 등록 수정, DNR 로드 오류(`||*`·중복 ID) 수정
- **v1.2**: 한국 도메인 + Turtlecute 규칙셋 추가
- **v1.3~v1.5**: 일반 사이트 인라인 광고 차단(`general-blocker.js`), tryblock 3단계/우회 챌린지 대응
- **v1.6~v1.7**: dogdrip 광고 iframe 차단 및 서버 측 감지 우회
- **v1.8~v1.9**: d3ward 테스트 미차단 항목 보완, d3Host 리스트(131개) 통합
- **v2.0**: paileactivist/toolz 미차단 14개 도메인 추가
- **v2.1**: uBO 공식 테스트의 광고 iframe·`#ADSLOT_1` 차단 추가, README 정리

## 참고 자료

- [uBlock Origin / uBOL-home](https://github.com/uBlockOrigin/uBOL-home), [uBlock](https://github.com/gorhill/uBlock) — 유튜브 응답 후킹·필터 기법
- [raymondhill.net/ublock 테스트](https://raymondhill.net/ublock/tests.html) — 네트워크/코스메틱 차단 검증
- [NoriDev-AdBlock-Filter](https://github.com/noridev/NoriDev-AdBlock-Filter), [List-KR](https://github.com/List-KR/List-KR), [filterslists-ko](https://github.com/FilteringDev/filterslists-ko) — 한국 광고 도메인/필터
- [AdAway](https://github.com/AdAway/AdAway), [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists) — 호스트 기반 차단 참고 (hagezi는 규모가 커 미포함)
- [Turtlecute Host List](https://adblock.turtlecute.org/d3host.adblock), [d3ward d3Host](https://raw.githubusercontent.com/d3ward/toolz/master/src/d3host.txt) — 호스트 목록 (보조 규칙셋 포함)
- [tryblock.org](https://tryblock.org/ko), [d3ward.com](https://d3ward.com/adblock), [paileactivist/toolz](https://paileactivist.github.io/toolz/adblock.html) — 차단 테스트 사이트

## 주의

- 통계는 `chrome.declarativeNetRequest.onRuleMatchedDebug`를 사용하므로 **개발자 모드 확장에서만** 동작합니다.
- 사이트별 차단 수는 `chrome.storage.local`의 `siteCounts`, 직접 차단 요소는 `blockedSelectors`에 저장됩니다.
- 정적 규칙 파일 수정 후에는 확장을 **재로드(↻)** 해야 반영됩니다.
- dogdrip.net은 광고 수익으로 운영되므로, 감지 우회로 인해 향후 서버 정책이 강화되면 차단 페이지가 다시 나타날 수 있습니다.
