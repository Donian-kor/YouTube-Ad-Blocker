# 필터 업데이트 기능 기획·보안 문서

> 작성일: 2026-11-20
> 기준 코드: `manifest.json` v3.2, `background.js`, `options.html/js`
> 이 문서는 **현재 저장소에 실제로 존재하는 코드**와 **Chrome 공식 확장 문서에서 확인한 사실**만을 근거로 작성했습니다. 확인되지 않은 내용은 "확인 필요"로 표시했으며, 없는 코드를 추측해 만들지 않았습니다.

---

## 1. 목표

- 광고 차단 목록(필터)을 바꿀 때마다 확장 프로그램 전체를 재설치하지 않게 한다.
- 설정 페이지(`options.html`)의 **"필터 전체 업데이트" 버튼 한 번**으로 최신 필터를 받아 적용한다.
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
| 한국 광고 필터 (NoriDev + Turtlecute + d3Host + extra-hosts + **List-KR**) | 456 + List-KR | ~1,885 (전체) | 전체 | ✅ 가능 | NoriDev, Turtlecute, d3Host, List-KR, extra-hosts |
| 개인정보 보호 (Fanboy's Social + URL Tracking) | 270 | 270 (전체) | 전체 | ✅ 가능 | Fanboy's Social, URL Tracking |
| 안티서클 (abp-filters-anti-cv) | 142 | 142 (전체) | 전체 | ✅ 가능 | anti-cv (영문/중문/유럽어) |
| 성가신 요소 (Fanboy's Annoyance) | 2,445 | 2,445 (전체) | 전체 | ✅ 가능 | Fanboy's Annoyance |
| 보안 (NoCoin + URLhaus) | 134,458 | 6,000 | 상위 6,000개만 | ❌ 불가 (항상 ON) | NoCoin, URLhaus |

> **중요 정정**: 30,000개는 **그룹별이 아니라 확장 전체 동적 규칙 합계 한도**다.
> 위 배분 합계 = 19,000 + 1,885 + 270 + 142 + 2,445 + 6,000 = **29,742개** (여유 258개).

---

## 3. 설정 페이지 UI 구성 (탭 형식 + 반응형)

### 3.1 전체 구조

```
설정 페이지 (반응형 가로폭: min(560px, 100vw - 32px))
├── 탭 바
│   ├── [필터 목록] 탭
│   ├── [내 차단 목록] 탭
│   └── [출처 및 라이선스] 탭
│
├── [필터 목록] 탭 내용
│   ├── 통계 (총 차단 수, 네트워크 차단, DOM 제거, 마지막 재설정)
│   ├── 전체 활성화 / 전체 비활성화 버튼
│   ├── [필터 전체 업데이트] 버튼 (1개)
│   ├── 📢 광고 차단 [🔒 항상 켜짐] [펼치기 ▼]
│   │   └── (펼침 시) EasyList, EasyPrivacy, Ultimate Ad Filter
│   ├── 🇰🇷 한국 광고 필터 [토글] [펼치기 ▼]
│   │   └── (펼침 시) NoriDev, Turtlecute, d3Host, List-KR, extra-hosts
│   ├── 🔒 개인정보 보호 [토글] [펼치기 ▼]
│   │   └── (펼침 시) Fanboy's Social, URL Tracking
│   ├── 🛡️ 안티서클 [토글] [펼치기 ▼]
│   │   └── (펼침 시) anti-cv (영문/중문/유럽어)
│   ├── 🧹 성가신 요소 [토글] [펼치기 ▼]
│   │   └── (펼침 시) Fanboy's Annoyance
│   └── 🚨 보안 [🔒 항상 켜짐] [펼치기 ▼]
│       └── (펼침 시) NoCoin, URLhaus
│
├── [내 차단 목록] 탭 내용
│   ├── 사이트별 차단 요소 목록 (chrome.storage.local의 blockedSelectors)
│   │   ├── 각 사이트별로 카드 표시
│   │   │   ├── 사이트명 (예: example.com)
│   │   │   ├── 차단된 선택자 목록 (CSS 선택자 문자열)
│   │   │   │   ├── 각 선택자 우측에 [삭제] 버튼
│   │   │   │   └── [선택자 편집] 버튼 (클릭 시 입력 필드로 변경)
│   │   │   ├── [사이트 전체 해제] 버튼
│   │   │   └── [선택자 추가] 버튼 (입력 필드 + 추가 버튼)
│   │   └── 사이트가 없을 경우 "차단한 요소가 없습니다" 메시지
│   └── [전체 차단 목록 초기화] 버튼 (confirm 후 전체 삭제)
│
└── [출처 및 라이선스] 탭 내용
    ├── 필터 그룹별 출처/라이선스 표
    │   ├── 그룹명
    │   ├── 소스 URL
    │   ├── 라이선스
    │   └── 홈 URL
    └── 프로젝트 라이선스 안내 (CC BY-NC-SA 4.0)
```

### 3.2 탭 바 UI

| 요소 | 설명 |
|------|------|
| 탭 버튼 | 3개: "필터 목록", "내 차단 목록", "출처 및 라이선스" |
| 활성 탭 표시 | 활성 탭은 배경색 변경 + 하단 밑줄 |
| 탭 전환 | 클릭 시 해당 탭 내용 표시, 나머지 숨김 |
| 반응형 | 좁은 화면에서도 탭 바가 가로 스크롤 없이 표시 |

### 3.3 [필터 목록] 탭 상세

#### 그룹 카드 UI

| 요소 | 설명 |
|------|------|
| 아이콘 + 그룹명 | 예: 📢 광고 차단 |
| 상태 배지 | "🔒 항상 켜짐" (광고 차단/보안) 또는 라이선스 배지 |
| 토글 스위치 | 광고 차단/보안은 비활성화(잠금), 나머지는 활성화 |
| 펼치기 버튼 | ▼ / ▲ 클릭 시 내부 필터 목록 표시/숨김 |

#### 펼침 UI 상세

- 펼침 시 해당 그룹에 속한 **개별 필터 목록**이 작은 글씨로 표시된다.
- 각 필터는 **체크박스**로 개별 활성화/비활성화 가능 (단, 광고 차단/보안 그룹은 체크박스 비활성화).
- 필터 이름, 라이선스, 소스 URL이 작은 글씨로 표시된다.

#### 전체 업데이트 버튼 (1개)

- "필터 전체 업데이트" 버튼 1개만 제공한다.
- 클릭 시 **6개 그룹 전체**의 필터를 순차적으로 다운로드 → 변환 → 교체한다.
- 사용자 UX: 개별 필터를 일일이 누르지 않고 한 번에 업데이트.
- 업데이트 중에는 버튼이 비활성화되고 "업데이트 중..." 메시지 표시.
- 완료 시 "✅ N개 업데이트 완료" 메시지 표시.
- **스테이징(Stage) 방식 적용**: 새 규칙을 2000번대 임시 ID로 먼저 추가 → 검증 → 1000번대와 교체
- **브라우저 종료 시**: 2000번대 규칙이 남아있어 다음 실행 시 자동 복구

#### 잠금 UI (광고 차단 / 보안)

- 토글이 비활성화되고 "🔒 항상 켜짐" 배지가 표시된다.
- 펼침 시 내부 필터 체크박스도 비활성화된다.

#### 전체 비활성화 버튼

- "전체 비활성화" 버튼 클릭 시 **광고 차단/보안을 제외한 4개 그룹만** 비활성화된다.
- 광고 차단/보안은 항상 활성 상태로 유지된다.

### 3.4 [내 차단 목록] 탭 상세

#### 데이터 소스

- `chrome.storage.local`의 `blockedSelectors` 키
- 구조: `{ "example.com": [".ad-banner", "#ad-slot", ...], ... }`
- 사이트별 최대 200개 (`MAX_PER_SITE` in `element-blocker.js`)

#### UI 구성

| 요소 | 설명 |
|------|------|
| 사이트 카드 | 각 사이트별로 카드 표시 (사이트명 + 차단 수) |
| 선택자 목록 | CSS 선택자 문자열 + [삭제] + [편집] 버튼 |
| 편집 모드 | 클릭 시 입력 필드로 변경, [저장] [취소] 버튼 표시 |
| 선택자 추가 | 입력 필드 + [추가] 버튼 |
| 사이트 전체 해제 | [사이트 전체 해제] 버튼 (confirm 후 해당 사이트만 삭제) |
| 전체 초기화 | [전체 차단 목록 초기화] 버튼 (confirm 후 전체 삭제) |
| 빈 상태 | 차단한 요소가 없을 경우 "차단한 요소가 없습니다" 메시지 |

#### 편집 동작

- 선택자 편집: `prompt()` 또는 인라인 입력 필드로 수정
- 수정 시 CSS 유효성 검사 (`document.querySelector`로 테스트)
- 저장 시 `chrome.storage.local` 업데이트 → `element-blocker.js`에 즉시 반영

#### 사이트 추가/삭제

- 선택자 추가: 입력 필드에 CSS 선택자 입력 → `[추가]` 버튼
- 선택자 삭제: `[삭제]` 버튼 클릭 → 즉시 삭제 (confirm 없음)
- 사이트 전체 해제: `[사이트 전체 해제]` 버튼 클릭 → confirm 후 해당 사이트만 삭제

### 3.5 [출처 및 라이선스] 탭 상세

#### 필터 그룹별 출처/라이선스 표

| 그룹 | 소스 URL | 라이선스 | 홈 URL |
|------|----------|----------|--------|
| 광고 차단 | EasyList, EasyPrivacy, Ultimate Ad Filter | CC BY-SA 3.0 / GNU GPLv3 | https://easylist.to/ |
| 한국 광고 필터 | NoriDev, Turtlecute, d3Host, List-KR | CC BY-NC-SA 4.0 / GNU GPLv3 | https://github.com/List-KR/List-KR |
| 개인정보 보호 | Fanboy's Social, AdGuard URL Tracking | CC BY 3.0 / GNU GPLv3 | https://easylist.to/, https://github.com/AdguardTeam/AdguardFilters |
| 안티서클 | abp-filters-anti-cv | GNU GPLv3 | https://github.com/abp-filters/abp-filters-anti-cv |
| 성가신 요소 | Fanboy's Annoyance | CC BY 3.0 | https://easylist.to/ |
| 보안 | NoCoin, URLhaus | MIT / CC0 1.0 | https://gitlab.com/curben/urlhaus-filter |

#### 프로젝트 라이선스 안내

- CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)
- 저작자 표시 + 비상업적 용도 + 동일 라이선스
- 상업적 이용은 별도 문의 필요

### 3.6 반응형 가로폭

- 현재: `width: 560px` 고정
- 변경: `width: min(560px, 100vw - 32px)` 또는 `max-width: 560px; width: 100%;`
-좁은 화면(모바일, 반쪽 창)에서도 가로 스크롤 없이 표시
- 탭 바도 반응형: 탭 버튼이 3개이므로 `display: flex; flex-wrap: wrap;` 또는 `overflow-x: auto` 사용

### 3.7 업데이트 중단 / 브라우저 종료 시 복구 전략

#### 문제 시나리오

| 시나리오 | 결과 | 심각도 |
|----------|------|--------|
| 브라우저 종료 (규칙 교체 도중) | 1000번대 규칙이 누락되어 다음 실행 시 **정적 규칙만 적용** (동적 업데이트분 없음) | ⚠️ 높음 |
| 특정 그룹 다운로드 실패 | 해당 그룹만 **예전 규칙 유지**, 나머지는 신규 규칙 → **버전 혼재** | ⚠️ 중간 |
| 배분 초과 그룹에서 변환 실패 | 배분 상한까지만 반영, 나머지는 정적 유지 → **의도한 동작** | ✅ 정상 |
| 업데이트 중 네트워크 단절 | 타임아웃 후 실패 처리, **예전 규칙 유지** | ✅ 정상 (타임아웃 시) |

#### 근본 원인

1. **원자성(Atomicity) 부재**: "교체" 방식이므로 **기존 규칙을 먼저 지우는 순간** 중단되면 복구 불가
2. **storage 저장 시점**: `saveFilterStates` → `applyStaticRulesetsByState` 호출 후 **콜백에서 sendResponse** 하는데, 이 도중 종료되면 storage에는 저장되었으나 **규칙 미적용** 상태

#### 해결 방법: 스테이징(Stage) 방식 (채택)

1. **사전 추가(Stage)**: 새 규칙을 **기존 ID 대역(1~68, 100~109)과 겹치지 않는 임시 ID 대역(예: 2000번대)** 으로 먼저 추가
2. **검증**: 추가된 규칙이 정상 로드되는지 확인
3. **교체(Commit)**: 기존 1000번대 규칙 제거 → 2000번대를 1000번대로 재매핑 (또는 2000번대 유지)
4. **브라우저 종료 시**: 2000번대 규칙이 남아있어 **다음 실행 시 자동 복구** (1000번대 없어도 2000번대가 적용됨)

#### 진행 상태 저장 (보조)

- `chrome.storage.local`에 `updateProgress` 키로 **현재 진행 중인 그룹 인덱스** 저장
- 브라우저 재실행 시 `initRules()`에서 `updateProgress` 확인 → **미완료 시 이어서 재개** 또는 **자동 복구**

#### 사용자 안내 문구 (문서에 추가)

> - 업데이트 중 브라우저를 종료하면 **다음 실행 시 자동 복구**됩니다.
> - 특정 그룹 다운로드 실패 시 **해당 그룹만 예전 규칙 유지**, 나머지는 신규 규칙으로 업데이트됩니다.
> - 업데이트는 **사용자가 버튼을 누를 때만** 1회 실행되며, 자동 폴링하지 않습니다.

#### 복구 로직 요약

```javascript
// background.js initRules()에 추가할 로직
chrome.storage.local.get(["updateProgress"], (result) => {
  if (result.updateProgress && result.updateProgress.incomplete) {
    // 미완료 상태 감지 → 2000번대 규칙을 1000번대로 재매핑
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [/* 2000번대 ID 목록 */],
      addRules: [/* 1000번대 ID로 재매핑된 규칙들 */]
    }, () => {
      // 성공 시 updateProgress 삭제
      chrome.storage.local.remove("updateProgress");
    });
  } else {
    // 정상 상태 → initRules 계속 진행
    applyRules(enabled);
  }
});

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
[사용자] 설정 페이지에서 "필터 전체 업데이트" 버튼 클릭
      ↓
[options.js] chrome.runtime.sendMessage({ type: "updateFilters" })
      ↓
[background.js] 6개 그룹 소스 URL에서 필터 순차 다운로드 (HTTPS, AbortController 10초 타임아웃)
      ↓
[background.js] 내용 파싱 → DNR 규칙으로 변환 (build-filters.js와 동일한 로직)
      ↓
[background.js] 그룹별 배분(19,000/6,000/전체) 적용, 전체 합계 29,742개로 한도 준수
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
- **나머지 4개 그룹**: 전체 등록 (합계 1,885 + 270 + 142 + 2,445 = 4,742개).
- **전체 합계**: 19,000 + 6,000 + 4,742 = **29,742개** ≤ 30,000 (Chrome 전체 동적 한도).

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
  - 파일 크기 상한을 둔다 (예: 1MB). 비정상적으로 큰 응답은 거부한다.
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
7. "필터 전체 업데이트" 버튼 클릭 → "업데이트 완료" 표시 확인
8. 새 규칙이 실제로 차단되는지 확인 (차단 로그/뱃지)
9. 토글 ON/OFF 후에도 새 필터 규칙이 유지되는지 확인
10. URL을 `http://`로 바꿨을 때 거부되는지, 1MB 초과 파일이 거부되는지 확인
11. 짧은 시간에 버튼 여러 번 클릭 시 디바운스가 동작하는지 확인
12. 그룹별 배분(광고 19,000 / 보안 6,000 / 나머지 전체)이 적용되어 전체 29,742개로 한도 내인지 확인
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