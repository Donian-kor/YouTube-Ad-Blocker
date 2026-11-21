# 유튜브 광고 차단 감지 대응 작업 내역

2026-11-21 작업. 유튜브가 "광고 차단 프로그램이 감지되었습니다" 경고를 띄우고
영상 재생을 막던 문제를 해결한 기록이다. 나중에 유튜브가 감지를 다시 강화했을 때
참고할 수 있도록 원인 분석 과정과 최종 구현을 모두 남긴다.

커밋: `fdfa085 fix: 유튜브 광고 차단 감지 대응 (요청 스푸핑 + 광고 도메인 허용)`

---

## 1. 증상

- 유튜브 시청 시 "광고 차단 프로그램 사용이 감지되었습니다" 경고 표시
- 경고와 함께 영상 재생이 막힘
- 팝업에서 광고 차단을 끄면 경고가 사라지고 광고와 함께 정상 재생됨
- 같은 브라우저에서 AdGuard계열 확장은 유튜브 광고 차단이 정상 동작

## 2. 검증 과정 (다시 같은 실수를 하지 않기 위한 기록)

원인을 하나씩 분리해 확인했다. 각 단계는 "확장 새로고침 → 유튜브 F5"로 검증했다.

| # | 조건 | 결과 |
|---|---|---|
| 1 | 초기 상태 (광고 도메인 차단, 모든 스크립트 ON) | 경고 |
| 2 | 유튜브 텔레메트리 12개 경로 허용 | 경고 |
| 3 | 감지 콜백 무력화 추가 | 경고 |
| 4 | `content.js` 끄고 `youtube-main.js`만 | 경고 |
| 5 | `youtube-main.js` 끄고 `content.js`만 | 경고 |
| 6 | 광고 소재 도메인 9개 허용 + 두 스크립트 전부 끔 | **경고 없음** |
| 7 | 광고 소재 도메인 9개 허용 + 스크립트 ON | 경고 |
| 8 | `content.js`를 CSS 은닉만으로 축소 | 경고 |
| 9 | `content.js`에서 확장 식별 흔적 제거 | 경고 |
| 10 | 요청 body 스푸핑 추가 | **경고 없음, 광고 없음, 정상 재생** |

### 4·5번에서 얻은 오판

"한쪽만 켜도 경고가 난다"는 결과만 얻었을 뿐이다. 이걸 "켜진 쪽이 원인"으로 읽으면
잘못이다. 두 스크립트를 **전부** 껐을 때(6번)를 확인해야 원인 그룹이 갈린다.

### 6번의 "5초 로딩"이 결정적 단서

두 스크립트를 모두 껐을 때 경고가 없었고, 5초짜리 로딩 애니메이션이 떴다.
이것은 **광고가 정상 재생되고 있었다**는 뜻이다. 즉 이 시점의 세팅은
"광고를 전혀 막지 않은 상태"였다.

## 3. 최종 원인

> **광고를 어떤 방식으로든 막으면(숨김·스킵·도메인 차단·응답 정리) 전부 감지됐다.
> 광고가 정상 재생될 때만 경고가 없었다.**

세부적으로는 두 가지가 겹쳐 있었다.

### 3-1. 광고 소재 도메인을 DNR로 차단 (네트워크 계층)

유튜브 광고는 다음 순서로 동작한다.

1. 유튜브 서버가 "광고 config"를 정상 응답
2. 플레이어가 광고 소재를 다운로드 (`googlesyndication.com`, `doubleclick.net` ...)
3. **DNR이 차단 → 다운로드 실패**
4. 플레이어가 광고 로드 실패를 "광고 차단"으로 판정 → 경고

기존 프로젝트는 `doubleclick.net`·`googlesyndication.com` 등을 **전역 차단**하고 있었다.

### 3-2. 광고 데이터를 응답에서 지우는 방식 (클라이언트 계층)

