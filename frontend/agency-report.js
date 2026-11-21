"use strict";
window.TrustCartAgencyReport = (() => {
  const ui = window.AgencyUI,
    api = window.TrustCartSession,
    $ = (s) => document.querySelector(s);
  ui.init();
  const id = decodeURIComponent(location.pathname.split("/").pop()),
    base = "/v1/reviewer/submissions/" + encodeURIComponent(id),
    query = ui.returnQuery();
  if (!query.has("work_queue")) query.set("work_queue", "to_review");
  $("#back-to-queue").href = "/agency?" + query;
  let selected = null,
    revisions = [],
    busy = false,
    blocked = false,
    authorized = false,
    errorKey = null,
    feedbackKey = null,
    replayIndex = null;
  const milestones = {
    submission_snapshot: "replay_submitted",
    document_uploaded: "replay_uploaded",
    document_assessment: "replay_assessed",
    assessment_unavailable: "replay_unavailable",
    review_started: "replay_review",
    submission_superseded: "replay_superseded",
  };
  function replayLabel(event) {
    if (event.step !== "human_review")
      return Object.hasOwn(milestones, event.step) ? milestones[event.step] : null;
    let decision;
    try {
      decision = JSON.parse(event.outcome)?.decision;
    } catch (_) {
      return "replay_review_recorded";
    }
    if (decision === "approve") return "replay_approved";
    if (decision === "deny") return "replay_denied";
    if (decision === "request_documents") return "replay_requested";
    return "replay_review_recorded";
  }
  function renderReplay(report) {
    const list = $("#decision-replay-steps"),
      detail = $("#decision-replay-detail"),
      unavailable = $("#decision-replay-unavailable"),
      result = $("#decision-replay-result"),
      valid = report.audit?.valid === true,
      steps = valid
        ? report.trace.map((entry) => ({ key: replayLabel(entry), at: entry.at })).filter((entry) => entry.key)
        : [];
    list.replaceChildren();
    detail.replaceChildren();
    result.replaceChildren();
    detail.hidden = !steps.length;
    unavailable.hidden = Boolean(steps.length);
    unavailable.textContent = ui.t(valid ? "replay_empty" : "replay_withheld");
    if (!steps.length) return;
    const status = ui.node("strong", ui.t(report.status), "agency-status");
    status.dataset.status = report.status;
    result.append(status);
    const buttons = steps.map((step, index) => {
      const item = ui.node("li");
      const button = ui.node("button", ui.t(step.key));
      button.type = "button";
      button.onclick = () => select(index);
      item.append(button);
      list.append(item);
      return button;
    });
    function select(index) {
      replayIndex = index;
      buttons.forEach((button, i) =>
        button.setAttribute("aria-pressed", String(index === i)),
      );
      const event = steps[index];
      const time = ui.node("time", ui.date(event.at));
      if (event.at && Number.isFinite(Date.parse(event.at))) time.dateTime = event.at;
      detail.replaceChildren(ui.node("strong", ui.t(event.key)), time);
    }
    select(Math.min(replayIndex ?? steps.length - 1, steps.length - 1));
  }
  const fieldNames = [
    "product_name",
    "registration_reference",
    "license_holder",
  ];
  function message(key) {
    errorKey = key;
    $("#report-error").hidden = !key;
    $("#report-error").textContent = key ? ui.t(key) : "";
  }
  function feedback(key) {
    feedbackKey = key;
    $("#report-feedback").hidden = !key;
    $("#report-feedback").textContent = key ? ui.t(key) : "";
  }
  function dirty() {
    return Boolean(
      $("#review-note").value ||
      fieldNames.some((k) => $("#confirm-" + k).value) ||
      $("#confirm-documents input:checked"),
    );
  }
  function resetInputs() {
    $("#decision-form").reset();
  }
  function setBusy(value) {
    busy = value;
    $("#refresh-report").disabled = value;
    document
      .querySelectorAll("#start-review,#decision-form button")
      .forEach((el) => (el.disabled = value || blocked));
  }
  function summaryPair(target, label, value) {
    target.append(ui.node("dt", ui.t(label)), ui.node("dd", value));
  }
  function render() {
    if (!selected) return;
    const r = selected;
    renderReplay(r);
    $("#case-title").textContent = r.listing_title;
    $("#case-reference").textContent =
      `${r.marketplace === "shopee" ? "Shopee" : r.marketplace === "lazada" ? "Lazada" : r.marketplace} · ${r.shop_name} · ${ui.t("revision")} ${r.revision}`;
    $("#report-historical").hidden = r.is_current;
    $("#case-next-action").textContent = ui.next(r.stage);
    const overview = $("#case-overview");
    overview.replaceChildren();
    const dl = ui.node("dl", undefined, "agency-case-summary");
    for (const [key, value] of [
      ["result", ui.t(r.status)],
      ["stage", ui.t(r.stage)],
      ["updated", ui.date(r.updated_at || r.created_at)],
      [
        "mode",
        ui.t(
          r.mode === "replay"
            ? "replay"
            : r.mode === "live"
              ? "live"
              : "not_assessed",
        ),
      ],
    ])
      summaryPair(dl, key, value);
    overview.append(dl);
    if (r.review_note)
      overview.append(ui.node("p", r.review_note, "agency-notice"));
    const snapshot = ui.node("details");
    snapshot.append(ui.node("summary", ui.t("snapshot")));
    const fields = ui.node("dl", undefined, "agency-case-summary");
    for (const key of [
      "product_name",
      "registration_reference",
      "license_holder",
      "description",
      "category",
    ])
      summaryPair(fields, key, r.listing[key] || "—");
    snapshot.append(fields);
    overview.append(snapshot);
    const productLink = ui.node("a", ui.t("view_product"), "agency-text");
    productLink.href = "/products/" + encodeURIComponent(r.product_id);
    productLink.target = "_blank";
    productLink.rel = "noopener";
    overview.append(productLink);
    const docs = $("#case-documents");
    docs.replaceChildren();
    for (const doc of r.documents) {
      const a = ui.node("a", undefined, "agency-document");
      a.href = "/v1/documents/" + encodeURIComponent(doc.id);
      a.target = "_blank";
      a.rel = "noopener";
      a.append(
        ui.node("strong", ui.t(doc.kind)),
        ui.node("span", doc.filename),
        ui.node("span", "↗"),
      );
      docs.append(a);
    }
    if (!r.documents.length)
      docs.append(ui.node("p", ui.t("no_docs"), "agency-muted"));
    const missing = (r.required_documents || []).filter(
      (kind) => !r.documents.some((doc) => doc.kind === kind),
    );
    if (missing.length)
      docs.append(
        ui.node(
          "p",
          ui.t("missing_docs") + ": " + missing.map(ui.t).join(", "),
          "agency-notice",
        ),
      );
    const checks = $("#case-checks");
    checks.replaceChildren();
    if (window.TrustCartChecklist) checks.append(window.TrustCartChecklist.render(r, ui.lang));
    if (!r.rule_results.length)
      checks.append(ui.node("p", ui.t("no_checks"), "agency-muted"));
    for (const rule of r.rule_results) {
      const block = ui.node("article", undefined, "agency-rule");
      block.dataset.result = rule.result;
      const title = ui.node("div");
      title.append(
        ui.node("strong", rule.rule),
        ui.node(
          "span",
          ui.t(
            rule.result === "pass"
              ? "pass"
              : rule.result === "fail"
                ? "fail"
                : "skip_check",
          ),
          "agency-status",
        ),
      );
      block.append(
        title,
        ui.node(
          "p",
          rule[ui.lang === "th" ? "reason_th" : "reason_en"] ||
            rule.reason ||
            "—",
        ),
      );
      for (const match of [
        ...(rule.evidence?.matches || []),
        ...(rule.evidence?.overclaims || []),
      ])
        block.append(ui.node("blockquote", match.phrase));
      if (rule.evidence?.missing_required_term)
        block.append(
          ui.node(
            "p",
            ui.lang === "th"
              ? "ขาดคำระบุหมวดหมู่: ผลิตภัณฑ์เสริมอาหาร"
              : "Missing category wording: ผลิตภัณฑ์เสริมอาหาร",
          ),
        );
      checks.append(block);
    }
    const findings = $("#case-findings");
    findings.replaceChildren();
    if (!r.assessment)
      findings.append(ui.node("p", ui.t("not_assessed"), "agency-muted"));
    else {
      findings.append(
        ui.node(
          "p",
          `${Math.round(r.assessment.confidence * 100)}% · ${ui.t("confidence")}`,
          "agency-muted",
        ),
      );
      for (const text of [
        ...(r.assessment.missing || []),
        ...(r.assessment.inconsistencies || []),
      ])
        findings.append(ui.node("p", text, "agency-notice"));
      for (const finding of r.assessment.documents || []) {
        const block = ui.node("article", undefined, "agency-finding");
        block.append(
          ui.node(
            "h3",
            r.documents.find((d) => d.id === finding.document_id)?.filename ||
              finding.document_id,
          ),
        );
        const fields = ui.node("dl", undefined, "agency-case-summary");
        for (const [key, value] of Object.entries(finding.fields || {}))
          summaryPair(fields, key, value || "—");
        block.append(fields);
        if (finding.advertising_permit)
          block.append(
            ui.node("p", ui.t("permit") + ": " + finding.advertising_permit),
          );
        for (const text of finding.uncertainties || [])
          block.append(ui.node("p", text, "agency-notice"));
        for (const quote of finding.quotes || [])
          block.append(
            ui.node(
              "blockquote",
              `${ui.t("page")} ${quote.page} · ${ui.t(quote.field)}: “${quote.quote}”`,
            ),
          );
        findings.append(block);
      }
    }
    const history = $("#case-history");
    history.replaceChildren();
    for (const item of revisions) {
      const a = ui.node(
        "a",
        `${ui.t("revision")} ${item.revision} · ${ui.t(item.status)} · ${ui.date(item.created_at)}`,
        "agency-revision",
      );
      a.href =
        "/agency/submissions/" + encodeURIComponent(item.id) + "?" + query;
      if (item.id === r.id) a.setAttribute("aria-current", "page");
      history.append(a);
    }
    if (!revisions.length)
      history.append(ui.node("p", ui.t("no_history"), "agency-muted"));
    $("#audit-validity").textContent = ui.t(
      r.audit?.valid ? "audit_valid" : "audit_invalid",
    );
    $("#audit-trace").textContent = JSON.stringify(r.trace, null, 2);
    const checked = new Set(
      [...document.querySelectorAll("#confirm-documents input:checked")].map(
        (el) => el.value,
      ),
    );
    const confirms = $("#confirm-documents");
    confirms.replaceChildren();
    for (const doc of r.documents) {
      const label = ui.node("label", undefined, "agency-confirm-document"),
        check = ui.node("input");
      check.type = "checkbox";
      check.value = doc.id;
      check.checked = checked.has(doc.id);
      label.append(
        check,
        ui.node("span", `${ui.t("inspect")}: ${doc.filename}`),
      );
      confirms.append(label);
    }
    for (const name of r.manual_review_checks || []) {
      const label = ui.node("label", undefined, "agency-confirm-document");
      const check = ui.node("input");
      check.type = "checkbox";
      check.value = name;
      check.dataset.manualCheck = name;
      check.checked = checked.has(name);
      const english = $("#agency-language").value === "en";
      label.append(check, ui.node("span", english
        ? (name === "documents" ? "I manually inspected the documents skipped by AI" : "I manually inspected the listing claims skipped by AI")
        : (name === "documents" ? "ตรวจเอกสารด้วยตนเองแทน AI ที่ข้ามแล้ว" : "ตรวจคำกล่าวอ้างด้วยตนเองแทน AI ที่ข้ามแล้ว")));
      confirms.append(label);
    }
    const writable = r.is_current && r.audit?.valid === true && !blocked;
    $("#start-review").hidden = !(
      writable && ["REVIEWER_REQUIRED", "UNAVAILABLE"].includes(r.stage)
    );
    $("#decision-form").hidden = !(writable && r.stage === "IN_REVIEW");
    $("#decision-readonly").hidden = !(
      $("#start-review").hidden && $("#decision-form").hidden
    );
    if (errorKey) message(errorKey);
    if (feedbackKey) feedback(feedbackKey);
    setBusy(busy);
  }
  async function load({ confirm = false } = {}) {
    if (!authorized || busy) return;
    if (confirm && dirty() && !window.confirm(ui.t("reload_confirm"))) return;
    setBusy(true);
    message(null);
    feedback(null);
    $("#report-loading").hidden = false;
    $("#case-content").hidden = true;
    try {
      const r = await (await api.api(base)).json();
      const history = await (await api.api(base + "/history")).json();
      selected = r;
      replayIndex = null;
      revisions = history;
      blocked = false;
      resetInputs();
      render();
      $("#case-content").hidden = false;
    } catch (e) {
      selected = null;
      blocked = true;
      message(e.status === 404 ? "not_found" : "error");
      $("#decision-form").hidden = true;
      $("#start-review").hidden = true;
      $("#case-title").textContent = ui.t("report");
      $("#case-reference").textContent = "";
    } finally {
      $("#report-loading").hidden = true;
      setBusy(false);
    }
  }
  async function mutate(path, payload) {
    if (!selected || busy || blocked) return;
    setBusy(true);
    message(null);
    feedback(null);
    try {
      await api.json(base + path, {
        chain_hash: selected.chain_hash,
        ...payload,
      });
      const latest = await (await api.api(base)).json();
      const history = await (await api.api(base + "/history")).json();
      selected = latest;
      replayIndex = null;
      revisions = history;
      resetInputs();
      render();
      feedback("saved");
    } catch (e) {
      if (e.status === 409) {
        blocked = true;
        message("stale");
      } else if (e.status === 401 || e.status === 403) {
        blocked = true;
        message("not_found");
      } else message("operation_failed");
    } finally {
      setBusy(false);
    }
  }
  const start = () => mutate("/start-review", {});
  $("#start-review").onclick = start;
  $("#refresh-report").onclick = () => load({ confirm: true });
  $("#decision-form").onsubmit = (e) => {
    e.preventDefault();
    const decision = e.submitter?.value;
    if (!["approve", "deny", "request_documents"].includes(decision)) return;
    const payload = { decision, note: $("#review-note").value };
    if (decision === "approve") {
      payload.confirmed_fields = Object.fromEntries(
        fieldNames.map((key) => [key, $("#confirm-" + key).value]),
      );
      payload.confirmed_documents = [
        ...document.querySelectorAll("#confirm-documents input:not([data-manual-check]):checked"),
      ].map((el) => el.value);
      payload.confirmed_manual_checks = [
        ...document.querySelectorAll("#confirm-documents input[data-manual-check]:checked"),
      ].map((el) => el.value);
    }
    mutate("/decision", payload);
  };
  window.addEventListener("agency-language", () => {
    render();
    if (errorKey) message(errorKey);
    if (feedbackKey) feedback(feedbackKey);
  });
  const ready = (async () => {
    authorized = Boolean(await ui.session());
    await load();
  })();
  return { ready, start, load };
})();
