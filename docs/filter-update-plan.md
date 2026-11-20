# 필터 업데이트 기능 기획·보안 문서

> 작성일: 2026-11-20
> 기준 코드: `manifest.json` v3.2, `background.js`, `options.html/js`
> 이 문서는 **현재 저장소에 실제로 존재하는 코드**와 **Chrome 공식 확장 문서에서 확인한 사실**만을 근거로 작성했습니다. 확인되지 않은 내용은 "확인 필요"로 표시했으며, 없는 코드를 추측해 만들지 않았습니다.

---

## 1. 목표

- 광고 차단 목록(필터)을 바꿀 때마다 확장 프로그램 전체를 재설치하지 않게 한다.
- 설정 페이지(`options.html`)의 **"최신 필터 업데이트" 버튼 한 번**으로 최신 필터를 받아 적용한다.
- 일반 사용자는 **주소 입력·복사·붙여넣기·설정을 하지 않는다.** 버튼만 누른다.
- **Chrome 동적 규칙 30,000개 한도를 준수한다.**
- **광고 차단 / 보안 그룹(정적 263,432개)은 활성화/비활성화 불가** — 항상 켜져 있어야 한다.
- 나머지 4개 그룹(한국 광고, 개인정보 보호, 안티서클, 성가신 요소)은 필요에 따라 끄고 켤 수 있다.
- List-KR 저장소 필터를 한국 광고 필터 그룹에 추가한다.
- **설정 페이지에서 그룹별로 펼쳐서 내부 필터 목록을 볼 수 있어야 한다.**
- **설정 페이지를 탭(Tab) 형식으로 재구성한다.**
  - **필터 목록 토글 탭**: 6개 그룹의 활성화/비활성화 + 펼치기
  - **내 차단 목록 탭**: 우클릭으로 추가한 사이트별 차단 요소 목록 표시 + 직접 편집
  - **출처 및 라이선스 탭**: 필터 소스별 라이선스/출처 안내
- **설정 페이지 가로폭을 반응형(Responsive)으로 수정한다.**
  - 현재 고정 560px → 브라우저 크기에 따라 `min(560px, 100vw - 32px)` 등으로 조절
  - 모바일/좁은 창에서도 가로 스크롤 없이 표시

---

## 2. 현재 코드에서 확인한 사실 (근거)

| 항목 | 확인 결과 | 근거 파일·줄 |
|---|---|---|
| 필터 규칙 수 (정적) | **263,432개** | `filters/` 폴더 전체 (14개 JSON 파일) |
| 정적 규칙셋 | 6개 그룹 (14개 규칙셋 파일) | `manifest.json` 29~42줄 |
| 동적 규칙 | `background.js`에 68개 하드코딩 (`adBlockRules`, id 1~68) + dogdrip 9개 (101~109) + Studio 1개 (100) | `background.js` 6~88줄, 276~299줄 |
| 동적 규칙 관리 | `chrome.declarativeNetRequest.updateDynamicRules()` 사용 중 | `background.js` 405~423줄 `applyRules()` |
| 동적 규칙 ID | 1~68, 100~109 사용 중. 새 규칙은 **1000번대** 별도 대역 사용 | `background.js` 292~299줄 `ALL_RULE_IDS` |
| 규칙 ON/OFF | `updateEnabledRulesets()`로 정적 규칙셋 전체를 켜고 끔 | `background.js` 353~394줄 |
| 필터 그룹 ON/OFF | `applyFilterStates` 메시지로 개별 그룹 토글 | `background.js` 458~475줄, `options.js` 55~83줄 |
| 설정 페이지 | 통계 표시 + 필터 그룹 토글 + 전체 ON/OFF | `options.html` 153~191줄, `options.js` 전부 |
| 우클릭 차단 저장소 | `chrome.storage.local`의 `blockedSelectors` 키에 사이트별 배열로 저장 | `element-blocker.js` 8, 162~227줄 |
| 우클릭 차단 메시지 | `blockLastRightClicked`, `clearSiteBlocks` 메시지로 처리 | `element-blocker.js` 288~333줄, `background.js` 543~550줄 |
| host_permissions | 유튜브·구글 계열 도메인만 있음. **CDN 주소 없음** | `manifest.json` 15~24줄 |
| CSP | manifest에 `content_security_policy` 키 없음 → **기본 CSP 적용** (`script-src 'self'; object-src 'self';`) | `manifest.json` 전체 |
| 원격 fetch | **확장 런타임 코드에는 원격 `fetch()` 없음** (필터는 패키지 내장). 단, `tools/build-filters.js` 199줄에는 **빌드 시점**에 필터를 다운로드하는 `fetch()`가 있음 | 전 파일 검색 결과 |
| 규칙 검증기 | `tools/validate-rules.js` — id 중복, ASCII, 30,000개 초과 등 검사 | `tools/validate-rules.js` 전부 |
| 라이선스 | CC BY-NC-SA 4.0. 내장 필터도 각 소스의 라이선스 준수 | `README.md` 122~131줄 |

### 현재 필터 그룹별 규칙 수 (정적)

