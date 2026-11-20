// options/licenses-tab.js - 출처 및 라이선스 표
import { LICENSE_TABLE } from "./config.js";

export function initLicensesTab() {
  const tbody = document.getElementById("licenseTable");
  tbody.textContent = "";

  LICENSE_TABLE.forEach((item) => {
    const row = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = item.name;
    row.appendChild(name);

    const src = document.createElement("td");
    src.textContent = item.source;
    row.appendChild(src);

    const license = document.createElement("td");
    license.textContent = item.license;
    row.appendChild(license);

    tbody.appendChild(row);
  });
}
