"use strict";
(() => {
  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function render(report, result, options = {}) {
    const title = node("h2", result.listing_title || "ผลการตรวจสอบสินค้า");
    const stepper = node("ol", undefined, "review-stepper");
    const traceEntries = Array.isArray(result.trace) ? result.trace : [];
    const stages = [
      [
        "R-01",
        "ตรวจตัวตนสินค้า",
        "ชื่อสินค้าและผู้ถือใบอนุญาตต้องตรงกับทะเบียน",
        "แก้ไขชื่อสินค้า ผู้ถือใบอนุญาต หรือเลขอ้างอิงให้ตรงกับหลักฐาน",
      ],
      [
        "R-02",
        "ตรวจหมวดหมู่",
        "หมวดหมู่ต้องตรงกับทะเบียน",
        "แก้ไขหมวดหมู่สินค้าให้ตรงกับทะเบียน",
      ],
      [
        "R-03",
        "ตรวจคำโฆษณา",
        "ไม่พบถ้อยคำที่เข้าข่ายกฎตัวอย่าง",
        "แก้ไขชื่อและคำอธิบายเพื่อลบคำกล่าวอ้างเกินจริง แล้วส่งตรวจใหม่",
      ],
    ];
    const blockers = [];
    for (const [rule, label, passedText, action] of stages) {
      const entries = traceEntries.filter((entry) => entry.step === rule);
      const passed =
        entries.length > 0 &&
        entries.every((entry) => ["matched", "passed"].includes(entry.outcome));
      const state = !entries.length
        ? "not_checked"
        : passed
          ? "passed"
          : "blocked";
      const step = node("li", undefined, "review-step");
      step.dataset.rule = rule;
      step.dataset.state = state;
      step.append(
        node(
          "span",
          passed ? "✓" : state === "blocked" ? "!" : "—",
          "step-marker",
        ),
        node("h3", label),
        node(
          "span",
          `${rule} · ${passed ? "ผ่าน" : state === "blocked" ? "ไม่ผ่าน" : "ยังไม่ได้ตรวจ"}`,
          "step-state",
        ),
        node(
          "p",
          passed
            ? passedText
            : state === "blocked"
              ? action
              : "ระบบยังไม่มีผลตรวจขั้นตอนนี้ ต้องตรวจให้ครบก่อนยืนยัน",
        ),
      );
      stepper.append(step);
      if (!passed)
        blockers.push(state === "blocked" ? action : `ต้องตรวจ${label}ให้ครบ`);
    }
    const final = node("li", undefined, "review-step");
    const canConfirm =
      result.status === "APPROVED" &&
      result.confidence >= 0.75 &&
      result.human_review_required === false &&
      blockers.length === 0;
    final.dataset.state = canConfirm ? "passed" : "blocked";
    final.append(
      node("span", canConfirm ? "✓" : "!", "step-marker"),
      node("h3", "ยืนยันผลตรวจ"),
      node(
        "p",
        canConfirm
          ? "ผ่านเฉพาะกฎตัวอย่างที่ระบบรองรับ"
          : "ยังยืนยันไม่ได้ ต้องแก้ไขหรือให้เจ้าหน้าที่ตรวจสอบก่อน",
      ),
    );
    stepper.append(final);
    const actionBox = node("section", undefined, "review-next-action");
    actionBox.append(
      node("h3", canConfirm ? "ผลตรวจพร้อมแล้ว" : "อะไรทำให้ไปต่อไม่ได้?"),
      node(
        "p",
        blockers.length
          ? blockers.join(" • ")
          : canConfirm
            ? "ผลตรวจครอบคลุมเฉพาะกฎที่ระบบรองรับ ไม่ใช่การรับรองอย่างเป็นทางการ"
            : "ต้องตรวจสอบสถานะ ความเชื่อมั่น และการส่งเจ้าหน้าที่ก่อนยืนยัน",
      ),
    );
    report.append(stepper, actionBox);
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
        "ตรวจตัวตน หมวดหมู่ และคำกล่าวอ้างตามกฎที่ระบบรองรับ ไม่ใช่การรับรองสินค้า บัญชีผู้ขาย หรือการรับรองตามกฎหมาย",
        "dialog-note",
      ),
    );
    report.prepend(title);
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
      report.insertBefore(node("h3", "เหตุผลที่ไม่ผ่าน R-03"), fields);
      report.insertBefore(findings, fields);
    }
    if (options.audit === false) return;
    report.append(
      node("h3", "บันทึกลำดับการตรวจสอบ"),
      node(
        "p",
        "แสดงแฮชที่ระบบบันทึกไว้ หน้านี้ไม่ได้ตรวจสอบความถูกต้องของสายแฮชซ้ำ",
        "dialog-note",
      ),
    );
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

  window.TrustCartVerification = { render };
})();
