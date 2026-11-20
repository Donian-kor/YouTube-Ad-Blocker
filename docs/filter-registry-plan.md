# 필터 레지스트리 — 현재 구조

> 갱신일: 2026-11-20
> 기준 코드: `shared/filter-registry.js`, `shared/build-meta.js`,
> `tools/build-filters.js`, `background/rules.js`, `options/config.js`, `options/filters-tab.js`
>
> 초기 설계안과 중간 단계 구현 기록은 현재 상태 기준으로 정리했습니다.
> 상세 변경 과정은 Git 커밋 이력 참조.

---

## 1. 목적: 단일 진실 공급원

필터 소스 정보가 세 곳(빌드 스크립트·업데이터·설정 UI)에 중복되면
소스 하나 추가할 때마다 3~4개 파일을 고쳐야 했다.

`shared/filter-registry.js` **한 파일에 모든 소스 정의**를 두고 세 곳이 모두 참조한다.

| 소비자 | 사용 방식 |
|--------|-----------|
| `tools/build-filters.js` | 소스별 규칙셋 빌드, 정렬 순서 결정 |
| `background/filter-updater.js` | 원격 URL·동적 규칙 상한 추출 |
| `options/config.js` | 카테고리·소스 목록, 라이선스 표, 규칙 수 표시 |

UMD 패턴이라 Node(`require`), 확장 워커(`importScripts`), 옵션 ES module 모두에서 쓸 수 있다.

---

## 2. 레지스트리 구조

```javascript
{
  id: "noridev", name: "NoriDev", group: "korean", category: "korean",
  license: "CC BY-NC-SA 4.0",
  url: "https://raw.githubusercontent.com/.../filter.txt",
  limit: 1500,      // 런타임 동적 규칙 상한
}
```

- `group` — 소스 성격별 묶음 (정적 규칙셋·마이그레이션 단위, 10개)
- `category` — UI 상위 토글 단위 (5개)
- `file:` — 로컬 소스 (빌드 전용, 런타임 업데이트 제외)

### UI 카테고리 (5개)

| 순서 | ID | 이름 | 아이콘 |
|------|----|------|--------|
| 1 | `intl_ads` | 국제 광고 | 📢 |
| 2 | `security` | 보안 | 🛡️ |
| 3 | `korean` | 한국 필터 | 🇰🇷 |
| 4 | `privacy` | 개인정보 | 🔒 |
| 5 | `anti_cv` | 팝업·광고 방해 차단 | 🚫 |

잠금 카테고리는 없으며 모든 분류를 켜고 끌 수 있다.

### 소스 그룹 (10개)

| group | 이름 | category |
|-------|------|----------|
| `easylist` | EasyList | `intl_ads` |
| `adguard` | AdGuard 기본 | `intl_ads` |
| `peterlowe` | Peter Lowe | `intl_ads` |
| `uassets` | uAssets 광고 | `intl_ads` |
| `korean` | 한국 사이트 | `korean` |
| `social` | 추적 차단 | `privacy` |
| `anti_cv` | 광고 감지 대응 | `anti_cv` |
| `annoyances` | 팝업·쿠키 정리 | `anti_cv` |
| `malware` | 악성 사이트 | `security` |
| `mining` | 몰래 채굴 차단 | `security` |

---

## 3. 빌드 결과 (현재)

| 항목 | 값 |
|------|---|
| 개별 소스 | 31개 |
| 규칙셋 파일 | 37개 (`ruleset_<소스ID>[_N].json`) |
| 정적 규칙 총합 | 271,415개 |
| `static-index.json` | 268,221개 urlFilter |
| manifest 규칙셋 | 37개, **모두 `enabled: false`** |

규칙셋 파일명은 소스 ID를 그대로 사용한다. 예: `ruleset_noridev.json`,
`ruleset_easylist_2.json`, `ruleset_urlhaus_5.json`.

> 과거 그룹 단위 파일(`ruleset_korean.json`, `ruleset_security_*.json` 등)은
> 소스 단위 분할 때 삭제되었다.

---

## 4. 규칙 소유권과 중복 제거

`--all` 빌드는 **전역 `seen` 집합**을 유지하며, 한 규칙이 여러 소스에 있으면
구체적인 소스가 소유한다. 덕분에 소스 토글을 끄면 그 규칙이 실제로 비활성화된다.

```
korean → anti_cv → annoyances → social → mining → malware
→ uassets → peterlowe → easylist → easyprivacy → ultimate
```

- 중복 제거 전 322,924개 → **271,415개** (중복 51,509개 제거)
- 각 규칙셋은 30,000개 이하로 분할 (Chrome DNR 한도 준수)

---

## 5. 상태 저장과 마이그레이션

`filterStates`는 **항상 소스 ID를 키로** 저장한다.

- 과거 6개 그룹 키(`ads`, `privacy`, `anti_circumvention`, `security`, `annoyances`)와
  2단 구조의 10개 그룹 키(`korean`, `social`, `anti_cv`, ...)는
  `background/rules.js`의 `migrateFilterStates()`가 소스 키로 변환한다.
- 규칙셋 ID로 잘못 저장된 이전 값도 함께 정리한다.

`applyStaticRulesetsByState()`가 소스 키 상태를 규칙셋 ID로 확장해
`updateEnabledRulesets()`에 전달한다.

---

## 6. 정적 규칙 한도 대응

Chrome은 확장마다 정적 규칙 30,000개를 보장하고 나머지는 전역 풀에서 쓴다.
271,415개를 한 번에 활성화하면 `The set of enabled rulesets exceeds the rule count limit` 오류가 난다.

해결:
- manifest의 모든 규칙셋 `enabled: false`
- `getAvailableStaticRuleCount()`로 여유분 확인
- 우선순위 순서로 예산에 맞는 규칙셋만 활성화, 동시 호출은 큐로 직렬화
- 부족 시 콘솔 경고, 동적 규칙·콘텐츠 스크립트 차단은 유지

---

## 7. 향후 소스 추가 방법

1. `shared/filter-registry.js`의 `FILTER_REGISTRY`에 한 줄 추가
   (`id`, `name`, `group`, `category`, `license`, `url`, `limit`)
2. 필요하면 `SOURCE_ORDER`(`tools/build-filters.js`)의 소유권 순서 조정
3. `node tools/build-filters.js --all --offline` 실행

→ 규칙셋·`build-meta.js`·`static-index.json`·`manifest.json`·UI가 **자동 갱신**된다.
`background/rules.js`의 소스→규칙셋 매핑은 빌드 산출물과 일치해야 하며,
새 소스를 추가했다면 매핑에도 한 줄을 추가해야 한다.

---

## 8. 주요 변경 이력

| 단계 | 내용 |
|------|------|
| 설계 | 소스 정보 3곳 중복 문제 정의, 단일 진실 공급원 제안 |
| 2단 구조 | 5개 카테고리 + 10개 소스 그룹, 그룹 단위 규칙셋 |
| 소스 단위 | 31개 소스별 규칙셋(37개), 소스별 개별 토글 |
| 중복 제거 | 전역 dedupe, 51,509개 제거 |
| 한도 대응 | 여유분 기반 활성화 |
| 모듈화 | background 상태·통계·규칙 분리 |
