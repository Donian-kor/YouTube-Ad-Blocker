# YouTube Ad Blocker

크롬(Chrome)에서 유튜브 영상 광고와 일반 사이트 광고를 차단하는 확장 프로그램입니다.
Manifest V3 기반이며, 개발자 모드에서 폴더 또는 ZIP을 불러와 사용합니다.

**현재 버전: 1.2**

## 주요 기능

- **유튜브 영상 광고 차단** — 플레이어 응답의 `adSlots` / `playerAds` / `adPlacements` / `adBreakHeartbeatParams` 를 제거하고 Shorts 광고 플래그(`isAd`)를 무력화
- **일반 사이트 광고 차단** — EasyList + EasyPrivacy(약 10만 규칙)에 NoriDev 한국 광고 도메인 + Turtlecute 호스트 목록(총 330개)을 더해 DNR로 차단
- **사이트별 누적 차단 수** — 툴바 뱃지와 팝업에 표시. 페이지를 옮기거나 탭을 바꿔도 유지
- **차단 URL 목록** — 팝업의 「총 차단」을 누르면 확인 가능
- **광고 차단 ON/OFF 토글** — 팝업에서 즉시 전환
- **우클릭 요소 차단** — 광고 영역을 우클릭 → 「이 요소 차단」. 사이트별로 저장되어 다음 방문에도 적용
- **안티애드블록 우회** — 광고 차단 감지 경고창/베이트 요소를 숨겨 정상 이용 가능

## 설치 방법

### ZIP 배포판으로 설치 (권장)

1. GitHub Release 페이지에서 `youtube-ad-blocker-v1.2.zip` 을 내려받습니다.
2. ZIP의 압축을 풀어 폴더를 만듭니다. (`manifest.json`이 들어있는 폴더)
3. 크롬 주소창에 `chrome://extensions/` 를 입력합니다.
4. 오른쪽 위 **개발자 모드**를 켭니다.
5. **압축해제된 확장 프로그램을 로드합니다** 를 누르고 2번에서 풀은 폴더를 선택합니다.
6. 이미 열려 있던 탭은 **새로고침(F5)** 해야 새 스크립트가 적용됩니다.

### 소스에서 설치

1. 이 저장소를 내려받거나 `git clone` 합니다.
2. 위 3~6단계와 동일하게 `chrome://extensions/` 에서 폴더를 로드합니다.

> 참고: 소스 저장소에는 필터 생성 도구(`tools/`)와 빌드 메타데이터(`_metadata/`)가 함께 들어 있습니다. 실제 사용에는 필요 없으며, Release의 ZIP에는 제외되어 있습니다.

## 폴더 구조

```
manifest.json          확장 설정(권한, 스크립트, 규칙 세트)
background.js          DNR 규칙 제어, 사이트별 통계/뱃지, 우클릭 메뉴
youtube-main.js        유튜브 페이지 MAIN world 후킹
content.js             유튜브 DOM 정리 및 광고 자동 스킵 보조
anti-bypass.js         안티애드블록 감지 무력화
element-blocker.js     우클릭 요소 차단
popup.html / popup.js  팝업 UI
options.html / options.js  설정 페이지
filters/               EasyList/EasyPrivacy 변환 DNR 규칙 + 보조 도메인 규칙
tools/                 필터 생성기, 규칙 검증기, 테스트 (배포 ZIP에는 미포함)
_metadata/             Chrome DNR 인덱스 캐시 (배포 ZIP에는 미포함)
```

## 개발

필터 규칙을 다시 만들려면:

```
node tools/build-filters.js          # EasyList + EasyPrivacy → ruleset_1~5.json
node tools/build-filters.js --korean # NoriDev + Turtlecute → ruleset_korean.json
```

검사 및 테스트:

```
node tools/validate-rules.js
node tools/test-main-hook.js
node tools/test-site-badge.js
node tools/test-element-blocker.js
```

## 개선 내역

- `Promise.then` 후킹에서 원본 콜백을 캡처하지 않아 발생하던 **무한 재귀(스택 오버플로)** 를 수정했습니다. 이 버그 때문에 유튜브 플레이어 응답 처리가 깨져 광고 차단이 동작하지 않았습니다.
- uBlock Origin의 현재 유튜브 대응(`set-constant` / `json-prune` / `trusted-replace-*-response`)을 참고해 광고 키와 Shorts `isAd` 플래그 처리 범위를 넓혔습니다.
- DOM 광고 제거가 선택자당 한 요소만 지우던 문제를 고쳐 **모든 일치 요소**를 제거하도록 했습니다.
- 안티애드블록 감시 Observer가 `document_start` 시점에 등록되지 않던 문제를 `document` 감시로 수정했습니다.
- DNR 정적 규칙의 `||*` 패턴, 동적 규칙 id 중복 등 실제 브라우저에서만 드러나던 로드 오류를 수정했습니다.
- 한국 광고 도메인 + Turtlecute 규칙(330개)을 별도 규칙셋으로 추가했습니다.

## 참고 자료

아래 저장소의 필터/기법을 참고했습니다.

- [uBlock Origin / uBOL-home](https://github.com/uBlockOrigin/uBOL-home), [uBlock](https://github.com/gorhill/uBlock) — 유튜브 광고 응답 후킹 기법
- [NoriDev-AdBlock-Filter](https://github.com/noridev/NoriDev-AdBlock-Filter) — 한국 광고 도메인·안티애드블록 목록
- [List-KR](https://github.com/List-KR/List-KR), [filterslists-ko](https://github.com/FilteringDev/filterslists-ko) — 한국 사이트 필터 구조 참고
- [AdAway](https://github.com/AdAway/AdAway) — 호스트 기반 차단 도메인 참고
- [Turtlecute Host List](https://adblock.turtlecute.org/d3host.adblock) — 간단 호스트 차단 목록 (보조 규칙셋에 포함)
- [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists) — DNS 차단 목록 구조 참고 (규모가 커서 현재 미포함)

## 참고

- 차단 통계는 `chrome.declarativeNetRequest.onRuleMatchedDebug` 를 사용하므로 **개발자 모드(압축 해제) 확장에서만** 동작합니다. ZIP 배포판도 개발자 모드로 불러와야 합니다.
- 사이트별 차단 수는 `chrome.storage.local` 의 `siteCounts`, 직접 차단한 요소는 `blockedSelectors` 에 저장됩니다.
- DNR 정적 규칙은 브라우저가 설치 시 인덱싱하므로, 규칙 파일을 직접 수정한 뒤에는 확장을 다시 로드(재설치)해야 반영됩니다.