서버는 계속 광고 config를 내려주는데 클라이언트에서만 광고를 지우면,
"광고를 요청했지만 재생하지 않은 클라이언트"가 되어 역시 감지된다.
광고를 CSS로 숨기거나 DOM에서 제거하는 것도 같은 이유로 감지됐다.

## 4. 해결 전략

AdGuard AdBlock Ultimate이 유튜브를 통과시키는 방식과 동일하다.

| 단계 | 방식 |
|---|---|
| 1 | 광고 소재 도메인을 **허용**해 로드 실패 자체를 없앤다 |
| 2 | 요청 body를 "광고를 받지 않는 클라이언트"로 위조해 **서버가 광고를 실어 보내지 않게** 한다 |
| 3 | 남은 광고 HTML은 CSS로만 숨긴다 (DOM 조작 금지) |
| 4 | 페이지에 확장 식별 흔적을 남기지 않는다 |

핵심은 **광고를 숨기는 게 아니라 애초에 광고가 오지 않게 만드는 것**이다.
이미 프로젝트에 있던 dogdrip.net 처리와 같은 원리다
(`background/rules.js`의 `dogdripAllowRules`: 감지 스크립트는 로드돼야 정상 이용자로 판단).

## 5. 변경 내용 (파일별)

### 5-1. `background/rules.js` — DNR 허용 규칙

**A. 유튜브 텔레메트리 12개 경로 허용** (`YOUTUBE_ALLOW_PATHS`, id 110~121, priority 100)

```text
||youtube.com/api/stats/            # ads · qoe (정상 재생에도 나가는 품질 통계)
||youtube.com/pagead/
||youtube.com/youtubei/v1/player/ad_break
||youtube.com/youtubei/v1/log_event
||youtube.com/ptracking?
||youtube.com/pcs/activeview?
||youtube.com/gen_204              # 정상 재생 비콘
||youtube.com/csi_204?             # 정상 재생 비콘
||youtube.com/player_204?          # 정상 재생 비콘
||youtube.com/set_awesome?
||youtube.com/get_video?
||fcmatch.youtube.com^
```

`gen_204`·`csi_204`·`player_204`·`api/stats/qoe`는 **광고와 무관한 정상 재생에도
매 시청마다 나가는** 텔레메트리다. 이게 막히면 유튜브가 비정상 클라이언트로 판단한다.
주로 `ruleset_filterslists-ko.json`(40건), `ruleset_easyprivacy.json`(18건)에서 차단되고 있었다.

**B. 광고 소재 도메인 9개 허용** (`YOUTUBE_AD_DOMAINS`, id 130~138, priority 100,
`initiatorDomains: ["youtube.com"]`)

```text
||doubleclick.net^
||googlesyndication.com^
||googleadservices.com^
||2mdn.net^
||googletagservices.com^
||adservice.google.com^
||ads.google.com^
||google-analytics.com^
||googletagmanager.com^
```

`initiatorDomains`가 있으므로 **유튜브가 요청할 때만** 허용된다.
다른 사이트의 광고는 계속 차단된다. `www.youtube.com`은 하위 도메인으로 자동 포함.

**C. 기타**
- `||youtube.com/pagead/` 전역 차단 규칙(기존 id 7) 삭제
- 위 두 배열을 `alwaysAllowRules`에 포함 (마스터 토글과 무관하게 항상 적용)
- `ALL_RULE_IDS`에 스프레드로 자동 추가 (재적용 시 중복 ID 오류 방지)

### 5-2. `youtube-main.js` — MAIN world 스크립틀릿

아래 7개 섹션 구조다.

**1) 감지 자체를 무력화** (AdGuard filter_1의 신규 유튜브 규칙 이식)
- `Promise.then` 콜백 소스에 `onAbnormalityDetected`가 있으면 빈 함수로 교체
  → 유튜브의 이상 징후 보고를 차단
- 콜백 소스에 `[native code]`가 있고 지연이 `17000ms`인 `setTimeout`만 17ms로 단축
  (AdGuard `adjust-setTimeout('[native code]', '17000', '0.001')` 대응)
