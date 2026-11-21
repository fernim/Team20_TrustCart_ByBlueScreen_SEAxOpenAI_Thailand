"use strict";
// Read-only presentation of stored backend decisions. No status or hash is invented.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const tr = (th, en) => document.documentElement.lang === "en" ? en : th;
  const report = $("#reviewer-report");
  const messages = {
    invalid: ["กรุณาระบุรหัสรายงาน UUID ที่ถูกต้อง", "Enter a valid verification report UUID."],
    missing: ["ไม่พบรายงานนี้", "Report not found."],
    unavailable: ["ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่", "Could not load the report. Try again."],
    mismatch: ["ข้อมูลรายงานไม่ตรงกับรหัสที่ร้องขอ", "The report does not match the requested ID."],
  };
  let currentResult;
  let currentError;
  let requestVersion = 0;
  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function showError(key) {
    currentError = key;
    $("#reviewer-error").textContent = tr(...messages[key]);
    $("#reviewer-error").hidden = false;
  }
  function showResult(result) {
    currentResult = result;
    report.replaceChildren();
    if (result) window.TrustCartVerification.render(report, result);
  }
  async function load(event) {
    event?.preventDefault();
    const version = ++requestVersion;
    showResult(null);
    currentError = null;
    $("#reviewer-error").hidden = true;
    const id = $("#report-id").value.trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      showError("invalid");
      $("#reviewer-loading").hidden = true;
      return;
    }
    $("#reviewer-loading").hidden = false;
    try {
      const response = await window.fetch(
        `/v1/verifications/${encodeURIComponent(id)}`,
      );
      if (!response.ok)
        throw new Error(response.status === 404 ? "missing" : "unavailable");
      const result = await response.json();
      if (version !== requestVersion) return;
      if (!result || typeof result !== "object" || result.id !== id)
        throw new Error("mismatch");
      showResult(result);
    } catch (error) {
      if (version !== requestVersion) return;
      showResult(null);
      showError(Object.hasOwn(messages, error.message) ? error.message : "unavailable");
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
  let productsVersion = 0;
  let productsSnapshot = null;
  let productsLoading = false;
  async function loadProducts() {
    const version = ++productsVersion;
    productsLoading = true;
    const list = $("#reviewer-product-list");
    $("#reviewer-products-loading").hidden = list.childElementCount > 0;
    $("#reviewer-products-error").hidden = true;
    try {
      const response = await window.fetch("/v1/products", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const products = await response.json();
      if (version !== productsVersion) return;
      if (!Array.isArray(products)) throw new Error();
      const snapshot = JSON.stringify(products);
      if (snapshot === productsSnapshot) return;
      const rows = products.map(product => {
        if (!product?.listing || !product.verification?.id) throw new Error();
        const listing = product.listing;
        const title = listing.title || listing.product_name || product.id;
        const row = node("article", undefined, "reviewer-product-entry seller-product-entry");
        const photo = node("img", undefined, "seller-item-image");
        photo.src = listing.images?.[0] || "/static/assets/no-product-image.svg";
        photo.alt = title;
        photo.width = photo.height = 88;
        photo.loading = "lazy";
        const summary = node("div", undefined, "seller-item-summary");
        const metadata = node("div", undefined, "seller-item-metadata");
        const price = listing.price == null ? tr("ต้องระบุราคา", "Price required") : `฿${Number(listing.price).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const stock = listing.stock == null ? tr("ยังไม่ระบุสต็อก", "Stock unspecified") : tr(`สต็อก ${listing.stock} ชิ้น`, `Stock: ${listing.stock}`);
        const states = ["APPROVED", "PENDING", "DENIED", "UNKNOWN"];
        const state = states.includes(product.verification.status) ? product.verification.status : "UNKNOWN";
        const status = node("span", tr(`ผลตรวจ ${state}`, `Verification: ${state}`), "seller-item-status");
        status.dataset.status = state;
        metadata.append(node("span", price, "seller-item-price"), node("span", stock, "seller-item-stock"), status);
        summary.append(node("h3", title), metadata);
        const open = node("button", tr("เปิดรายงาน / Open report", "Open report"), "reviewer-open-report seller-view-action");
        open.type = "button";
        open.setAttribute("aria-label", `${open.textContent}: ${title}`);
        open.addEventListener("click", async () => {
          $("#report-id").value = product.verification.id;
          await load();
          if (report.childElementCount) report.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        row.append(photo, summary, open);
        return row;
      });
      productsSnapshot = snapshot;
      list.replaceChildren(...(rows.length ? rows : [node("p", tr("ยังไม่มีสินค้าที่บันทึกไว้", "There are no saved products yet."))]));
    } catch (_) {
      if (version !== productsVersion) return;
      productsSnapshot = null;
      list.replaceChildren();
      $("#reviewer-products-error").hidden = false;
    } finally {
      if (version === productsVersion) {
        productsLoading = false;
        $("#reviewer-products-loading").hidden = true;
      }
    }
  }
  $("#retry-reviewer-products").addEventListener("click", loadProducts);
  window.addEventListener("trustcart-languagechange", () => {
    showResult(currentResult);
    if (currentError) showError(currentError);
    productsSnapshot = null;
    loadProducts();
  });
  window.addEventListener("focus", loadProducts);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadProducts();
  });
  window.setInterval(() => { if (!document.hidden && !productsLoading) loadProducts(); }, 5000);
  loadProducts();
  const initial = new URLSearchParams(window.location.search).get("id");
  if (initial) {
    $("#report-id").value = initial;
    load();
  }
})();
