# 필터 업데이트 기능 — 현재 구현 상태

> 갱신일: 2026-11-20
> 기준 코드: `tools/build-filters.js`, `shared/filter-registry.js`, `shared/build-meta.js`,
> `background/filter-updater.js`, `background/rules.js`, `options/filters-tab.js`
>
> 이 문서는 초기 설계·디버깅 기록을 현재 구현 기준으로 정리한 것입니다.
> 과거 논의는 Git 커밋 이력에 남아 있습니다.

---

## 1. 목적과 범위

- 정적 필터는 **확장 패키지에 내장**되어 재배포 시에만 바뀐다.
- 설정 페이지의 **「최신 필터 업데이트」 버튼을 누를 때만** 동적 업데이트가 실행된다.
  (설치·재로드 시 자동 업데이트 없음)
- 동적 업데이트는 **정적 필터에 없는 신규 도메인만** 등록하며,
  변경이 없으면 `신규 업데이트가 없습니다`를 표시한다.

| 구분 | 값 |
|------|---|
| 정적 규칙 | **271,415개** (37개 규칙셋, 소스별 분할) |
| 정적 인덱스 | `filters/static-index.json` — **268,221개** urlFilter |
| 동적 규칙 한도 | 30,000개 (Chrome DNR 전체 합계) |
| 업데이트 이력 | 최근 20건 저장 |

---

## 2. 필터 소스

모든 소스 정의는 `shared/filter-registry.js` 한 곳에 있다 (단일 진실 공급원).

- 소스 **31개**, 소스 그룹 10개, UI 카테고리 5개
- 각 소스: `id`, `name`, `group`, `category`, `url`(또는 `file:`), `license`, `limit`
- 빌드·런타임 업데이트·설정 UI가 **같은 레지스트리를 참조**한다.
- 소스 추가 시 레지스트리에 한 줄만 추가하면 나머지는 자동 반영된다.

> 소스별 URL/라이선스 목록은 `options/licenses-tab.js`가 레지스트리에서 자동 생성한다.

---

## 3. 빌드 파이프라인

```bash
node tools/build-filters.js --all              # 전체 소스 재빌드
node tools/build-filters.js --all --offline    # tools/tmp 캐시 사용
node tools/build-filters.js --source=noridev   # 특정 소스만
node tools/validate-rules.js                   # 규칙 검증
```

`--all` 빌드가 수행하는 일:

1. 기존 `ruleset_*.json` 전부 삭제
2. 레지스트리의 **소스별**로 필터를 내려받아 DNR 규칙으로 변환
3. **전역 중복 제거** — 규칙 소유 순서(구체적인 소스 우선):
   ```
   korean → anti_cv → annoyances → social → mining → malware
   → uassets → peterlowe → easylist → easyprivacy → ultimate
   ```
   중복 51,509개 제거 → 271,415개 고유 규칙
4. 30,000개 단위로 규칙셋 분할 저장 (총 37개)
5. `shared/build-meta.js`, `filters/static-index.json`, `manifest.json`의
   `rule_resources`를 **자동 재생성** (수동 수정 불필요)

---

## 4. 런타임 업데이트 동작

`background/filter-updater.js`가 담당한다.

```
[버튼 클릭]
  → 레지스트리의 원격 소스 URL 순차 fetch (10초 타임아웃, 10MB 제한)
  → Adblock 형식 → DNR 규칙 변환
  → static-index.json과 비교해 정적 중복 제거
  → 소스별 상한 적용, 전체 30,000개로 캡
  → 지문(fingerprint) 비교 — 내용 같으면 "신규 업데이트가 없습니다"
  → 1단계: 이전 동적 규칙(id 1000~) 제거
  → 2단계: 새 규칙 추가  (한도 여유 확보를 위한 2단계 커밋)
  → updateHistory에 기록 (최근 20건)
```

- 동적 규칙 ID는 `1000`번부터 시작해 고정 규칙(1~68, 100~109)과 충돌하지 않는다.
- `applyRules()`가 전체 ON/OFF 토글 때 `removeRuleIds: ALL_RULE_IDS`로 정리하지만
  `1000`번대는 포함하지 않으므로 업데이트 규칙은 유지된다.