| 그룹 | 규칙 수 | 동적 배분 | 동적 업데이트 | UI 토글 | 펼치기 시 표시 |
|------|---------|----------|-------------|---------|-------------|
| 광고 차단 (EasyList + EasyPrivacy + Ultimate) | 123,075 | 19,000 | 상위 19,000개만 | ❌ 불가 (항상 ON) | EasyList, EasyPrivacy, Ultimate Ad Filter |
| 한국 광고 필터 (NoriDev + Turtlecute + d3Host + extra-hosts + **List-KR**) | 1,856 | 1,856 (전체) | 전체 | ✅ 가능 | NoriDev, Turtlecute, d3Host, List-KR, extra-hosts |
| 개인정보 보호 (Fanboy's Social + URL Tracking) | 270 | 270 (전체) | 전체 | ✅ 가능 | Fanboy's Social, URL Tracking |
| 안티서클 (abp-filters-anti-cv) | 142 | 142 (전체) | 전체 | ✅ 가능 | anti-cv (영문/중문/유럽어) |
| 성가신 요소 (Fanboy's Annoyance) | 2,445 | 2,445 (전체) | 전체 | ✅ 가능 | Fanboy's Annoyance |
| 보안 (NoCoin + URLhaus) | 134,458 | 6,000 | 상위 6,000개만 | ❌ 불가 (항상 ON) | NoCoin, URLhaus |

> **중요 정정**: 30,000개는 **그룹별이 아니라 확장 전체 동적 규칙 합계 한도**다.
> 위 배분 합계 = 19,000 + 1,856 + 270 + 142 + 2,445 + 6,000 = **29,713개** (여유 287개).

---

## 3. 설정 페이지 UI 구성 (라이트 테마 + 탭 + 반응형)

### 3.1 전체 구조

```
설정 페이지 (라이트 테마, 반응형 가로폭: min(720px, 100vw - 24px))
│
├── 통계 패널 (모든 탭에서 항상 상단에 표시)
│   ├── 총 차단 / 네트워크 차단 / DOM 제거 (가로 한 줄)
│   ├── [통계 재설정] 버튼
│   └── 마지막 재설정 날짜 (한 줄)
│
├── 탭 바 (통계 재설정 하단에 위치)
│   ├── [필터 목록] 탭
│   ├── [내 차단 목록] 탭
│   └── [출처 및 라이선스] 탭
│
├── [필터 목록] 탭 내용
│   ├── 전체 활성화 / 전체 비활성화 버튼
│   ├── 필터 카드 6개 (2열 그리드, 한 화면에 표시)
│   │   ├── 🚨 보안 ← 첫 행 [🔒 항상 켜짐]
│   │   ├── 📢 광고 차단 [🔒 항상 켜짐]
│   │   ├── 🇰🇷 한국 광고 필터 [토글]
│   │   ├── 🔒 개인정보 보호 [토글]
│   │   ├── 🛡️ 안티서클 [토글]
│   │   └── 🧹 성가신 요소 [토글]
│   ├── [최신 필터 업데이트] 버튼 (1개)
│   └── 안내: 정적 필터 27만 개(272,248개)는 재배포 시 갱신, 이 버튼은 정적 필터에 없는 신규 도메인만 동적 등록(최대 30,000개 한도)
│
├── [내 차단 목록] 탭 내용
│   ├── 사이트별 차단 요소 목록 (chrome.storage.local의 blockedSelectors)
│   │   ├── 사이트명 + 차단 수
│   │   ├── 선택자 목록 (각 항목에 [편집] [삭제] 버튼)
│   │   ├── [선택자 추가] (입력 필드 + 추가 버튼)
│   │   └── [사이트 전체 해제] 버튼
│   └── [전체 차단 목록 초기화] 버튼 (confirm 후 전체 삭제)
│
└── [출처 및 라이선스] 탭 내용
    ├── 필터 그룹별 출처/라이선스 표 (그룹명 / 출처 / 라이선스)
    └── 프로젝트 라이선스 안내 (CC BY-NC-SA 4.0)
```

> **정확한 표현 정정**: 기존 문서의 "필터 전체 업데이트"라는 표현은 틀렸다.
> 실제로 갱신되는 것은 **정적 필터에 없는 신규 도메인(동적 규칙, 최대 30,000개)**뿐이며, **정적 필터 27만 개(272,248개)는 런타임에 갱신할 수 없다**
> (Chrome이 확장 패키지 파일을 읽기 전용으로 취급하고, 브라우저 JS에는 로컬 파일 쓰기 API가 없음).
> 따라서 버튼 문구를 **"최신 필터 업데이트"**로 변경했다.

### 3.2 통계 패널 (상단 고정)

| 요소 | 설명 |
|------|------|
| 위치 | **모든 탭에서 항상 상단에 표시** (탭 내용과 분리, 흰색 배경 박스 없음) |
| 총 차단 | 크게 1줄 전체 (`stat-total`, 34px) |
| 네트워크 / DOM 제거 | 2열 그리드로 한 행에 배치 |
| 통계 재설정 버튼 | **우측 정렬**, 마지막 재설정 날짜 **바로 위**에 세로로 배치 |

### 3.3 탭 바 UI

| 요소 | 설명 |
|------|------|
| 위치 | **통계 재설정 하단** |
| 탭 버튼 | 3개: "필터 목록", "내 차단 목록", "출처 및 라이선스" |
| 활성 탭 표시 | 활성 탭은 빨간색 텍스트 + 하단 밑줄 |
| 탭 전환 | 클릭 시 해당 탭 내용 표시, 나머지 숨김 |
| 반응형 | 좁은 화면에서도 탭 바가 가로 스크롤 없이 표시 |

### 3.4 [필터 목록] 탭 상세

#### 필터 카드 UI (2열 그리드)

- 6개 필터 카드를 **2열 그리드**로 배치해 한 화면에 모두 표시
- 좁은 화면(540px 이하)에서는 1열로 자동 전환

| 요소 | 설명 |
|------|------|
| 아이콘 + 그룹명 | 예: 📢 광고 차단 |
| 개수 배지 | 제목 우측에 **"규칙 N개"** 표시 (보안 137,434 / 광고 127,583 / 한국 2,286 / 개인정보 1,459 / 안티서클 1,041 / 성가신 2,445 — 합계 272,248개). 라이선스는 이 탭에서 표시하지 않고 '출처 및 라이선스' 탭에만 표시 |
| 토글 스위치 | 광고 차단/보안은 비활성화(잠금), 나머지는 활성화 |

#### 최신 도메인 업데이트 버튼 (1개)

- 버튼 문구: **"최신 필터 업데이트"**
- 클릭 시 **6개 그룹 전체**의 필터를 순차적으로 다운로드 → 변환 → 교체한다.
- **갱신 범위**: 동적 규칙(최대 30,000개 한도, 중복 제외 신규만 등록). 정적 필터 27만 개(272,248개)는 패키지에 고정되어 재배포 시에만 갱신.
- 업데이트 중에는 버튼이 비활성화되고 상태 메시지 표시.
- 완료 시 "✅ N개 업데이트 완료" 메시지 표시.
- **업데이트 이력**: 성공 시 날짜·신규 규칙 수·제외된 중복 수를 `chrome.storage.local.updateHistory`에 저장(최근 20개). 버튼 옆 "업데이트 내역 보기 ▼"를 누르면 접기/펼치기로 이력 목록 표시.
- 필터 내용이 이전과 동일하면 규칙을 다시 등록하지 않고 **"신규 업데이트가 없습니다"** 메시지를 표시 (지문 비교).
- **2단계 교체 적용**: 이전 규칙 제거 → 새 규칙 추가를 별도 호출로 처리 (한도 여유 확보)
- **중복 제거**: 정적 필터 인덱스(`filters/static-index.json`, 268,213개 urlFilter)와 비교해 **이미 내장된 도메인은 동적 등록에서 제외**. 신규 도메인만 등록하므로 한도 여유가 크고, 인위적 상한도 제거됨
- **정적 인덱스**: `filters/static-index.json` (정적 규칙 27만 개의 urlFilter 목록, 268,213개)을 `web_accessible_resources`로 노출해 런타임에서 중복 제거에 사용

#### 잠금 UI (광고 차단 / 보안)

- 토글이 비활성화되고 **녹색 배경의 "🔒 항상 켜짐" 배지**가 표시되어 눈에 잘 띈다.
- **전체 일시중지 연동**: 팝업에서 "광고 차단"을 OFF하면 `adBlockerEnabled=false`가 저장되고, 설정 페이지의 모든 필터 토글이 꺼지고 비활성화된다. `chrome.storage.onChanged`로 실시간 반영.

#### 전체 비활성화 버튼

- "전체 비활성화" 버튼 클릭 시 **광고 차단/보안을 제외한 4개 그룹만** 비활성화된다.
- 광고 차단/보안은 항상 활성 상태로 유지된다.

### 3.5 [내 차단 목록] 탭 상세

#### 데이터 소스

- `chrome.storage.local`의 `blockedSelectors` 키
- 구조: `{ "example.com": [".ad-banner", "#ad-slot", ...], ... }`
- 사이트별 최대 200개 (`MAX_PER_SITE` in `element-blocker.js`)

#### UI 구성

| 요소 | 설명 |
|------|------|
| 사이트 카드 | 각 사이트별로 카드 표시 (사이트명 + 차단 수) |
| 선택자 목록 | CSS 선택자 문자열 + [편집] + [삭제] 버튼 |
| 편집 모드 | 클릭 시 입력 필드로 변경, [저장] [취소] 버튼 표시 |
| 선택자 추가 | 입력 필드 + [추가] 버튼 |
| 사이트 전체 해제 | [사이트 전체 해제] 버튼 (confirm 후 해당 사이트만 삭제) |
| 전체 초기화 | [전체 차단 목록 초기화] 버튼 (confirm 후 전체 삭제) |
| 빈 상태 | 차단한 요소가 없을 경우 안내 메시지 |

#### 편집 동작

- 선택자 편집: 인라인 입력 필드로 수정
- 수정 시 CSS 유효성 검사 (`document.querySelector`로 테스트)
- 저장 시 `chrome.storage.local` 업데이트 → `element-blocker.js`에 즉시 반영

### 3.6 [출처 및 라이선스] 탭 상세

#### 출처 및 라이선스 표 (개별 필터 소스별)

그룹 단위가 아니라 **개별 필터 소스마다** 항목을 나누어 필터명·그룹·라이선스·출처 주소(클릭 가능한 링크)를 표시한다.
표 데이터는 `options/config.js`의 `LICENSE_TABLE`에 정의되어 있다.

| 필터 | 그룹 | 라이선스 | 출처 주소 |
|------|------|----------|-----------|
| NoCoin | 보안 | MIT | github.com/hoshsadiq/adblock-nocoin-list |
| URLhaus | 보안 | MIT / CC0 1.0 | gitlab.com/curben/urlhaus-filter |
| EasyList | 광고 차단 | CC BY-SA 3.0 | easylist.to |
| EasyPrivacy | 광고 차단 | CC BY-SA 3.0 | easylist.to/easylist/easyprivacy.txt |
| AdGuard Base (Ultimate Ad Filter) | 광고 차단 | GNU GPLv3 / CC BY 3.0 | github.com/AdguardTeam/AdguardFilters |
| NoriDev-AdBlock-Filter | 한국 광고 | CC BY-NC-SA 4.0 | github.com/noridev/NoriDev-AdBlock-Filter |
| Turtlecute Host List | 한국 광고 | CC BY-NC-SA 4.0 | adblock.turtlecute.org/d3host.adblock |
| d3Host | 한국 광고 | CC BY-NC-SA 4.0 | github.com/d3ward/toolz |
| List-KR | 한국 광고 | GNU GPLv3 | github.com/List-KR/List-KR |
| Fanboy's Social Blocking | 개인정보 보호 | CC BY 3.0 | fanboy.co.nz |
| AdGuard URL Tracking | 개인정보 보호 | GNU GPLv3 | github.com/AdguardTeam/AdguardFilters |
| abp-filters-anti-cv | 안티서클 | GNU GPLv3 | github.com/abp-filters/abp-filters-anti-cv |
| Fanboy's Annoyance | 성가신 요소 | CC BY 3.0 | fanboy.co.nz |

#### 프로젝트 라이선스 안내

- CC BY-NC-SA 4.0 (저작자 표시 + 비상업적 용도 + 동일 라이선스)

### 3.7 반응형 가로폭

- 라이트 테마 적용 (배경 `#f4f6fb`, 글씨 `#1e293b`, 카드 `#ffffff`) — 가독성 개선
- 가로폭: `width: min(720px, 100vw - 24px)` — 브라우저 크기에 따라 자동 조절
- 필터 카드: 2열 그리드, 540px 이하에서 1열로 전환
- 좁은 화면(모바일, 반쪽 창)에서도 가로 스크롤 없이 표시

### 3.7 업데이트 중단 / 브라우저 종료 시 동작 (원자적 교체)

#### 채택한 방식: 원자적 교체 (Atomic Replace)

`chrome.declarativeNetRequest.updateDynamicRules()`의 `removeRuleIds` + `addRules`를 **한 번의 호출**로 처리한다.
이 API는 원자적(atomic)이어서 제거와 추가가 동시에 적용되므로, 중간 상태가 외부에 노출되지 않는다.

```javascript
// 이전 규칙 개수만큼 제거 + 새 규칙 추가를 한 번에
await dnrUpdate({ removeRuleIds: oldIds, addRules: committed });
```

> **중요 정정 (2026-11-20)**: 초기 기획에서는 "스테이징 방식"(임시 ID 대역에 먼저 추가 후 교체)을 채택했으나,
> 실제 브라우저에서 **`Dynamic rule count exceeded.`** 에러가 발생했다.
> 원인은 기존 확정 규칙(예: 29,608개)이 남아있는 상태에서 같은 양을 스테이징으로 추가하면
> **일시적으로 59,216개가 되어 Chrome 전체 동적 규칙 한도(30,000개)를 초과**하기 때문이다.
> 따라서 스테이징을 제거하고, **기존 규칙 제거 후 새 규칙을 별도 호출로 추가**하는 2단계 방식으로 변경했다. 현재는 정적 필터와 중복된 도메인을 제외하므로 인위적 상한 없이 실제 신규 도메인만 등록한다.

#### 시나리오별 동작

| 시나리오 | 결과 | 심각도 |
|----------|------|--------|
| 브라우저 종료 (교체 도중) | `updateDynamicRules`가 원자적이라 **이전 규칙 세트 그대로 유지** (부분 적용 없음) | ✅ 안전 |
| 특정 그룹 다운로드 실패 | 해당 그룹은 build-time 정적 규칙으로 계속 차단, 나머지는 신규 규칙 | ✅ 정상 |
| 배분 초과 그룹 | 배분 상한까지만 동적 등록, 나머지는 정적 유지 | ✅ 의도된 동작 |
| 업데이트 중 네트워크 단절 | 타임아웃(10초) 후 실패 처리, **이전 규칙 보존** | ✅ 정상 |
| 규칙 등록 한도 초과 시 | `catch`에서 새로 추가된 규칙 롤백 → 이전 규칙 복구 | ✅ 정상 |

#### 왜 안전한가

1. **원자성**: `updateDynamicRules` 한 번에 제거+추가 → 중간 상태 없음
2. **누적 방지**: 이전 규칙 개수(`dynamicRuleCount`)만큼만 제거 → 항상 최신 1세트
3. **롤백**: 실패 시 COMMIT ID 대역 전체를 제거 → 이전 확정 규칙은 손실되지 않음

#### 사용자 안내 문구

> - 업데이트는 **사용자가 버튼을 누를 때만** 1회 실행되며, 자동 폴링하지 않습니다.
> - 업데이트가 실패하면 이전 필터 규칙이 그대로 유지됩니다.
> - 규칙이 쌓이지 않아 몇 번을 업데이트해도 30,000개 한도를 넘지 않습니다.


---

## 4. 필터 소스 URL (확정)

각 필터 그룹은 아래 URL에서 최신 필터를 다운로드한다. **모든 URL은 HTTPS만 사용한다.**

> 아래 URL은 2026-11-20 기준으로 모두 **HTTP 200 응답 확인**했습니다.
> 각 항목의 "실제 제목"은 필터 파일 상단 `! Title:` 헤더 값입니다.

### 4.1 광고 차단 (동적 업데이트 (그룹 배분 적용), UI 토글 불가)

| 소스 | 실제 제목 | 정확한 URL | 검증 | 라이선스 |
|------|-----------|------------|------|----------|
| EasyList | EasyList | `https://easylist.to/easylist/easylist.txt` | HTTP 200 (약 2.07MB) | CC BY-SA 3.0 |
| EasyPrivacy | EasyPrivacy | `https://easylist.to/easylist/easyprivacy.txt` | HTTP 200 (약 1.52MB) | CC BY-SA 3.0 |
| AdGuard Base (Ultimate Ad Filter) | AdGuard Base filter | `https://filters.adtidy.org/extension/chromium/filters/2.txt` | HTTP 200 (약 7.09MB) | GNU GPLv3 / CC BY 3.0 |

### 4.2 한국 광고 필터 (전체 동적 업데이트, UI 토글 가능)

| 소스 | 실제 제목 | 정확한 URL | 검증 | 라이선스 |
|------|-----------|------------|------|----------|
| NoriDev | NoriDev AdBlock Filter | `https://raw.githubusercontent.com/noridev/NoriDev-AdBlock-Filter/master/filter/filter.txt` | HTTP 200 (83KB) | CC BY-NC-SA 4.0 |
| Turtlecute | Turtlecute Host List | `https://adblock.turtlecute.org/d3host.adblock` | HTTP 200 (4.5KB) | CC BY-NC-SA 4.0 |
| d3Host | (헤더 없음) | `https://raw.githubusercontent.com/d3ward/toolz/master/src/d3host.txt` | HTTP 200 (5KB) | CC BY-NC-SA 4.0 |
| **List-KR (AdGuard)** | List-KR filters list (AdGuard) | `https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-AdGuard.txt` | HTTP 200 (253KB) | GNU GPLv3 |
| 자체 extra-hosts | (로컬 헤더 없음) | `file:tools/tmp/extra-hosts.txt` (로컬 파일, 업데이트 시 제외) | 로컬 | - |

### 4.3 개인정보 보호 (전체 동적 업데이트, UI 토글 가능)

| 소스 | 실제 제목 | 정확한 URL | 검증 | 라이선스 |
|------|-----------|------------|------|----------|
| Fanboy's Social | Fanboy's Social Blocking List | `https://www.fanboy.co.nz/fanboy-social.txt` | HTTP 200 (408KB) | CC BY 3.0 |
| AdGuard URL Tracking | AdGuard URL Tracking filter | `https://filters.adtidy.org/extension/chromium/filters/17.txt` | HTTP 200 (186KB) | GNU GPLv3 |

> **정정 사항 (2026-11-20)**: 초안에서는 URL Tracking 소스를 `filters/10.txt`로 표기했으나, 실제로 이 파일은 **"Filter unblocking search ads and self-promotion"**(검색 광고 차단 해제) 필터였습니다. 실제 URL Tracking filter는 **`filters/17.txt`** 이며, AdGuard 공식 목록(https://filters.adtidy.org/extension/chromium/filters.json)에서 ID 17로 확인했습니다.
>
> **변환 주의**: `17.txt`는 주로 `$removeparam` 규칙(URI 파라미터 제거)으로 구성되어 **DNR로 변환 불가**합니다. 변환 가능한 규칙은 block 48개 + allow 109개 = **157개**뿐이며, 나머지는 빌드 시 제외됩니다. (참고: DNR은 `$removeparam`을 지원하지 않음)

### 4.4 안티서클 (전체 동적 업데이트, UI 토글 가능)

| 소스 | 실제 제목 | 정확한 URL | 검증 | 라이선스 |
|------|-----------|------------|------|----------|
| anti-cv (영문) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/english.txt` | HTTP 200 (104KB) | GNU GPLv3 |
| anti-cv (중문) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/chinese.txt` | HTTP 200 (1.4KB) | GNU GPLv3 |
| anti-cv (체코어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/czech.txt` | HTTP 200 (35KB) | GNU GPLv3 |
| anti-cv (프랑스어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/french.txt` | HTTP 200 (14KB) | GNU GPLv3 |
| anti-cv (독일어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/german.txt` | HTTP 200 (529B) | GNU GPLv3 |
| anti-cv (폴란드어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/polish.txt` | HTTP 200 (7.5KB) | GNU GPLv3 |
| anti-cv (포르투갈어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/portuguese.txt` | HTTP 200 (1.2KB) | GNU GPLv3 |
| anti-cv (러시아어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/russian.txt` | HTTP 200 (14KB) | GNU GPLv3 |
| anti-cv (스페인어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/spanish.txt` | HTTP 200 (4.7KB) | GNU GPLv3 |
| anti-cv (터키어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/turkish.txt` | HTTP 200 (370B) | GNU GPLv3 |
| anti-cv (베트남어) | (헤더 없음) | `https://raw.githubusercontent.com/abp-filters/abp-filters-anti-cv/master/vietnamese.txt` | HTTP 200 (3.7KB) | GNU GPLv3 |

> 위 언어 파일들은 **모두 같은 저장소**(abp-filters/abp-filters-anti-cv)에 있으며, 브랜치는 `master`입니다. 파일명만 언어별로 다릅니다.

### 4.5 성가신 요소 (전체 동적 업데이트, UI 토글 가능)

| 소스 | 실제 제목 | 정확한 URL | 검증 | 라이선스 |
|------|-----------|------------|------|----------|
| Fanboy's Annoyance | Fanboy's Annoyance List | `https://www.fanboy.co.nz/fanboy-annoyance.txt` | HTTP 200 (2.19MB) | CC BY 3.0 |

### 4.6 보안 (동적 업데이트 (그룹 배분 적용), UI 토글 불가)

| 소스 | 실제 제목 | 정확한 URL | 검증 | 라이선스 |
|------|-----------|------------|------|----------|
| NoCoin | NoCoin Filter List | `https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt` | HTTP 200 (16KB) | MIT |
| URLhaus | Malicious URL Blocklist | `https://gitlab.com/curben/urlhaus-filter/-/raw/master/urlhaus-filter.txt` | HTTP 200 (2.33MB) | MIT / CC0 1.0 |

---

## 5. 동작 흐름 (확정)

```
[사용자] 설정 페이지에서 "최신 필터 업데이트" 버튼 클릭
      ↓
[options.js] chrome.runtime.sendMessage({ type: "updateFilters" })
      ↓
[background.js] 6개 그룹 소스 URL에서 필터 순차 다운로드 (HTTPS, AbortController 10초 타임아웃)
      ↓
[background.js] 내용 파싱 → DNR 규칙으로 변환 (build-filters.js와 동일한 로직)
      ↓
[background.js] 그룹별 배분(19,000/6,000/전체) 적용, 전체 합계 29,713개로 한도 준수
      ↓
[background.js] updateDynamicRules()로 "교체" (기존 1000번대 ID 제거 후 새 규칙 추가)
      ↓
[options.js] 결과를 화면에 "✅ N개 업데이트 완료" 로 표시
```

### 교체 방식인 이유

- "추가"만 하면 규칙이 계속 쌓여 한도에 도달한다.
- **기존 추가 규칙을 먼저 제거(`removeRuleIds`)하고 전체 목록으로 다시 채움**으로써 항상 파일에 있는 개수만 유지한다.
- 이렇게 하면 30,000개 한도 이하에서 재배포 없이 계속 갱신 가능하다.

### 30,000개 초과 시 처리

- **광고 차단(123,075개)**: 변환된 규칙 중 **상위 19,000개**만 동적 규칙으로 등록. 나머지는 정적 규칙으로 유지.
- **보안(134,458개)**: 변환된 규칙 중 **상위 6,000개**만 동적 규칙으로 등록. 나머지는 정적 규칙으로 유지.
- **나머지 4개 그룹**: 전체 등록 (합계 1,856 + 270 + 142 + 2,445 = 4,713개).
- **전체 합계**: 19,000 + 6,000 + 4,713 = **29,713개** ≤ 30,000 (Chrome 전체 동적 한도).

---

## 6. 표시할 숫자

- 화면에 표시: **정적 규칙 수 + 동적 업데이트된 규칙 수 = 총합**
- "도메인"보다 정확히는 **"차단 규칙"**이라고 표기한다 (URL 패턴 규칙이 일부 포함).
- 새 규칙 수는 **변환된 유효 규칙 수**를 센다 (주석 `#` / 빈 줄 / DNR 미지원 형식 제외).

---

## 7. 규칙 개수 한도 (공식 문서 확인)

Chrome 공식 `declarativeNetRequest` 문서에서 확인한 사실:

| 규칙 종류 | 한도 | 비고 |
|---|---|---|
| 정적 규칙 (패키지 내장) | 최소 30,000개 보장 + 전역 공유 풀 | 현재 263,432개 사용 중. 업데이트 기능과 **별개 바구니** |
| 동적 규칙 - 안전(safe: block/allow/allowAllRequests/upgradeScheme) | **30,000개** (Chrome 121+) | 새 도메인 차단 규칙은 `block`이므로 여기에 해당 |
| 동적 규칙 - 안전하지 않음(redirect 등) | 5,000개 | 30,000개 한도에 합산됨 |
| Chrome 120 이하 / Firefox | 5,000개 | Chrome/Edge 최신는 30,000개 |
| 정규식 규칙 | 1,000개 | 이번 기능은 사용하지 않음 |

- **실무 적용**: 전체 동적 한도 30,000개를 그룹별로 배분(광고 19,000 / 보안 6,000 / 나머지 전체)하여 등록.
- 근거: https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/ (Rule limits)

> 기존 263,432개(정적)와 새로 추가되는 규칙(동적 최대 30,000개)은 **서로 다른 규칙셋**에 들어가므로 합산되어 한도에 걸리지 않는다.

---

## 8. 보안 요구사항 (공식 문서 기반 + 현재 코드 반영)

아래는 **Chrome 공식 확장 보안 문서에서 확인한 사실**과 그에 따른 설계이다. 추측으로 만든 위협은 넣지 않았다.

### 8.1 원격 코드 실행 금지 (MV3) — 가장 중요

- **사실**: Manifest V3에서는 원격으로 받은 **코드(JS/WASM)**를 실행할 수 없다. 반면 **데이터(JSON/텍스트)**는 런타임에 받아올 수 있다.
  - 근거: https://developer.chrome.com/docs/extensions/develop/migrate/improve-security ("Remove remotely hosted code", "Configuration-driven features")
  - 근거: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements ("full functionality discernible from submitted code", external resources "must not contain any logic")
- **적용**: CDN에서 받는 필터 파일은 **오직 도메인 문자열 데이터**만 담는다. JS·eval·`new Function()`·스크립트 태그를 절대 실행하지 않는다.
- **금지**: 받은 내용을 `eval()`, `new Function()`, `scripting.executeScript()`로 실행하는 코드는 작성하지 않는다.

### 8.2 HTTPS 전용

- **사실**: Chrome 공식 문서는 원격 데이터 통신에 **HTTPS만 사용**하라고 권고한다 (중간자 공격/MITM 방지).
  - 근거: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts ("Only communicate over HTTPS")
- **적용**: 필터 URL은 모두 `https://`로 고정한다. `http://`는 허용하지 않는다.

### 8.3 XSS 방지 — `innerHTML` 금지

- **사실**: 원격에서 받은 데이터를 `innerHTML`로 넣으면 XSS 위험이 있다. `textContent` 또는 `JSON.parse`를 쓰라고 공식 문서가 명시한다.
  - 근거: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests ("Avoid cross-site scripting vulnerabilities")
- **적용 (신규 코드)**: 받은 도메인 문자열을 화면에 표시할 때 **`textContent`만** 사용한다. `innerHTML`로 붙이지 않는다.

### 8.4 host_permissions 최소화

- **사실**: 확장 서비스 워커에서 cross-origin `fetch()`를 하려면 대상 host를 `host_permissions`에 선언해야 한다.
  - 근거: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests ("Request cross-origin permissions")
- **적용**: 아래 호스트만 추가한다:
  - `https://easylist.to/`
  - `https://filters.adtidy.org/`
  - `https://raw.githubusercontent.com/`
  - `https://adblock.turtlecute.org/`
  - `https://www.fanboy.co.nz/`
  - `https://gitlab.com/`
  - `https://cdn.jsdelivr.net/` (List-KR용)
- **보안 오해 정리**: 이 권한은 "공개 파일을 읽는다"는 뜻이며 **GitHub 계정/저장소를 조종하는 토큰이 아니다.**

### 8.5 입력 검증 (우회·주입 방지)

- CDN 파일은 공개되어 누구나 수정 제안(PR)을 할 수 있으므로, **받은 내용을 그대로 규칙으로 신뢰하지 않는다.**
- 각 줄에 대해 아래를 검사한다:
  - `urlFilter`는 ASCII 문자열이어야 함 (`/^[\x20-\x7e]+$/`)
  - 길이 1~2000자
  - `||*` 사용 금지 (Chrome이 로드 거부)
  - 도메인은 `^[a-z0-9.-]+$` 형태만 허용
- **정규식 규칙(`regexFilter`)은 사용하지 않는다** → 정규식 관련 위험 요소 없음.
- 검증 실패한 줄은 **조용히 버리고** 성공한 줄만 적용한다.

### 8.6 디도스(DDoS)·남용 방지

- **사실**: 이 기능은 **사용자가 버튼을 누를 때만** 1회 `fetch()`를 한다. 자동 폴링(setInterval)으로 원격을 반복 호출하지 않는다.
- **설계 제약**:
  - 버튼 클릭마다 호출되므로, 짧은 시간에 여러 번 누르는 것을 막기 위해 **마지막 호출 시각을 기록하고 10초 내 재호출은 무시**하는 디바운스를 둔다.
  - 파일 크기 상한을 둔다 (10MB). 실제 필터 크기(EasyList 약 2MB, AdGuard Base 약 7MB, URLhaus 약 2.3MB)를 고려해 설정.
  - `fetch`에 타임아웃(AbortController 10초)을 걸어 무한 대기를 막는다.

### 8.7 기존 코드와의 충돌 방지

- `background.js`의 동적 규칙은 이미 id 1~68, 100~109를 사용한다 (`ALL_RULE_IDS`).
- 새 규칙 ID는 **1000번대** 별도 대역을 사용해 충돌을 피한다.
- 교체 시 `removeRuleIds`에는 **새 대역 ID만** 넣는다. 기존 1~68/100~109는 건드리지 않는다.
- 기존 `applyRules()`가 ON/OFF 토글 때 `removeRuleIds: ALL_RULE_IDS`로 전체를 지우므로, **새 필터 규칙이 토글에 의해 사라지지 않도록** `ALL_RULE_IDS`에 1000번대를 포함하거나, 별도로 재적용한다.

---

## 9. List-KR 필터 추가 계획

### 9.1 추가 소스

- **필터**: `https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-AdGuard.txt`
- **라이선스**: GNU GPLv3
- **변환 가능 규칙 수**: 약 1,429개 (테스트 확인)
- **추가 위치**: `tools/build-filters.js`의 `KOREAN_LISTS`에 추가

### 9.2 build-filters.js 변경

```javascript
const KOREAN_LISTS = [
  ["noridev", "https://raw.githubusercontent.com/noridev/NoriDev-AdBlock-Filter/master/filter/filter.txt"],
  ["turtlecute", "https://adblock.turtlecute.org/d3host.adblock"],
  ["d3host", "https://raw.githubusercontent.com/d3ward/toolz/master/src/d3host.txt"],
  ["list-kr", "https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-AdGuard.txt"],  // 추가
  ["extra-hosts", "file:tools/tmp/extra-hosts.txt"],
];
```

### 9.3 재빌드 명령

```bash
node tools/build-filters.js --group=korean
```

---

## 10. 구현 시 변경 파일 목록 (계획)

| 파일 | 변경 내용 |
|---|---|
| `manifest.json` | `host_permissions`에 7개 CDN/raw URL 추가 |
| `background.js` | `updateFilters` 핸들러: fetch → 파싱 → 검증 → `updateDynamicRules()` 교체, 디바운스/타임아웃/용량 제한. 광고 차단/보안 그룹은 항상 활성 유지 |
| `options.html` | 탭 바 UI + 반응형 가로폭. 3개 탭(필터 목록, 내 차단 목록, 출처 및 라이선스). 그룹별 펼치기 UI, 광고 차단/보안 카드에 잠금 UI |
| `options.js` | 탭 전환 로직, 필터 토글/펼치기, 전체 업데이트 버튼, 내 차단 목록 표시/편집/추가/삭제, 출처 및 라이선스 표시. 광고 차단/보안 토글 비활성화 |
| `tools/build-filters.js` | `KOREAN_LISTS`에 List-KR 소스 추가 |

변경 파일 수는 5개(프로젝트 내부). **백업 커밋 기준(10개 이상 등)** 에는 해당하지 않음.

---

## 11. 검증 계획 (구현 후)

1. `node tools/build-filters.js --group=korean` — List-KR 포함 재빌드 확인
2. `node tools/validate-rules.js` — 기존 정적 규칙 검증 통과 확인
3. 설정 페이지에서 탭 전환 동작 확인
4. 그룹별 펼치기 동작 확인
5. 광고 차단/보안 그룹 토글이 비활성화되어 있는지 확인
6. "전체 비활성화" 버튼 클릭 시 광고 차단/보안을 제외한 4개 그룹만 비활성화되는지 확인
7. "최신 필터 업데이트" 버튼 클릭 → "업데이트 완료" 표시 확인
8. 새 규칙이 실제로 차단되는지 확인 (차단 로그/뱃지)
9. 토글 ON/OFF 후에도 새 필터 규칙이 유지되는지 확인
10. URL을 `http://`로 바꿨을 때 거부되는지, 10MB 초과 파일이 거부되는지 확인
11. 짧은 시간에 버튼 여러 번 클릭 시 디바운스가 동작하는지 확인
12. 그룹별 배분(광고 19,000 / 보안 6,000 / 나머지 전체)이 적용되어 전체 29,713개로 한도 내인지 확인
13. **내 차단 목록 탭**: 사이트별 차단 요소 표시, 선택자 편집/추가/삭제, 사이트 전체 해제, 전체 초기화 동작 확인
14. **출처 및 라이선스 탭**: 필터 그룹별 출처/라이선스 표시 확인
15. **반응형 가로폭**: 브라우저 크기를 줄여도 가로 스크롤 없이 표시되는지 확인

---

## 12. 사용자에게 설명할 한계 (기획 확정 내용)

- 새 도메인 추가/삭제 → **CDN 파일 수정 + 버튼**으로 해결, 재배포 불필요
- 광고 차단/보안 그룹 → **그룹 배분(19,000 / 6,000)까지만** 동적 업데이트, 나머지는 정적 유지
- 광고 차단/보안 그룹 → **UI에서 비활성화 불가** (항상 ON)
- List-KR 필터 → **한국 광고 필터 그룹에 포함**되어 함께 업데이트
- 설정 페이지 → **탭 형식**으로 3개 탭(필터 목록, 내 차단 목록, 출처 및 라이선스)
- 설정 페이지 → **반응형 가로폭**으로 브라우저 크기에 따라 조절
- 내 차단 목록 → 우클릭으로 추가한 요소를 **직접 편집/추가/삭제 가능**
- 화면에 그려지는 배너·팝업 광고 → 필터만으로 안 됨, `content.js`/`general-blocker.js` 등 코드 수정 필요
- 유튜브 광고·감지 우회 → 필터와 무관, 별도 코드(`youtube-main.js`, `content.js`) 담당
- 최초 CDN 권한 추가·업데이트 UI 추가 → **1회 재배포 필요**
- 필터 소스 URL 변경 → 코드에 적혀 있으므로 재배포 필요

---

## 13. 참고 문서 (모두 접속 확인)

- https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/ — 규칙 한도(30,000/5,000)
- https://developer.chrome.com/docs/extensions/develop/migrate/improve-security — 원격 코드 금지, CSP
- https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements — 외부 리소스는 로직을 포함하지 않아야 함
- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests — fetch, host_permissions, XSS 주의
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts — HTTPS 통신, eval 금지
- https://github.com/List-KR/List-KR — List-KR 필터 저장소 (GNU GPLv3)

---

## 14. README 참고자료 사용 현황 (2026-11-20 점검)

README "참고 자료"에 나열된 항목 중 **실제 필터 소스로 사용하는 것**과 **참고만 한 것**을 정리한다.

### 14.1 실제 사용 중 (출처 표에 포함)

| 참고자료 | 용도 | 출처 표 항목 |
|----------|------|-------------|
| uBlock Origin / uBOL-home | 유튜브 응답 후킹 기법 참고 → `youtube-main.js` 구현에 반영. **2026-11-20 Peter Lowe's + uAssets도 실제 필터로 추가** (아래 14.4 참조) | ✅ 기법 참고 + 필터 추가 |
| NoriDev-AdBlock-Filter | 한국 광고 필터 소스 | ✅ NoriDev-AdBlock-Filter |
| List-KR | 한국 광고 필터 소스 | ✅ List-KR |
| filterslists-ko | 한국 광고 필터 소스 (2026-11-20 추가, List-KR 포크 분기) | ✅ filterslists-KO (Unified) |
| Turtlecute Host List | 한국 광고 필터 소스 | ✅ Turtlecute Host List |
| d3ward d3Host | 한국 광고 필터 소스 | ✅ d3Host |
| raymondhill.net/ublock 테스트 | 네트워크/코스메틱 차단 검증 (테스트 사이트) | 테스트 검증용 |

### 14.2 참고만 하고 미사용 (출처 표에 없음)

| 참고자료 | 미사용 사유 |
|----------|------------|
| **uBlock (gorhill/uBlock)** | **정정 및 조치 완료**: 이전 '기법 연구용' 표현은 부정확. uBO 기본 5개 필터 중 3개는 기존 포함, Peter Lowe's / uAssets는 검토 누락이었으나 **2026-11-20 실제 필터로 추가함** |
| **AdAway** | 호스트 기반 차단 참고. 실제 필터 미포함 (DNR 변환 대상이 아님) |
| **hagezi/dns-blocklists** | 규모가 너무 커 미포함 (README에도 명시) |
| **tryblock.org / d3ward.com / paileactivist/toolz / canyoublockit.com / obfusgated.com / ipcheck.ing / superadblocktest.com** | 차단 동작 검증용 테스트 사이트. 필터 소스가 아니라 검증 대상 |
| **raymondhill.net/ublock (테스트 사이트 항목)** | 14.1과 동일 사이트. 네트워크/코스메틱 검증용으로 분류 |

### 14.3 이번 점검에서 조치한 사항

1. **filterslists-ko 추가** — List-KR 포크 분기 저장소, GNU GPLv3, Unified(AdGuard) URL 사용.
   변환 가능 1,823개 중 정적 중복 제거 후 430개가 한국 필터에 반영됨 (한국 필터 1,856 → 2,286개).
2. **자체 extra-hosts 출처 항목 제거** — 사용자 저장소에는 필터가 없으므로 출처 표에서 삭제 (정적 빌드 소스로는 유지).
3. **URL Tracking 소스 불일치 수정** — `build-filters.js`의 `filters/10.txt`(검색광고 차단해제) → `filters/17.txt`(AdGuard URL Tracking)로 변경.
4. **uBO 필터 누락 재검증 (2026-11-20)** — 이전 문서의 "uBO는 기법 참고용" 설명은 부정확하여 정정. 실제 uBO 기본 필터 5개 중 3개(EasyList/EasyPrivacy/URLhaus)는 이미 포함, 나머지 Peter Lowe's와 uAssets는 ** 검토 누락**이었음. 데이터 검증 결과 아래와 같이 상당수가 **중복이 아닌 신규 도메인**임을 확인:
   - Peter Lowe's: 변환 3,568개 중 정적 중복 1,656개 / **신규 1,912개**
   - uAssets `badware.txt`: 변환 2,967개 중 중복 15개 / **신규 2,945개**
   - uAssets `privacy.txt`: 변환 841개 중 중복 37개 / **신규 804개**
   - uAssets `filters.txt`: 변환 872개 중 중복 229개 / **신규 634개**
   - uAssets는 단일 필터가 아니라 **22개 파일** (filters.txt, filters-2020~2026, privacy.txt, badware.txt, annoyances계열, resource-abuse, ubo-link-shorteners, unbreak 등). 이전에 "필터 2개"라고 표현한 것도 부정확.
   - **결론**: 중복이 아닌 신규 도메인이 수천 개 있으므로, 추가 여부는 별도 결정 필요 (현재는 미추가 상태).

### 14.4 uBO 필터 추가 및 eyeo anti-cv 검토 (2026-11-20 조치 완료)

**추가한 필터**
- **Peter Lowe's Blocklist** (pgl.yoyo.org, 광고 차단 그룹): 변환 3,568개 중 정적 중복 1,656개 제거 → **신규 1,912개**
- **uAssets filters 계열** (uBlockOrigin/uAssets, GPLv3):
  - `filters.txt` 신규 634개, `filters-general.txt` 신규 305개, `filters-2024~2026` 신규 182+201+240개 → **광고 차단 그룹**
  - `privacy.txt` 신규 804개 → **개인정보 보호 그룹**
  - `badware.txt` 신규 2,945개, `resource-abuse.txt` 신규 14개 → **보안 그룹**
- **eyeo anti-cv로 소스 교체** (gitlab.com/eyeo/anti-cv/abp-filters-anti-cv): 기존 GitHub abp-filters-anti-cv 11개 언어는 정적 필터에 이미 포함되어 신규 0개였으나, **eyeo 버 english.txt에서 신규 488개**를 확인 → 11개 언어 전체를 eyeo raw URL로 교체 (안티서클 142 → 1,041개)

**중복/누락 검증 결과 (데이터 기반)**
| 소스 | 변환 | 정적 중복 | 신규 |
|------|------|-----------|------|
| GitHub anti-cv 11개 언어 | 해당 | 전부 포함 | **0** |
| eyeo anti-cv 11개 언어 | 해당 | 일부 | **504** (영문 488 포함) |
| eyeo 전용 추가 언어 15개 | 매우 적음 (cosmetic 위주) | 0 | **2** |
| Peter Lowe's | 3,568 | 1,656 | **1,912** |
| uAssets badware | 2,967 | 15 | **2,945** |

→ **"중복이라서 안 넣었다"는 설명은 틀렸음.** 실제로는 검토 누락이었고, 데이터상 신규 도메인이 수천 개였음.

**빌드 결과**: 전체 정적 규칙 262,246 → **272,248개** (14개 ruleset JSON), 정적 인덱스 259,853 → **268,213개 urlFilter**.

**eyeo 전용 추가 언어(arabic/bulgarian/dutch/hebrew/hungarian/indian/indonesian/italian/latvian/lithuanian/romanian/tamil/nordic/fb_non-graph/mobile-anti-cv)**는 대부분 cosmetic 필터라 DNR 변환 대상이 거의 없어(신규 2개) 미포함.

### 14.5 치지직(chzzk.naver.com) 광고 대응 (2026-11-20)

**현재 상태**
- 네트워크 차단: `ruleset_korean.json`에 치지직 전용 규칙 **14개** 존재
  - `api.chzzk.naver.com/service/v1/lives/*/ads/current` (현재 광고 API)
  - `api.chzzk.naver.com/ad-polling/v1/lives/*/ad` (광고 폴링)
  - `nam.veta.naver.com/*` allow 3개 (안티애드블록 감지 우회용)
- **동영상 광고 자체**: API 차단에만 의존하며, 이미 로드된 광고 영상/배너는 DNR로 잡히지 않음
- `$replace` 옵션 규칙 3개(id 823~825)는 DNR 미지원 옵션이 urlFilter에 그대로 들어가 **무효**

**조치**
- `general-blocker.js`에 치지직 전용 DOM 숨김 선택자 추가:
  - 범용: `[data-ad-type]`, `[data-ad-slot]`, `[data-ad-area]`, `[class*='ad-banner']`, `[class*='ad-overlay']`, `[class*='ad-video']`, `[class*='advertisement']`, `[class*='sponsor-banner']`, `[class*='ad_marker']`, `[class*='ad-marker']`
  - **실제 페이지 DOM 확인(2026-11-20, 브라우저 도구로 chzzk.naver.com/live 및 /video 페이지 조사) 결과 추가**:
    - `.webplayer-internal-core-ad-ui` — 치지직 플레이어 광고 UI 전체
    - `.pzp-ad-break-indicator`, `.pzp-pc__ad-break-indicator` — "광고 후 계속됩니다" 안내
    - `.pzp-pc__midroll-dim`, `.pzp-midroll-dimmed` — 미드롤 광고 딤 레이어
    - `[data-nlog-area='event_popup']` — 메인 페이지 이벤트/광고 팝업 ("자세히 보기"/"1일간 보지 않기" 버튼이 있음)
- 플레이어(`video`, `#movie_player`)는 대상에서 제외 (오차단 방지)

**한계**
- 2026-11-20 실제 페이지를 열어 광고 마커(위 #14.5 참조)를 확인하고 선택자에 반영함. 광고가 새 클래스명으로 바뀌면 추가 확인 필요.
- 유튜브 같은 응답 후킹(`youtube-main.js`)은 치지직에 없음 → 광고 API가 바뀌면 대응이 어려움.

#### 치지직 동영상 광고 자동 스킵 (2026-11-20 추가)

실제 크롬에서 확인한 광고 DOM 구조:
```html
<div class="ad_info_area">
  <div class="skip_area" data-role="countDownEl">
    <p class="skip_info"><strong data-role="countDownTxt">8</strong>초 후 <span class="txt_skip">SKIP</span></p>
  </div>
  <button class="btn_skip hide">SKIP</button>  <!-- 카운트다운 끝나면 hide 제거됨 -->
</div>
```

- 네트워크 차단으로 막지 못한 광고가 재생되면, `chzzk-ad-skip.js`가 250ms 간격으로 `.ad_info_area button.btn_skip`을 감시한다.
- `hide` 클래스가 제거되고 버튼이 보이는 순간 **자동 클릭**하여 광고를 스킵하고 `adRemoved` 통계를 전송한다.
- `manifest.json`에 `*://chzzk.naver.com/*` 매칭, `document_start`, `all_frames`로 등록.
- 전체 ON/OFF 토글 연동 (OFF 시 폴링 중지).
