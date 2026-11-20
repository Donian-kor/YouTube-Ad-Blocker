# AdBlocker Ultimate 필터 대조표

> 작성일: 2026-11-20
> 기준 페이지: https://adblockultimate.net/ko/filters
> 이 문서는 **AdBlocker Ultimate 공식 필터 페이지에 나열된 전체 필터**와 **현재 프로젝트(youtube-ad-blocker v3.2) 내장 여부**를 대조한 기록입니다.
> "크레딧 URL"은 해당 페이지에 표기된 링크(주로 홈페이지/저장소)이며, 실제 다운로드 URL은 별도로 확인해야 합니다.

---

## 1. 요약

| 구분 | 필터 수 | 비고 |
|------|---------|------|
| 페이지 전체 필터 | **46개** | 광고 39 + 개인정보 3 + 보안 4 |
| 직접 내장 | **6개** | Ultimate Ad Filter, Anti-circumvention, Fanboy's Korean, Fanboy's Annoyance, Fanboy's Social, NoCoin |
| 다른 필터로 대체 | **4개** | Ultimate Privacy Filter, URL Tracking, Ultimate Security, Online Malicious URL Blocklist |
| 코드로 대체 | **1개** | Adblock Warning Removal → `anti-bypass.js` |
| 미포함 | **35개** | 지역별 언어 필터 30 + 성가신 요소 4 + 보안 1 |

**내장/대체/코드대체 합계: 11개 / 전체 46개 (미포함 35개)**

---

## 2. 광고 차단 필터 (39개)

