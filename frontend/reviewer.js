"use strict";
// Read-only presentation of stored backend decisions. No status or hash is invented.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const report = $("#reviewer-report");
  let requestVersion = 0;
  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  async function load(event) {
    event?.preventDefault();
    const version = ++requestVersion;
    report.replaceChildren();
    $("#reviewer-error").hidden = true;
    const id = $("#report-id").value.trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      $("#reviewer-error").textContent = "กรุณาระบุรหัสรายงาน UUID ที่ถูกต้อง";
      $("#reviewer-error").hidden = false;
      $("#reviewer-loading").hidden = true;
      return;
    }
    $("#reviewer-loading").hidden = false;
    try {
      const response = await window.fetch(
        `/v1/verifications/${encodeURIComponent(id)}`,
      );
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "ไม่พบรายงานนี้"
            : "ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่",
        );
      const result = await response.json();
      if (version !== requestVersion) return;
      if (!result || typeof result !== "object" || result.id !== id)
        throw new Error("ข้อมูลรายงานไม่ตรงกับรหัสที่ร้องขอ");
      window.TrustCartVerification.render(report, result);
    } catch (error) {
      if (version !== requestVersion) return;
      report.replaceChildren();
      $("#reviewer-error").textContent =
        error.message || "ไม่สามารถโหลดรายงานได้";
      $("#reviewer-error").hidden = false;
    } finally {
      if (version === requestVersion) $("#reviewer-loading").hidden = true;
    }
  }
  $("#report-lookup").addEventListener("submit", load);
  try {
    const entries = JSON.parse(
      window.sessionStorage.getItem("trustcart-demo-reports") || "[]",
    );
    if (Array.isArray(entries))
      for (const entry of entries) {
        if (!entry || typeof entry.id !== "string") continue;
        const option = node(
          "option",
          `${entry.title || entry.id} · ${entry.status || "UNKNOWN"}`,
        );
        option.value = entry.id;
        $("#demo-report-select").append(option);
        $("#demo-reports").hidden = false;
      }
  } catch (_) {
    /* Manual lookup remains available. */
  }
  $("#demo-report-select").addEventListener("change", () => {
    if (!$("#demo-report-select").value) return;
    $("#report-id").value = $("#demo-report-select").value;
    load();
  });
  const initial = new URLSearchParams(window.location.search).get("id");
  if (initial) {
    $("#report-id").value = initial;
    load();
  }
})();