- `Node.prototype.appendChild`를 Proxy로 감싸 유튜브가 붙이는 `about:blank` iframe의
  `contentWindow`에 페이지의 `fetch`·`Request`를 복사 (iframe 단독 후킹 검사 무력화)

**2) `Promise.prototype.then` Proxy**
- 감지 콜백은 빈 함수로, `.next(` / `jspbResponseCtor` 콜백은 값 정리로
- Proxy로 감싸 `Function.prototype.toString`이 `[native code]`로 보이게 함
  (기존에는 일반 함수 재할당이라 소스 코드가 그대로 노출됐다)

**3) `JSON.parse`**
- 플레이어 응답 형태일 때만 `cleanObject` 적용
- `playabilityStatus.status`가 `LOGIN_REQUIRED` / `CONTENT_CHECK_REQUIRED`이면
  스푸핑 단계를 다음으로 전진

**4) `Response.prototype.json`**

**5) `XMLHttpRequest`의 `responseText` / `response` getter**

**6) `ytInitialPlayerResponse` / `ytInitialData` setter**

**7) 요청 body 스푸핑** (AdGuard `pyv` 스크립틀릿 이식 — 이번 문제의 핵심)

`SPOOF_PARAMS = ["eAFgAQ", "8AUB"]` 로 요청 body를 조작한다.

- `params` = 광고를 받지 않는 클라이언트 값 (`eAFgAQ`, 재생 불가 시 `8AUB`)
- `playerRequest.params`·`playbackContext.params` 도 동일 값
- `playbackContext.adPlaybackContext` 제거
- `playbackContext.contentPlaybackContext.lactMilliseconds` = 현재 시각
  (지금 정상 시청 중인 것처럼 보이게 하는 필수 값)
- `context.client.configInfo.appInstallData` 제거 (광고 차단 탐지에 쓰이는 값)
- 숏츠(`/shorts/`)·`/tv`·`/embed` 는 대상에서 제외

후킹하는 4개 경로:

| 경로 | 대상 |
|---|---|
| `JSON.stringify` | fetch body 직렬화 |
| `Request` 생성자 (`construct` 트랩) | `fetch(new Request(...))` |
| `XMLHttpRequest.prototype.send` | XHR 경로 |
| `TextEncoder.prototype.encode` | 위 3개를 우회하는 직렬화 |

**8) 자동 음소거 해제** (`deleteAdKeys` 내부)

광고 응답에는 `playerConfig.audioConfig.muteOnStart = true` 가 들어와 영상이
음소거로 시작한다. watch 페이지이거나 cards가 있고 미니플레이어가 아닐 때 이 값을 삭제한다.

```js
const audio = obj.playerConfig && obj.playerConfig.audioConfig;
if (audio && audio.muteOnStart === true) {
  const isWatch = location.href.indexOf("/watch") !== -1;
  const hasCards = !!obj.cards;
  const isMiniplayer = !!(obj.playabilityStatus && obj.playabilityStatus.miniplayer);
  if (!isMiniplayer && (isWatch || hasCards)) delete audio.muteOnStart;
}
```

미니플레이어의 자동 재생 음소거는 정상 동작이므로 건드리지 않는다.

### 5-3. `content.js` — CSS 은닉만

**제거한 것** (모두 유튜브 광고 차단 감지의 신호가 되는 동작)

| 제거 | 이유 |
|---|---|
| 광고 요소 `remove()` | 광고 HTML이 사라지면 감지 |
| `video.currentTime`을 광고 끝으로 이동 | **광고가 0초에 끝난 것처럼 기록 → 가장 결정적인 신호** |
| `skipVideoAds()` (건너뛰기 버튼 `.click()`) | 광고가 정상 재생되지 않았다는 신호 |
| `restorePlayerControls()` (`style.visibility` 조작) | DOM 조작 노출 |
| `cleanupEmptyGridCells()` | DOM 조작 |