- `web_accessible_resources`로 `filters/static-index.json`을 노출해 워커에서 읽는다.

### 정적 규칙 한도 대응

Chrome은 확장마다 정적 규칙 **30,000개를 보장**하고, 초과분은 전역 공유 풀(약 300,000개)에서 쓴다.

- `manifest.json`의 모든 규칙셋은 `enabled: false` (로드 시 자동 활성화 방지)
- `background/rules.js`가 `getAvailableStaticRuleCount()`로 여유분을 확인한 뒤,
  우선순위(한국 → 광고 감지 대응 → 개인정보 → 팝업·쿠키 정리 → uAssets → Peter Lowe
  → 몰래 채굴 차단 → EasyList → AdGuard → 악성) 순으로 **예산에 맞는 규칙셋만** 활성화
- 동시 호출은 큐로 직렬화
- 한도가 부족해 제외되면 콘솔에 경고, **동적 규칙·콘텐츠 스크립트 차단은 계속 동작**

---

## 5. 설정 UI

- 좌측 **사이드바** 메뉴 3개: 필터 목록 / 내 차단 목록 / 출처 및 라이선스
- 통계 패널 상단 고정, 콘텐츠와 동일 폭 (`calc(60% - 20px)`, 최대 880px)
- 필터 목록은 **카테고리 5개 토글 + 펼치면 소스 체크박스** 2단 구조
  - 개별 소스 OFF → 해당 소스의 정적 규칙셋만 비활성화
  - 일부만 켜지면 카테고리 토글은 **녹색**, 전체 적용은 빨강 유지
  - 잠금 카테고리 없음 (국제 광고·보안도 토글 가능)
- 6번째 카드가 「필터 업데이트」이며 제목 옆 뱃지에 총 규칙 수 표시
- 상태 메시지(`신규 업데이트가 없습니다` 등)는 우측 정렬

---

## 6. 보안 관련 결정

- 모든 필터 URL은 **HTTPS만** 사용
- `fetch`에 `AbortController` 10초 타임아웃, 응답 10MB 제한
- 출처 표는 `innerHTML` 대신 DOM API로 렌더 (XSS 방지)
- `host_permissions`은 사용하는 필터 호스트로 최소화
- 업데이트 실패 시 이전 동적 규칙 유지 (원복 가능)

---

## 7. 검증 방법

```bash
node tools/validate-rules.js
node "$TEMP/opencode/verify-background-modules.mjs"   # 모듈 로딩/초기화 (개발용)
```

수동 확인:
1. 확장 재로드 → 콘솔에 `[정적 규칙] N/37 규칙셋, ... 활성화` 확인
2. 「최신 필터 업데이트」 클릭 → 최초 신규 규칙 등록, 재클릭 시 `신규 업데이트가 없습니다`
3. 「업데이트 내역 보기」 펼쳐 날짜·신규 개수 확인
4. 카테고리/소스 토글 OFF → 해당 규칙셋 비활성화되는지 확인
5. 잠금 없이 모든 분류가 토글 가능한지 확인

---

## 8. 주요 변경 이력

| 시기 | 변경 |
|------|------|
| 초기 | 6개 그룹, 정적 272,248개, 탭 UI, `options.js` 단일 파일 |
| 2단 구조 | 5개 카테고리 + 10개 소스 그룹, 레지스트리 도입 |
| 소스 단위 | 규칙셋을 31개 소스 단위(37개 파일)로 분할, 소스별 개별 토글 |
| 중복 제거 | 그룹 간 중복 51,509개 제거 → 271,415개 |
| 한도 대응 | `getAvailableStaticRuleCount()` 기반 예산 활성화, manifest 전부 비활성화 |
| 모듈화 | `background.js` → state/stats/rules/filter-updater 분리 |
| 용어 | 안티서클→광고 감지 대응, 성가신 요소→팝업·쿠키 정리, 코인마이닝→몰래 채굴 차단 |
