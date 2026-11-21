"use strict";
window.TrustCartAgency = (() => {
  const ui = window.AgencyUI,
    api = window.TrustCartSession,
    $ = (s) => document.querySelector(s);
  ui.init();
  const params = ui.returnQuery();
  let queue = [
    "all",
    "to_review",
    "in_progress",
    "waiting_documents",
    "seller_correction",
    "completed",
  ].includes(params.get("work_queue"))
    ? params.get("work_queue")
    : "to_review";
  let marketplace = ["shopee", "lazada"].includes(params.get("marketplace"))
    ? params.get("marketplace")
    : "";
  let status = ["APPROVED", "PENDING", "DENIED", "UNKNOWN"].includes(
    params.get("status"),
  )
    ? params.get("status")
    : "";
  let search = (params.get("q") || "").slice(0, 200),
    data = null,
    request = 0,
    authorized = false;
  $("#queue-search").value = search;
  $("#filter-result").value = status;
  function query() {
    const p = new URLSearchParams({ work_queue: queue });
    if (marketplace) p.set("marketplace", marketplace);
    if (status) p.set("status", status);
    if (search) p.set("q", search);
    return p;
  }
  function render() {
    $("#queue-title").textContent = ui.t(queue);
    $("#queue-empty-hint").textContent = ui.t(
      marketplace === "lazada" ? "lazada_empty" : "empty_hint",
    );
    document
      .querySelectorAll("[data-queue]")
      .forEach((el) =>
        el.setAttribute(
          "aria-current",
          el.dataset.queue === queue ? "page" : "false",
        ),
      );
    document
      .querySelectorAll("[data-marketplace]")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          String(el.dataset.marketplace === marketplace),
        ),
      );
    document
      .querySelectorAll("[data-count]")
      .forEach(
        (el) =>
          (el.textContent = data
            ? String(data.counts[el.dataset.count] || 0)
            : "—"),
      );
    const body = $("#queue-body");
    body.replaceChildren();
    $(".agency-table-wrap").hidden = !data || !data.items.length;
    if (!data) return;
    for (const row of data.items) {
      const tr = ui.node("tr");
      tr.dataset.submission = row.id;
      const product = ui.node("td", undefined, "agency-product-cell");
      product.dataset.label = ui.t("product");
      const wrap = ui.node("div", undefined, "agency-product");
      const image = ui.node("img");
      image.src =
        row.listing.images?.[0] || "/static/assets/no-product-image.svg";
      image.alt = "";
      const copy = ui.node("div");
      const link = ui.node("a", row.listing_title, "case-title");
      link.href =
        "/agency/submissions/" + encodeURIComponent(row.id) + "?" + query();
      copy.append(
        link,
        ui.node("small", row.listing.registration_reference || "—"),
      );
      wrap.append(image, copy);
      product.append(wrap);
      const source = ui.node("td");
      source.dataset.label = ui.t("marketplace");
      source.append(
        ui.node(
          "strong",
          row.marketplace === "shopee"
            ? "Shopee"
            : row.marketplace === "lazada"
              ? "Lazada"
              : row.marketplace,
        ),
        ui.node("small", row.shop_name),
      );
      const stage = ui.node("td");
      stage.dataset.label = ui.t("stage");
      stage.append(
        ui.node("span", ui.t(row.stage), "agency-stage"),
        ui.node("small", ui.next(row.stage)),
      );
      const result = ui.node("td");
      result.dataset.label = ui.t("result");
      const badge = ui.node("span", ui.t(row.status), "agency-status");
      badge.dataset.status = row.status;
      result.append(badge);
      const updated = ui.node("td", ui.date(row.updated_at), "agency-date");
      updated.dataset.label = ui.t("updated");
      const action = ui.node("td");
      const open = ui.node("a", ui.t("open") + " →", "agency-open");
      open.href = link.href;
      action.append(open);
      tr.append(product, source, stage, result, updated, action);
      body.append(tr);
    }
    $("#queue-empty").hidden = Boolean(data.items.length);
    $("#queue-summary").textContent =
      `${data.items.length} / ${data.counts.all} · ${ui.t(queue)}`;
  }
  async function load() {
    if (!authorized) return;
    const ticket = ++request;
    $("#queue-loading").hidden = false;
    $("#queue-error").hidden = true;
    $("#queue-empty").hidden = true;
    $("#main").setAttribute("aria-busy", "true");
    try {
      const value = await (
        await api.api("/v1/reviewer/queue?" + query())
      ).json();
      if (ticket !== request) return;
      data = value;
      render();
    } catch (e) {
      if (ticket !== request) return;
      data = null;
      render();
      $("#queue-summary").textContent = "";
      $("#queue-error").hidden = false;
    } finally {
      if (ticket === request) {
        $("#queue-loading").hidden = true;
        $("#main").setAttribute("aria-busy", "false");
      }
    }
  }
  function change() {
    history.replaceState(null, "", "/agency?" + query());
    data = null;
    render();
    return load();
  }
  document.querySelectorAll("[data-queue]").forEach(
    (el) =>
      (el.onclick = () => {
        queue = el.dataset.queue;
        change();
      }),
  );
  document.querySelectorAll("[data-marketplace]").forEach(
    (el) =>
      (el.onclick = () => {
        marketplace = el.dataset.marketplace;
        change();
      }),
  );
  $("#queue-filters").onsubmit = (e) => {
    e.preventDefault();
    search = $("#queue-search").value.trim();
    change();
  };
  $("#filter-result").onchange = () => {
    status = $("#filter-result").value;
    change();
  };
  $("#clear-filters").onclick = () => {
    queue = "all";
    marketplace = "";
    status = "";
    search = "";
    $("#queue-search").value = "";
    $("#filter-result").value = "";
    change();
  };
  $("#refresh-queue").onclick = load;
  $("#retry-queue").onclick = load;
  window.addEventListener("agency-language", render);
  render();
  const ready = (async () => {
    authorized = Boolean(await ui.session());
    await load();
  })();
  setInterval(() => {
    if (
      authorized &&
      !document.hidden &&
      $("#main").getAttribute("aria-busy") !== "true"
    )
      load();
  }, 10000);
  return { ready, load };
})();
