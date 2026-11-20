# 필터 레지스트리 재설계 계획

> 작성일: 2026-11-20
> 기준: `tools/build-filters.js`, `background/filter-updater.js`, `options/config.js`, `manifest.json`
> 목적: 소스 추가·그룹 변경·UI 수정 시 **한 곳만 수정**하면 되도록 구조 개선

---

## 1. 현재 문제

동일한 소스 정보가 **3곳에 중복**되어 있다.

| 위치 | 역할 | 중복 내용 |
|------|------|-----------|
| `tools/build-filters.js` `GROUPS` | 빌드용 소스 URL | URL, 그룹 |
| `background/filter-updater.js` `FILTER_SOURCES` | 업데이트용 소스 URL | URL, 그룹 |
| `options/config.js` `FILTER_LIST` / `LICENSE_TABLE` | UI 라벨, 출처, 개수 | 이름, 출처, 개수 |

→ 새 소스를 추가하거나 그룹 이름을 바꿀 때 **3~4개 파일을 동시에 수정**해야 함.
→ 이게 번거로움과 실수(불일치)의 근본 원인.

추가로, 현재 그룹 간 규칙이 섞여 있어 토글 의미가 모호함:
- 광고 ∩ 한국 345개, 개인정보 ∩ 성가신 266개, 광고 ∩ 성가신 170개 등

---

## 2. 해결 원칙: 단일 진실 공급원(Single Source of Truth)

`shared/filter-registry.js` **한 파일에 모든 소스 정의**를 둔다.

```javascript
export const FILTER_REGISTRY = [
  {
    id: "easylist",           // 고정 식별자 (상태 저장 키로 사용)
    group: "easylist",        // 소스 성격별 그룹 (토글 단위)
    name: "EasyList",         // UI 표시명
    license: "CC BY-SA 3.0",  // 라이선스
    url: "https://easylist.to/easylist/easylist.txt",
    ruleset: "easylist",      // 빌드될 규칙셋 파일 접두사
  },
  // ... 소스 추가 시 여기 한 줄만 추가
];

export const FILTER_GROUPS = [
  { id: "easylist", name: "EasyList", icon: "📢" },
  // ... 그룹 추가 시 여기 한 줄만 추가
];
```

### 소비자 (모두 레지스트리를 import)

| 파일 | 사용법 |
|------|--------|
| `tools/build-filters.js` | `FILTER_REGISTRY.filter(s => s.group === g)` → 소스 목록 생성 |
| `background/filter-updater.js` | 동일 레지스트리에서 URL 추출 |
| `options/config.js` | `FILTER_GROUPS` → UI 토글, `FILTER_REGISTRY` → 출처 표/개수 |

---

## 3. 그룹 재정의 (8개, 소스 성격별)

기존 6개 → **소스별로 8개로 확장**. 억지로 6개 유지하지 않음.

| 그룹 ID | 이름 | 소스 | 개수 |
|---------|------|------|------|
| `security` | 🛡️ 보안 | NoCoin, URLhaus, uAssets badware/resource-abuse | 4 |
| `easylist` | 📢 EasyList | easylist, easyprivacy, AdGuard Base(2.txt) | 3 |
| `uassets` | 🔧 uAssets 광고 | uAssets filters/general/2024/2025/2026, Peter Lowe | 6 |
| `korean` | 🇰🇷 한국 필터 | NoriDev, Turtlecute, d3Host, List-KR, filterslists-KO, extra-hosts | 6 |
| `privacy` | 🔒 개인정보 | Fanboy's Social, AdGuard URL Tracking, uAssets privacy | 3 |
| `anti_cv` | 🚫 안티애드블록 | abp-filters-anti-cv 11개 언어 | 11 |
| `annoyances` | 🧹 성가신 요소 | Fanboy's Annoyance | 1 |
| `chzzk` | 🎬 치지직 | crackle 유지보수 기법 (응답 후킹) — 소스라기보다 코드지만 토글로 노출 가능 | 0~1 |

> 참고: `chzzk`는 필터 소스가 아니라 MAIN world 후킹 스크립트이지만,
> 사용자가 "치지직 전용 토글"을 원하면 별도 그룹으로 표시 가능.
> 기본은 `security` 또는 별도 노출 여부는 구현 시 결정.

---

## 4. 규칙셋 파일 매핑

기존 규칙셋 파일명을 **그대로 유지**해 마이그레이션 리스크 최소화:

| 그룹 | 규칙셋 파일 |
|------|------------|
| `security` | `ruleset_security_1~5.json` |
| `easylist` | `ruleset_easylist.json` (기존 `ruleset_ads.json`에서 분리) |
| `uassets` | `ruleset_uassets.json` (기존 `ruleset_ads.json`에서 분리) |
| `korean` | `ruleset_korean.json` |
| `privacy` | `ruleset_privacy.json` |
| `anti_cv` | `ruleset_anti_circumvention.json` |
| `annoyances` | `ruleset_annoyances.json` |

> `ads` 규칙셋(5개)를 `easylist` + `uassets`로 분리하면 규칙 수는 같지만
> **토글을 끌 때 의미가 명확**해짐 (EasyList만 끄기, uAssets만 끄기 등).

---

## 5. 마이그레이션 순서

1. `shared/filter-registry.js` 생성 — 위 소스/그룹 정의 이전
2. `build-filters.js` — `GROUPS` 삭제, 레지스트리에서 생성
3. `filter-updater.js` — `FILTER_SOURCES` 삭제, 레지스트리에서 생성
4. `options/config.js` — `FILTER_LIST`/`LICENSE_TABLE`을 레지스트리에서 자동 생성
5. 규칙셋 재빌드 (`--all`) — 그룹별 분리 반영
6. `manifest.json` `rule_resources` 갱신
7. `filterStates` 마이그레이션 — 기존 `ads` 키 → `easylist`+`uassets` 매핑
8. UI 검증 + 문서 갱신

---

## 6. 효과

| 작업 | 기존 | 개선 후 |
|------|------|---------|
| 새 필터 소스 추가 | 3~4 파일 수정 | **레지스트리 1줄** |
| 그룹 이름 변경 | config + 문서 | 레지스트리 `name` 1곳 |
| 출처/라이선스 갱신 | config + 문서 | 레지스트리에서 **자동 생성** |
| 그룹 분리/통합 | manifest + background + config 전부 수정 | 레지스트리 `group` 값만 |
| 필터 개수 표시 | 하드코딩 | 빌드 메타데이터에서 자동 |

---

## 7. 주의점

- **그룹 ID 호환**: 기존 `filterStates`의 `ads` 키는 마이그레이션에서 `easylist`+`uassets`로 매핑
- **규칙셋 유지**: 기존 규칙셋 파일명 재사용 없이 새 이름 사용 시 확장 재로드 필요 (atomic)
- **완전 자동 분류 아님**: 소스 성격별 수동 분류이므로, 새 소스 추가 시 `group` 선택은 사람이 결정 (그게 의도)
