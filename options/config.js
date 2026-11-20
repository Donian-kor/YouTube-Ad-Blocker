// options/config.js - 설정 페이지 공용 상수
// 필터 소스/그룹/카테고리는 shared/filter-registry.js 단일 진실 공급원에서 생성한다.
// 규칙 수는 빌드 시 생성된 shared/build-meta.js에서 가져온다.
import "../shared/filter-registry.js";
import "../shared/build-meta.js";

const REG = self.FilterRegistry;
const META = self.BuildMeta || {};
const counts = META.groups || {};
const sourceCounts = META.sources || {};

function countOfGroup(groupId) {
  return counts[groupId] || 0;
}
function countOfSource(sourceId) {
  return sourceCounts[sourceId] || 0;
}
function categoryOfSource(sourceId) {
  const s = REG.FILTER_REGISTRY.find((x) => x.id === sourceId);
  return s ? REG.FILTER_CATEGORIES.find((c) => c.id === s.category) : null;
}
function groupsOfCategory(categoryId) {
  return REG.FILTER_GROUPS.filter((g) => g.category === categoryId);
}
function categoryOf(groupId) {
  const g = REG.FILTER_GROUPS.find((x) => x.id === groupId);
  return g ? REG.FILTER_CATEGORIES.find((c) => c.id === g.category) : null;
}

// UI 상위 카테고리 (5개 토글)
export const FILTER_LIST = REG.FILTER_CATEGORIES.map((c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  icon: c.icon,
  locked: !!c.locked,
  filterCount: REG.FILTER_REGISTRY
    .filter((s) => s.category === c.id)
    .reduce((sum, s) => sum + countOfSource(s.id), 0),
}));

// 카테고리 펼침 시 표시할 소스 그룹 (10개)
export const GROUP_LIST = REG.FILTER_GROUPS.map((g) => ({
  id: g.id,
  name: g.name,
  description: g.description,
  icon: g.icon,
  category: g.category,
  filterCount: countOfGroup(g.id),
  locked: !!(categoryOf(g.id) && categoryOf(g.id).locked),
}));

// 잠금 소스 그룹 (대용량이라 항상 켜짐) — 레거시 참조용
export const LOCKED_SOURCE_GROUPS = new Set(GROUP_LIST.filter((g) => g.locked).map((g) => g.id));

// 개별 소스 (펼치기 시 표시, 소스별 토글 단위)
export const SOURCE_LIST = REG.FILTER_REGISTRY.map((s) => ({
  id: s.id,
  name: s.name,
  group: s.group,
  category: s.category,
  filterCount: countOfSource(s.id),
  locked: !!(categoryOfSource(s.id) && categoryOfSource(s.id).locked),
}));

// 잠금 소스 (국제 광고·보안 카테고리 소속)
export const LOCKED_SOURCES = new Set(SOURCE_LIST.filter((s) => s.locked).map((s) => s.id));

// 출처 및 라이선스 표 (레지스트리에서 자동 생성)
export const LICENSE_TABLE = REG.FILTER_REGISTRY.map((s) => ({
  name: s.name,
  group: (REG.FILTER_GROUPS.find((g) => g.id === s.group) || {}).name || s.group,
  license: s.license,
  url: s.url || "-",
}));