**추가로 제거한 확장 식별 흔적 3종**

| 흔적 | 문제 |
|---|---|
| `<html data-yab-state-token="…">`, `data-yab-enabled="…"` | 페이지에서 `getAttribute` 한 줄로 확인 가능 |
| `window.postMessage({source: "yab-extension", …})` | 페이지의 `message` 리스너로 가로챌 수 있음. 이름 자체가 확장 식별자 |
| `<style id="yab-ad-hide-style">` | `getElementById` 한 줄로 조회 가능 |

이 3개는 MAIN world 스크립트와 대화하기 위한 것이었으나, 스크립틀릿을
`manifest`의 `world: "MAIN"` 선언 방식으로 쓰면서 불필요해졌다.
style 요소는 id 없이 만들고 참조는 클로저 변수로만 유지한다.

**남은 동작**: CSS 주입, 광고 개수 세기(`countAds`), 통계 보고

### 5-4. `anti-bypass.js`, `general-blocker.js` — 유튜브에서 제외

기존에는 `studio.youtube.com`만 제외했으나 `/(^|\.)youtube\.com$/` 전체로 확대했다.

제외한 동작:
- `getComputedStyle` 재할당 + 반환 스타일 객체 변조
- `class="ads"`, `id="ad-content"` 등 bait 요소 7개 삽입
- `console.log` 재할당
- `.ad-banner`·`.ad-slot`·`[class*='advert']`·`iframe[src*='googlesyndication']` 등 DOM 제거

참고로 두 스크립트는 bait 7개 중 5개를 서로 만들고 지우는 충돌이 있었다.

### 5-5. `manifest.json`

`content_scripts`의 유튜브 항목 2개. `content.js`(격리 world)가 먼저,
`youtube-main.js`(`world: "MAIN"`)가 나중에 실행되도록 한다.
`content.js`는 `chrome.storage`를 쓰므로 격리 world가 필수다.

## 6. 검증 방법

### 6-1. 자동 테스트

```bash
node tools/test-main-hook.js    # 27건
node tools/validate-rules.js    # 정적 규칙 검사
node --check youtube-main.js content.js background/rules.js anti-bypass.js general-blocker.js
```

`tools/test-main-hook.js`가 다루는 항목:
- 응답 정리 9건 (광고 키 제거, 숏츠 `isAd`, 무한 재귀 방지)
- 감지 무력화 4건 (`onAbnormalityDetected`, `[native code]` 타이머 3종)
- iframe 복사 3건
- 요청 스푸핑 5건 (params 위조, youtubei 아닌 요청 제외, TextEncoder, XHR, 숏츠 제외)
- 자동 음소거 3건 (watch 해제, 미니플레이어 유지, false 유지)

### 6-2. DNR 규칙이 실제로 등록됐는지 확인

`chrome://extensions` → 확장의 **서비스 워커** 클릭 → 콘솔:

```js
chrome.declarativeNetRequest.getDynamicRules()
  .then(r => console.table(r.filter(x => x.id >= 110 && x.id <= 138)
    .map(x => [x.id, x.action.type, x.condition.urlFilter])))
```

- id 110~121 (12개)과 130~138 (9개)이 모두 `allow`로 보여야 한다
- `initiatorDomains`가 있는 규칙(130~138)은 콘솔에서 `(domain规则)` 형태로 표시될 수 있다

### 6-3. 수동 확인 항목

| # | 항목 | 정상 |
|---|---|---|
| 1 | 경고 없음 | "광고 차단 프로그램 감지" 경고가 뜨지 않음 |
| 2 | 광고 없음 | 프리롤·마스트헤드·홈 그리드 광고 모두 안 보임 |
| 3 | 재생 | 5초 로딩 후 정상 재생 |
| 4 | 소리 | 음소거로 시작하지 않음 |

## 7. 나중에 유튜브가 감지를 강화했을 때