| # | 필터 이름 | 라이선스 | 크레딧 URL | 상태 | 내장 위치 / 사유 |
|---|-----------|----------|------------|------|------------------|
| 1 | Ultimate Ad Filter | GNU GPLv3 / CC BY 3.0 | easylist.to, filters.adtidy.org | ✅ 직접 내장 | **광고 차단 그룹** (AdGuard Base `2.txt`) |
| 2 | Anti-circumvention | GNU GPLv3 | github.com/abp-filters/abp-filters-anti-cv | ✅ 직접 내장 | **안티서클 그룹** (동일 저장소 11개 언어 파일) |
| 3 | RuAdList | CC BY 3.0 | easylist.to | ❌ 미포함 | 러시아어 사이트용 — 한국/유튜브 중심이라 실익 적음 |
| 4 | EasyList Germany | GNU GPLv3 / CC BY 3.0 | easylist.to | ❌ 미포함 | 독일어 사이트용 |
| 5 | Fanboy's Japanese | CC BY 3.0 | fanboy.co.nz | ❌ 미포함 | 일본어 사이트용 |
| 6 | EasyList Dutch | GNU GPLv3 / CC BY 3.0 | easylist.to | ❌ 미포함 | 네덜란드어 사이트용 |
| 7 | EasyList Spanish | GNU GPLv3 / CC BY 3.0 | easylist.to | ❌ 미포함 | 스페인어/포르투갈어 사이트용 |
| 8 | Fanboy's Turkish | CC BY 3.0 | fanboy.co.nz | ❌ 미포함 | 터키어 사이트용 |
| 9 | Bulgarian list | GNU GPLv3 | stanev.org/abp | ❌ 미포함 | 불가리아어 사이트용 |
| 10 | EasyList China | GNU GPLv3 / CC BY 3.0 | abpchina.org | ❌ 미포함 | 중국어 사이트용 |
| 11 | EasyList Czech and Slovak | CC BY 4.0 | adblock.sk | ❌ 미포함 | 체코어/슬로바키아어 사이트용 |
| 12 | EasyList Italy | GNU GPLv3 / CC BY 3.0 | easylist.to | ❌ 미포함 | 이탈리아어 사이트용 |
| 13 | Latvian List | CC BY 4.0 | notabug.org/latvian-list/adblock-latvian | ❌ 미포함 | 라트비아어 사이트용 |
| 14 | EasyList Polish | GNU GPLv3 / CC BY 3.0 | fb.com/adblockpl | ❌ 미포함 | 폴란드어 사이트용 |
| 15 | Estonian List | CC BY 1.0 | adblock.ee | ❌ 미포함 | 에스토니아어 사이트용 |
| 16 | Liste FR | CC BY-NC-SA 3.0 | adblock.ee | ❌ 미포함 | 프랑스어 사이트용 |
| 17 | Hufilter (Hungarian) | CC BY 4.0 | adblock.ee | ❌ 미포함 | 헝가리어 사이트용 |
| 18 | Adblock-Persian List | See source | github.com/MasterKia/PersianBlocker | ❌ 미포함 | 페르시아어 사이트용 |
| 19 | Frellwit's Swedish Filter | GNU GPLv3 | github.com/lassekongo83/Frellwit-s-filter-lists | ❌ 미포함 | 스웨덴어 사이트용 |
| 20 | **Fanboy's Korean** | CC BY 3.0 | fanboy.co.nz | ✅ 직접 내장 | **한국 광고 그룹** (`fanboy-korean.txt`) |
| 21 | ABPVN List | GNU GPLv3 | abpvn.com | ❌ 미포함 | 베트남어 사이트용 |
| 22 | Finnish List | Unlicense | github.com/finnish-easylist-addition | ❌ 미포함 | 핀란드어 사이트용 |
| 23 | AdBlockID | GNU GPLv3 | github.com/realodix/AdBlockID | ❌ 미포함 | 인도네시아/말레이시아 사이트용 |
| 24 | Liste AR | See source | github.com/easylist/listear | ❌ 미포함 | 아랍어 사이트용 |
| 25 | EasyList Hebrew | See source | github.com/easylist/EasyListHebrew | ❌ 미포함 | 히브리어 사이트용 |
| 26 | EasyList Lithuania | See source | github.com/EasyList-Lithuania | ❌ 미포함 | 리투아니아어 사이트용 |
| 27 | EasyList Thailand | See source | github.com/easylist-thailand | ❌ 미포함 | 태국어 사이트용 |
| 28 | Ukrainian filter | See source | github.com/AdguardTeam/AdguardFilters | ❌ 미포함 | 우크라이나어 사이트용 |
| 29 | ROList | See source | zoso.ro/rolist | ❌ 미포함 | 루마니아어 사이트용 |
| 30 | Dandelion Sprout's Nordic | See source | github.com/DandelionSprout/adfilt | ❌ 미포함 | 북유럽 언어 사이트용 |
| 31 | IndianList | See source | github.com/nicepersonality/IndianList | ❌ 미포함 | 힌디어 사이트용 |
| 32 | Dandelion Serbo-Croatian | See source | github.com/DandelionSprout/adfilt | ❌ 미포함 | 세르비아/크로아티아 사이트용 |
| 33 | Macedonian filter | See source | github.com/DeepSpaceHarbor/Macedonian-adBlock-Filters | ❌ 미포함 | 마케도니아어 사이트용 |
| 34 | **Fanboy's Annoyance List** | GNU GPLv3 / CC BY 3.0 | fanboy.co.nz | ✅ 직접 내장 | **성가신 요소 그룹** (`fanboy-annoyance.txt`) |
| 35 | Adblock Warning Removal List | See source | easylist.to | 🔧 코드 대체 | `anti-bypass.js`로 감지 경고/베이트 요소 숨김 구현 |
| 36 | Popups | See source | github.com/AdguardTeam/AdguardFilters | ❌ 미포함 | 팝업 차단 — `filehost-blocker.js` 등이 일부 담당 |
| 37 | Other Annoyances | See source | github.com/AdguardTeam/AdguardFilters | ❌ 미포함 | 기타 성가신 요소 |
| 38 | Cookie Notices | See source | github.com/AdguardTeam/AdguardFilters | ❌ 미포함 | 쿠키 동의 배너 |
| 39 | Dandelion Sprout's Annoyances | See source | github.com/DandelionSprout/adfilt | ❌ 미포함 | 기타 성가신 요소 |

---

## 3. 개인정보 보호 필터 (3개)

| # | 필터 이름 | 라이선스 | 크레딧 URL | 상태 | 내장 위치 / 사유 |
|---|-----------|----------|------------|------|------------------|
| 1 | Ultimate Privacy Filter | GNU GPLv3 / CC BY 3.0 | easylist.to | 🔄 대체 | EasyPrivacy가 **광고 차단 그룹**에 포함되어 동일 역할 |
| 2 | **Fanboy's Social Blocking List** | GNU GPLv3 / CC BY 3.0 | easylist.to | ✅ 직접 내장 | **개인정보 그룹** (`fanboy-social.txt`) |
| 3 | URL Tracking filter | See source | github.com/AdguardTeam/AdguardFilters | 🔄 대체 | AdGuard URL Tracking filter(`17.txt`)를 **개인정보 그룹**에 내장. 단, `$removeparam` 위주라 DNR 변환은 157개뿐 |

