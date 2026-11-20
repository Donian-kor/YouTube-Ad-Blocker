// options/main.js - 설정 페이지 진입점
import { initStats } from "./stats.js";
import { initFiltersTab } from "./filters-tab.js";
import { initBlockedTab } from "./blocked-tab.js";
import { initLicensesTab } from "./licenses-tab.js";

function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const content = document.getElementById("tab-" + btn.dataset.tab);
      if (content) content.classList.add("active");
    });
  });
}

initTabs();
initStats();
initFiltersTab();
initBlockedTab();
initLicensesTab();
