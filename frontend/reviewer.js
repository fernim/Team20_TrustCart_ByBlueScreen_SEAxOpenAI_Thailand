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
  function render(result) {
    const title = node("h2", result.listing_title || "ผลการตรวจสอบข้อมูลจำลอง");
    const fields = node("dl", undefined, "reviewer-summary");
    const field = (label, value) =>
      fields.append(node("dt", label), node("dd", value));
    field("รหัสรายงาน", result.id || "—");
    field(
      "สถานะ",
      ["APPROVED", "PENDING", "DENIED", "UNKNOWN"].includes(result.status)
        ? result.status
        : "UNKNOWN",
    );
    field("เหตุผลจากระบบ", result.reason || "ไม่มีเหตุผลในรายงาน");
    field(
      "ความเชื่อมั่น",
      Number.isFinite(result.confidence)
        ? `${Math.round(result.confidence * 100)}%`
        : "—",
    );
    field(
      "ส่งเจ้าหน้าที่ตรวจสอบ",
      result.human_review_required === false ? "ไม่ต้องส่งตรวจ" : "ต้องส่งตรวจ",
    );
    field("แหล่งข้อมูล", result.registry_source || "—");
    report.append(
      title,
      fields,
      node(
        "p",
        "ตรวจตัวตนและหมวดหมู่ในทะเบียนจำลอง พร้อมกฎ R-03 แบบจำกัดสำหรับคำกล่าวอ้างเกินจริง ไม่ใช่การรับรองสินค้า บัญชีผู้ขาย หรือการรับรองตามกฎหมาย",
        "dialog-note",
      ),
      node("h3", "บันทึกลำดับการตรวจสอบ"),
      node(
        "p",
        "แสดงแฮชที่ระบบบันทึกไว้ หน้านี้ไม่ได้ตรวจสอบความถูกต้องของสายแฮชซ้ำ",
        "dialog-note",
      ),
    );
    if (Array.isArray(result.claim_findings) && result.claim_findings.length) {
      const findings = node("ul", undefined, "reviewer-findings");
      for (const finding of result.claim_findings) {
        const row = node("li");
        row.append(
          node("strong", `${finding.rule_id} · ${finding.code}`),
          node("p", finding.reason_th),
          node("blockquote", finding.phrase),
          node(
            "small",
            finding.source === "title"
              ? "พบในชื่อสินค้า"
              : "พบในคำอธิบายสินค้า",
          ),
        );
        findings.append(row);
      }
      report.insertBefore(
        node("h3", "เหตุผลที่ไม่ผ่าน R-03"),
        report.children[2],
      );
      report.insertBefore(findings, report.children[3]);
    }
    const trace = Array.isArray(result.trace) ? result.trace : [];
    const list = node("ol", undefined, "reviewer-trace");
    for (const entry of trace) {
      if (!entry || typeof entry !== "object") continue;
      const row = node("li");
      row.append(
        node("strong", `${entry.step || "—"} · ${entry.outcome || "—"}`),
        node("time", entry.at || "—"),
      );
      const hashes = node("details");
      hashes.append(
        node("summary", "แฮชของบันทึก"),
        node("p", "แฮชก่อนหน้า"),
        node("code", entry.previous_hash || "บันทึกแรก"),
        node("p", "แฮชรายการนี้"),
        node("code", entry.chain_hash || "—"),
      );
      row.append(hashes);
      list.append(row);
    }
    report.append(
      trace.length ? list : node("p", "ไม่มีบันทึกลำดับการตรวจสอบในรายงาน"),
      node("h3", "แฮชสุดท้ายของสายบันทึก"),
      node("code", result.chain_hash || "—"),
    );
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
      render(result);
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