---

## 4. 보안 필터 (4개)

| # | 필터 이름 | 라이선스 | 크레딧 URL | 상태 | 내장 위치 / 사유 |
|---|-----------|----------|------------|------|------------------|
| 1 | Ultimate Security Filter | MIT / CC0 1.0 | gitlab.com/malware-filter/urlhaus-filter | 🔄 대체 | URLhaus를 **보안 그룹**에 내장 (동일 기반) |
| 2 | **NoCoin** | MIT License | github.com/hoshsadiq/adblock-nocoin-list | ✅ 직접 내장 | **보안 그룹** (`nocoin.txt`) |
| 3 | Online Malicious URL Blocklist | See source | gitlab.com/malware-filter/urlhaus-filter | 🔄 대체 | URLhaus(`urlhaus-filter.txt`)를 **보안 그룹**에 내장 |
| 4 | Dandelion Sprout's Anti-Malware List | See source | github.com/DandelionSprout/adfilt | ❌ 미포함 | URLhaus로 악성 도메인 차단 대체 |

---

## 5. 미포함 이유 범주

| 이유 | 해당 필터 수 | 해당 항목 |
|------|-------------|------|
| **지역별 언어 필터** | 30개 | RuAdList ~ Macedonian (표 #3~#19, #21~#33) |
| **성가신 요소 (미포함)** | 4개 | Popups, Other Annoyances, Cookie Notices, Dandelion Sprout's Annoyances |
| **보안 (중복)** | 1개 | Dandelion Sprout's Anti-Malware List |

> 미포함 합계: 30 + 4 + 1 = **35개**
> (전체 46개 = 직접 내장 6 + 대체 4 + 코드 대체 1 + 미포함 35)

**성가신 요소 미포함 상세**:

| 필터 | 사유 |
|------|------|
| Popups | `filehost-blocker.js`가 **파일 공유 사이트(gigafile/gofile 등)에 한정해** 팝업을 차단. 일반 사이트 팝업은 미대응 |
| Other Annoyances | `general-blocker.js`가 일부 인라인 광고만 숨김. 전체 대응은 하지 않음 |
| Cookie Notices | 별도 대체 코드 없음 (쿠키 동의 배너 미처리) |
| Dandelion Sprout's Annoyances | Fanboy's Annoyance와 역할 중복 |

> **정정 사항**: 이전 초안에는 "쿠키 동의 → 일부 general-blocker.js"라고 적었으나, `general-blocker.js`를 확인한 결과 **쿠키/consent 관련 코드가 전혀 없었습니다.** 위 표로 바로잡습니다.

### 기술적 이유 (공통)

1. **대상 시스템**: 이 확장은 PC 크롬에서 유튜브/한국 사이트 중심으로 설계됨
2. **동적 규칙 한도**: Chrome DNR 동적 규칙은 30,000개 제한. 지역별 필터를 모두 넣으면 한도 초과
3. **DNR 변환 한계**: 지역별 필터는 cosmetic(요소 숨김) 규칙이 대부분이라 네트워크 차단용 DNR로 변환 가능한 비율이 낮음
4. **유지보수 비용**: 35개 미포함 소스의 URL/형식 변경을 추적해야 함

---

## 6. 나중에 추가할 경우 참고

추가 가능한 후보 (우선순위 낮음):

| 필터 | 이유 | 추가 시 작업 |
|------|------|-------------|
| Fanboy's Japanese | 일본 사이트 이용 시 유용 | `build-filters.js`에 소스 추가 → 재빌드 |
| EasyList China | 중국 사이트 이용 시 유용 | 동일 |
| Cookie Notices | 쿠키 배너 차단 강화 | 동일 (단, DNR 변환률 확인 필요) |

추가 절차:
1. `tools/build-filters.js`의 해당 그룹 `sources` 배열에 정확한 다운로드 URL 추가
2. `node tools/build-filters.js --group=<그룹>` 재빌드
3. `node tools/validate-rules.js` 검증
4. 확장 재로드(↻)

---

## 7. 관련 문서

- `docs/filter-update-plan.md` — 필터 업데이트 기능 기획·보안 문서 (그룹별 정확한 다운로드 URL 수록)
- `README.md` — 프로젝트 개요, 필터 출처, 라이선스
- AdBlocker Ultimate 공식 필터 페이지: https://adblockultimate.net/ko/filters