### 7-1. 참고할 원본 위치

AdGuard 계열 필터 원문에 유튜브 대응이 들어 있다.

| 위치 | 내용 |
|---|---|
| `src/resources/filters/chromium-mv3/filter_1.txt` | 유튜브 스크립틀릿 원문 (`youtube.com#%#...`) |
| `src/resources/filters/chromium-mv3/filter_2.txt` | 유튜브 코스메틱 규칙 (`youtube.com##...`) |
| 빌드 결과물 `filters/local_script_rules.js` | 스크립틀릿 실제 구현체 |

저장소: `https://github.com/AdAvoid-Ltd/AdBlocker-Ultimate-for-Browsers`
(이 저장소에 유튜브 전용 코드는 없고, 전부 필터 목록 텍스트로 처리된다.)

`filter_1.txt`에서 찾을 규칙 키워드:

```text
onAbnormalityDetected          # 감지 결과 보고 콜백
[native code]                  # 네이티브 함수 여부 검사 타이머 (adjust-setTimeout)
movie_player                   # 플레이어 재생 복구
pyv / param_first / param_second / client_screen / ad_type / none   # params 상태 기계
eAFgAQ / 8AUB                  # 광고 없는 클라이언트 params 값
json-prune-xhr-response        # XHR 응답 정리
json-prune-fetch-response      # fetch 응답 정리
set-constant                   # ytInitialPlayerResponse.* = undefined
ssap                           # 서버측 광고 구간 스킵 (Array.prototype.push 후킹)
```

### 7-2. 점검 순서

1. **경고가 다시 뜨는 도메인/경로 확인** — 개발자 도구 Network 탭에서 차단된 요청 확인
2. **새 광고 도메인이 생겼는지** — `background/rules.js`의 `YOUTUBE_AD_DOMAINS`에 추가
3. **새 텔레메트리 경로가 생겼는지** — `YOUTUBE_ALLOW_PATHS`에 추가
4. **새 params 값이 등장했는지** — `SPOOF_PARAMS` 배열에 추가
5. **새 감지 함수가 등장했는지** — `neutralizeDetection()`에 추가
6. **자동 음소거 외 부작용** — `deleteAdKeys` 확인

### 7-3. 자주 나는 부작용과 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| 유튜브만 광고가 보임 | 스푸핑 실패 | `SPOOF_PARAMS` 값 확인, 콘솔에서 요청 body의 `params` 확인 |
| 숏츠에서 이상 동작 | 스푸핑 대상에서 의도적으로 제외 | `isSpoofSkipped()` 조건 확인 |
| 영상이 음소거로 시작 | `muteOnStart` 미처리 | `deleteAdKeys`의 자동 음소거 해제 확인 |
| 다른 사이트 광고 차단이 약해짐 | `initiatorDomains` 없는 allow 규칙 추가 | allow 규칙에 `initiatorDomains: ["youtube.com"]` 부여 |
| 유튜브에서만 재생 오류 | DNR이 유튜브 리소스 차단 | Network 탭에서 차단 요청 확인 후 `YOUTUBE_ALLOW_PATHS` 추가 |

## 8. 주의 사항

- **유튜브에서만 허용하는 규칙**이다. `initiatorDomains`가 없는 allow 규칙을 추가하면
  다른 사이트의 광고까지 허용되므로 반드시 확인한다.
- `params` 위조 값(`eAFgAQ`, `8AUB`)은 AdGuard 필터에서 가져온 값이다.
  임의로 추측한 값을 넣지 않는다.
- 광고 소재 도메인을 허용하므로 **유튜브 광고 소재는 실제로 다운로드된다.**
  화면에 보이지 않는 이유는 요청 위조로 광고 config 자체가 오지 않기 때문이다.
- `content.js`에 DOM 조작을 다시 넣지 않는다. 넣는 순간 감지된다.
- `anti-bypass.js`·`general-blocker.js`를 유튜브에 다시 포함하지 않는다.