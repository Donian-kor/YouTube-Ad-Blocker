# 프로젝트 구조 정리 계획

> 작성일: 2026-11-20
> 기준 코드: `www_AD_Blocker` v3.2 (커밋 `78402dc`)
> 이 문서는 **현재 저장소에 실제로 존재하는 파일·줄 수**와 **필터 업데이트 기획 문서(`filter-update-plan.md`)**를 근거로 작성했습니다.
> 아직 **구현되지 않은 계획**이며, 각 단계는 독립적으로 커밋·검증합니다.

---

## 1. 목적 및 배경

필터 업데이트 기능(`filter-update-plan.md`)을 구현하기 전에 **파일 역할을 먼저 분리**한다.

### 왜 먼저 정리하는가

| 이유 | 근거 |
|------|------|
| `options.js` 비대화 | 현재 183줄인데, 탭 전환 + 필터 토글/펼치기 + 전체 업데이트 + 내 차단 목록 편집 + 출처 표시 추가 시 **400줄 이상** 예상 |
| `background.js` 비대화 | 현재 557줄인데, `updateFilters` 핸들러(fetch/파싱/변환/스테이징/복구) 추가 시 **750줄 이상** 예상 |
| 변환 로직 중복 | `tools/build-filters.js`(빌드 시점 변환)와 `background.js`(런타임 변환)가 **같은 DNR 변환 로직**을各自 구현하게 됨 |
| AGENTS.md 규칙 | "파일이 약 300줄을 넘거나 한 파일에 역할이 둘 이상 섞이면 분리를 검토" |
| 되돌리기 비용 | 기능 구현 후 구조를 쪼개면 재테스트가 두 번 발생 |

---

## 2. 현재 구조 (실측)

### 2.1 파일별 역할·줄 수

| 파일 | 줄 수 | 역할 | 문제 |
|------|-------|------|------|
| `background.js` | 557 | DNR 규칙 등록, 통계, 뱃지, 우클릭 메뉴, 토글, 필터 상태 | 역할 5개 혼재. 업데이트 로직 추가 시 과부하 |
| `options.js` | 183 | 통계 표시 + 필터 목록 렌더링 + 토글 + 전체 ON/OFF | UI 3개 탭 모두 담당 예정 → 비대화 |
| `tools/build-filters.js` | 394 | 원격 필터 다운로드 → DNR 변환 → 규칙셋 JSON 생성 | 변환 로직이 이 파일에만 있어 런타임 재사용 불가 |
| `content.js` | 270 | 유튜브 DOM 정리·광고 스킵 | 주입 순서 민감 → **분리 금지** |
| `element-blocker.js` | 311 | 우클릭 차단 선택자 저장·적용 | 단일 역할, 유지 |
| `filehost-blocker.js` | 231 | 파일 공유 사이트 광고 차단 | 단일 역할, 유지 |
| `anti-bypass.js` | 181 | 안티애드블록 감지 무력화 | 단일 역할, 유지 |
| `youtube-main.js` | 149 | 유튜브 응답 후킹 (MAIN world) | 단일 역할, 유지 |
| `general-blocker.js` | 125 | 일반 사이트 인라인 광고 숨김 | 단일 역할, 유지 |
| `popup.js` | 126 | 팝업 UI·통계·로그 | 단일 역할, 유지 |
| `popunder-blocker.js` | 42 | 팝언더 차단 (MAIN world) | 단일 역할, 유지 |
| `options.html` | 198 | 설정 페이지 마크업·CSS | 탭 UI 추가 시 CSS 증가 |
| `popup.html` | 99 | 팝업 마크업·CSS | 유지 |
| `manifest.json` | 113 | 확장 설정 | 모듈화 시 일부 변경 |

### 2.2 현재 폴더 트리

```
www_AD_Blocker/
├── .git/
├── docs/                          문서 2개
│   ├── filter-update-plan.md      (424줄) 기능 기획·보안
│   └── adblockultimate-filter-comparison.md (113줄) 필터 대조표
├── filters/                       정적 규칙셋 14개 JSON (263,432개)
├── tools/
│   ├── build-filters.js           필터 생성기 (394줄)
│   ├── validate-rules.js          규칙 검증기 (78줄)
│   ├── test-*.js                  테스트 4개
│   └── tmp/                       다운로드 원본 (개발용, 배포 제외)
├── _metadata/                     DNR 인덱스 캐시 (개발용, 배포 제외)
├── *.js                           상위 표 참고
├── *.html                         options.html, popup.html
├── manifest.json
├── README.md
├── LICENSE
├── .gitignore
└── icon*.png                      8개
```

---

## 3. 제안 구조

### 3.1 변경 후 트리

