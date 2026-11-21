"use strict";
(() => {
  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function render(report, result, options = {}) {
    const tr = (th, en) => document.documentElement.lang === "en" ? en : th;
    const title = node("h2", result.listing_title || tr("ผลการตรวจสอบสินค้า", "Product verification"));
    const stepper = node("ol", undefined, "review-stepper");
    const traceEntries = Array.isArray(result.trace) ? result.trace : [];
    const stages = [
      [
        "R-01",
        tr("ตรวจตัวตนสินค้า", "Product identity"),
        tr("ชื่อสินค้าและผู้ถือใบอนุญาตต้องตรงกับทะเบียน", "The product name and licence holder match the registry."),
        tr("แก้ไขชื่อสินค้า ผู้ถือใบอนุญาต หรือเลขอ้างอิงให้ตรงกับหลักฐาน", "Correct the product name, licence holder, or reference to match the evidence."),
      ],
      [
        "R-02",
        tr("ตรวจหมวดหมู่", "Product category"),
        tr("หมวดหมู่ต้องตรงกับทะเบียน", "The category matches the registry."),
        tr("แก้ไขหมวดหมู่สินค้าให้ตรงกับทะเบียน", "Correct the category to match the registry."),
      ],
      [
        "R-03",
        tr("ตรวจคำโฆษณา", "Advertising claims"),
        tr("ไม่พบถ้อยคำที่เข้าข่ายกฎตัวอย่าง", "The demo rules found no prohibited wording."),
        tr("แก้ไขชื่อและคำอธิบายเพื่อลบคำกล่าวอ้างเกินจริง แล้วส่งตรวจใหม่", "Remove unsupported claims from the title and description, then submit again."),
      ],
    ];
    const blockers = [];
    for (const [rule, label, passedText, action] of stages) {
      const entries = traceEntries.filter((entry) => entry.step === rule);
      const ruleResult = Array.isArray(result.rule_results)
        ? result.rule_results.find(item => item.rule === rule) : null;
      const passed =
        ruleResult ? ruleResult.result === "pass" : entries.length > 0 &&
        entries.every((entry) => ["matched", "passed"].includes(entry.outcome));
      const state = !entries.length && !ruleResult
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
          `${rule} · ${passed ? tr("ผ่าน", "Passed") : state === "blocked" ? tr("ไม่ผ่าน", "Blocked") : tr("ยังไม่ได้ตรวจ", "Unchecked")}`,
          "step-state",
        ),
        node(
          "p",
          passed
            ? passedText
            : state === "blocked"
              ? action
              : tr("ระบบยังไม่มีผลตรวจขั้นตอนนี้ ต้องตรวจให้ครบก่อนยืนยัน", "This check has no result. Complete it before confirming."),
        ),
      );
      stepper.append(step);
      if (!passed)
        blockers.push(state === "blocked" ? action : tr(`ต้องตรวจ${label}ให้ครบ`, `Complete this check: ${label}`));
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
      node("h3", tr("ยืนยันผลตรวจ", "Confirm verification")),
      node(
        "p",
        canConfirm
          ? tr("ผ่านเฉพาะกฎตัวอย่างที่ระบบรองรับ", "The supported demo rules passed.")
          : tr("ยังยืนยันไม่ได้ ต้องแก้ไขหรือให้เจ้าหน้าที่ตรวจสอบก่อน", "Correct the listing or send it for review before confirming."),
      ),
    );
    stepper.append(final);
    const actionBox = node("section", undefined, "review-next-action");
    actionBox.append(
      node("h3", canConfirm ? tr("ผลตรวจพร้อมแล้ว", "Verification complete") : tr("อะไรทำให้ไปต่อไม่ได้?", "What needs attention?")),
      node(
        "p",
        blockers.length
          ? blockers.join(" • ")
          : canConfirm
            ? tr("ผลตรวจครอบคลุมเฉพาะกฎที่ระบบรองรับ ไม่ใช่การรับรองอย่างเป็นทางการ", "The result covers the supported demo checks only.")
            : tr("ต้องตรวจสอบสถานะ ความเชื่อมั่น และการส่งเจ้าหน้าที่ก่อนยืนยัน", "Review the status, confidence, and reviewer routing before confirming."),
      ),
    );
    report.append(stepper, actionBox);
    const fields = node("dl", undefined, "reviewer-summary");
    const field = (label, value) =>
      fields.append(node("dt", label), node("dd", value));
    field(tr("รหัสรายงาน", "Report ID"), result.id || "—");
    field(
      tr("สถานะ", "Status"),
      ["APPROVED", "PENDING", "DENIED", "UNKNOWN"].includes(result.status)
        ? result.status
        : "UNKNOWN",
    );
    field(tr("เหตุผลจากระบบ", "Decision reason"), result.reason || tr("ไม่มีเหตุผลในรายงาน", "No reason was recorded."));
    field(
      tr("ความเชื่อมั่น", "Confidence"),
      Number.isFinite(result.confidence)
        ? `${Math.round(result.confidence * 100)}%`
        : "—",
    );
    field(
      tr("ส่งเจ้าหน้าที่ตรวจสอบ", "Human review"),
      result.human_review_required === false ? tr("ไม่ต้องส่งตรวจ", "Not required") : tr("ต้องส่งตรวจ", "Required"),
    );
    field(tr("แหล่งข้อมูล", "Registry source"), result.registry_source || "—");
    report.append(
      title,
      fields,
      node(
        "p",
        tr("ตรวจตัวตน หมวดหมู่ และคำกล่าวอ้างตามกฎที่ระบบรองรับ ไม่ใช่การรับรองสินค้า บัญชีผู้ขาย หรือการรับรองตามกฎหมาย", "These demo checks cover identity, category, and advertising claims. Official certification is outside their scope."),
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
          node("p", tr(finding.reason_th, finding.reason_en || finding.reason_th)),
          node("blockquote", finding.phrase),
          node(
            "small",
            finding.source === "title"
              ? tr("พบในชื่อสินค้า", "Found in the product title")
              : tr("พบในคำอธิบายสินค้า", "Found in the product description"),
          ),
        );
        findings.append(row);
      }
      report.insertBefore(node("h3", tr("เหตุผลที่ไม่ผ่าน R-03", "Why R-03 failed")), fields);
      report.insertBefore(findings, fields);
    }
    if (options.audit === false) return;
    report.append(
      node("h3", tr("บันทึกลำดับการตรวจสอบ", "Audit trail")),
      node(
        "p",
        tr("แสดงแฮชที่ระบบบันทึกไว้ หน้านี้ไม่ได้ตรวจสอบความถูกต้องของสายแฮชซ้ำ", "This page shows the hashes saved in the audit trail. Use the audit check to validate the chain."),
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
        node("summary", tr("แฮชของบันทึก", "Entry hashes")),
        node("p", tr("แฮชก่อนหน้า", "Previous hash")),
        node("code", entry.previous_hash || tr("บันทึกแรก", "First entry")),
        node("p", tr("แฮชรายการนี้", "Entry hash")),
        node("code", entry.chain_hash || "—"),
      );
      row.append(hashes);
      list.append(row);
    }
    report.append(
      trace.length ? list : node("p", tr("ไม่มีบันทึกลำดับการตรวจสอบในรายงาน", "No audit entries were saved in this report.")),
      node("h3", tr("แฮชสุดท้ายของสายบันทึก", "Final chain hash")),
      node("code", result.chain_hash || "—"),
    );
  }

  window.TrustCartVerification = { render };
})();
