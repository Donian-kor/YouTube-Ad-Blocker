// options/licenses-tab.js - 출처 및 라이선스 표 (개별 필터 소스별)
import { LICENSE_TABLE } from "./config.js";

export function initLicensesTab() {
  const tbody = document.getElementById("licenseTable");
  tbody.textContent = "";

  LICENSE_TABLE.forEach((item) => {
    const row = document.createElement("tr");

    // 필터명
    const name = document.createElement("td");
    name.textContent = item.name;
    row.appendChild(name);

    // 그룹
    const group = document.createElement("td");
    group.textContent = item.group;
    row.appendChild(group);

    // 라이선스
    const license = document.createElement("td");
    license.textContent = item.license;
    row.appendChild(license);

    // 출처 주소 (클릭 가능한 링크)
    const source = document.createElement("td");
    if (item.url) {
      const link = document.createElement("a");
      link.textContent = item.url.replace(/^https?:\/\//, "");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      source.appendChild(link);
    }
    row.appendChild(source);

    tbody.appendChild(row);
  });
}