```
www_AD_Blocker/
├── docs/
│   ├── project-structure-plan.md          이 문서 (현재 구조 반영)
│   ├── filter-registry-plan.md            필터 레지스트리 2단 구조
│   ├── filter-update-plan.md              필터 업데이트 기능 계획
│   └── adblockultimate-filter-comparison.md 필터 소스 비교 자료
├── filters/                                정적 규칙셋 37개 JSON + static-index.json
├── shared/                                 빌드·런타임 공용 (UMD)
│   ├── filter-converter.js                 DNR 변환 로직
│   ├── filter-registry.js                  소스/그룹/카테고리 단일 진실 공급원
│   └── build-meta.js                       빌드 결과 메타 (자동 생성)
├── tools/
│   ├── build-filters.js                    소스별 규칙셋 빌드
│   ├── validate-rules.js                   규칙 검증
│   └── test-*.js                           기능별 테스트
├── options/                                설정 페이지 모듈 (ESM)
│   ├── main.js                             진입점 (탭 전환, 초기화, 사이드바 정렬)
│   ├── config.js                           카테고리·소스 목록, 라이선스 표
│   ├── stats.js                            통계 패널
│   ├── filters-tab.js                      필터 토글·업데이트 UI
│   ├── blocked-tab.js                      내 차단 목록 편집 UI
│   └── licenses-tab.js                     출처·라이선스 UI
├── background/                             서비스 워커 모듈 (importScripts)
│   ├── state.js                            모듈 간 공유 상태 (AppState)
│   ├── stats.js                            통계·사이트별 카운트·뱃지·탭 추적
│   ├── rules.js                            DNR 규칙 정의·활성화, 상태 마이그레이션
│   └── filter-updater.js                   필터 업데이트 로직
├── background.js                           진입점: 위 모듈 importScripts + 메시지/메뉴 핸들러
├── options.html                            <script type="module" src="options/main.js">
├── manifest.json                           service_worker: background.js
└── (content script 파일들은 위치 유지)
```

### 3.2 모듈별 역할

| 모듈 | 역할 | 현재 줄 수 |
|------|------|-----------|
| `shared/filter-converter.js` | `convertLine()`, `normalizeBadfilter()` — 빌드/런타임 공용 | 166 |
| `shared/filter-registry.js` | 소스 31개·그룹 10개·카테고리 5개 정의 | 154 |
| `shared/build-meta.js` | 그룹/소스/규칙셋별 규칙 수 (빌드 시 자동 생성) | 93 |
| `options/main.js` | 진입점, 탭 전환, 사이드바 행 정렬 | 42 |
| `options/config.js` | 카테고리/소스 목록, 라이선스 표, 정적 규칙 총합 | 70 |
| `options/stats.js` | 통계 패널 표시 | 33 |
| `options/filters-tab.js` | 필터 카드·소스별 토글·업데이트·이력 UI | 290 |
| `options/blocked-tab.js` | `blockedSelectors` 표시/편집/추가/삭제/초기화 | 142 |
| `options/licenses-tab.js` | 출처·라이선스 표 렌더 | 32 |
| `background/state.js` | 모듈 간 공유 상태 `AppState` | 18 |
| `background/stats.js` | 통계, 사이트별 카운트, 뱃지, 탭 추적 | 188 |
| `background/rules.js` | DNR 규칙 정의·활성화, 필터 상태 마이그레이션 | 322 |
| `background/filter-updater.js` | fetch/변환/중복 제거/동적 규칙 등록 | 189 |
| `background.js` | 진입점: importScripts, 메시지 핸들러, 컨텍스트 메뉴 | 123 |

> `options.js`는 삭제되고 `options/` 모듈로 완전히 이전되었습니다.
> `background/main.js`는 만들지 않고 `background.js`를 진입점으로 유지합니다.

---

## 4. 마이그레이션 순서

각 단계는 **기능 변경 없이 구조만 바꾸고**, 매 단계에서 검증합니다.

### 1단계: 공용 변환기 분리 (가장 먼저)

- `tools/build-filters.js`의 변환 함수들을 `shared/filter-converter.js`로 추출 (UMD 패턴)
- `build-filters.js`는 `require("../shared/filter-converter.js")`로 대체
- **검증**: `node tools/build-filters.js --group=korean` 결과가 이전과 동일한 규칙 수
- **검증**: `node tools/validate-rules.js` 통과

### 2단계: 옵션 페이지 모듈화

- `options/config.js`, `filters-tab.js`, `blocked-tab.js`, `licenses-tab.js`, `main.js` 생성
- `options.html`의 `<script src="options.js">` → `<script type="module" src="options/main.js">`
- `options.js` 삭제
- **검증**: 설정 페이지에서 통계 표시, 필터 토글, 전체 ON/OFF가 이전과 동일하게 동작
- **검증**: CSP 위반 없음 (`script-src 'self'` 하에서 module 스크립트 허용)

### 3단계: 필터 업데이트 기능 구현 (먼저)

- `filter-update-plan.md` §3~§10 구현
- 1단계의 공용 변환기 재사용 → 런타임 변환 로직 중복 없음
- `background.js`에 `updateFilters` 핸들러를 **기존 파일 안에 임시로** 구현
- **검증**: `filter-update-plan.md` §11 검증 항목 15개

### 4단계: 백그라운드 모듈화 (기능 구현 후, 선택·신중)

> **순서 변경 이유**: 4단계에서 분리할 `filter-updater.js`는 3단계에서 만들어지는 코드다.
> 기능 구현 전에 빈 껍데기를 분리하면 검증할 기능이 없어 의미가 없고,
> 모듈화와 기능 구현을 동시에 하면 문제 발생 시 원인 추적이 어렵다.
> 따라서 **기능 구현 → 동작 검증 → 모듈화 → 분리 전후 동작 비교** 순서로 진행한다.

- **선택지 A (권장)**: `background.js` 유지 + 검증된 업데이트 로직만 `background/filter-updater.js`로 분리, `importScripts()`로 로드
  - `manifest.json` 변경 최소 (`service_worker` 경로 유지)
  - 기존 전역 함수 공유 방식 유지
- **선택지 B**: ES module 전환 (`"type": "module"` 추가)
  - `background/main.js` 진입, `import`로 모듈 로드
  - 모든 전역 참조를 `export`/`import`로 바꿔야 해서 **변경 범위가 큼**
- **검증**: 분리 전후 규칙 등록·통계·뱃지·토글·업데이트 동작이 동일한지 비교

---

## 5. 리스크 및 주의사항

| 리스크 | 영향 | 대응 |
|--------|------|------|
| **content script 분리** | 주입 순서(`document_start` → `document_idle`)가 깨지면 광고 차단 실패 | `content.js`, `youtube-main.js`, `anti-bypass.js`, `general-blocker.js`, `filehost-blocker.js`, `element-blocker.js`, `popunder-blocker.js`는 **현재 위치·순서 유지** |
| **service worker 모듈화** | MV3에서 ES module 등록 방식이 달라 규칙 미등록 | 3단계 선택지 A(importScripts) 우선 검토. B는 충분한 테스트 후 |
| **options.js 전역 IIFE** | 모듈로 쪼개면 기존 전역 변수 공유 불가 | `config.js`로 상수 이전, 각 탭 모듈은 `export function init()` 노출 → `main.js`에서 호출 |
| **파일 이동 시 경로** | `manifest.json`의 `rule_resources` 경로, `<script src>` 경로 깨짐 | 이동 후 manifests/HTML 경로 일괄 확인 |
| **빌드 결과 변경** | 공용 변환기 추출 중 규칙 수가 달라질 수 있음 | 1단계에서 규칙 수·검증기로 확인 |
| **개발용 폴더 배포 포함** | `tools/tmp`, `_metadata`가 ZIP에 들어감 | `.gitignore` 및 배포 제외 목록 유지 (현재 README에 명시됨) |

---

## 6. 하지 않는 것 (범위 밖)

- 필터 규칙 자체의 내용 변경 (차단 도메인 추가/삭제)
- content script 파일 이동·분리
- 확장 이름/아이콘/버전 변경 (이미 `www_AD_Blocker` v3.2로 확정)
- GitHub 저장소 설정 변경 (이미 `Donian-kor/www_AD_Blocker`로 완료)
- 설정 페이지 UI 디자인 변경 (탭 구조는 `filter-update-plan.md` §3에서 별도 확정)

---

## 7. 검증 체크리스트 (전체)

구조 정리 후 아래를 순서대로 확인합니다.

1. `node tools/build-filters.js --group=korean` — 변환 규칙 수가 이전(456 + List-KR)과 동일
2. `node tools/validate-rules.js` — 14개 규칙셋 전부 통과
3. 확장 재로드(`chrome://extensions/`) 후 오류 없음
4. 유튜브 영상 광고 차단 정상
5. 설정 페이지 탭 전환·통계·필터 토글 정상
6. 우클릭 요소 차단 정상
7. 필터 업데이트 버튼 동작 (구현 후)
8. `git status` 깨끗함 (각 단계 커밋 후)

---

## 8. 관련 문서

- `docs/filter-update-plan.md` — 필터 업데이트 기능 기획·보안 (구현 대상)
- `docs/adblockultimate-filter-comparison.md` — 필터 대조표
- `README.md` — 프로젝트 개요·파일 구조·라이선스
- 상위 규칙: 프로젝트 루트 `AGENTS.md`의 "코드 구조와 모듈화", "검증" 항목
