"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const tr = (th, en) => document.documentElement.lang === "en" ? en : th;
  const messages = {
    changed: ["ข้อมูลมีการแก้ไข ต้องส่งตรวจใหม่ก่อนยืนยันสถานะ", "Listing changed. Run verification again before confirming the status."],
    invalidImage: ["เลือกรูป PNG, JPEG หรือ WebP ไม่เกิน 5 รูป และ 2 MB ต่อรูป", "Choose up to 5 PNG, JPEG, or WebP images, at most 2 MB each."],
    unreadableImage: ["ไม่สามารถอ่านรูปได้ กรุณาเลือกรูปอีกครั้ง", "Could not read the image. Choose it again."],
    loading: ["กำลังโหลดผลตรวจ…", "Loading verification…"],
    loaded: ["แสดงผลตรวจที่บันทึกไว้", "Showing the saved verification."],
    loadFailed: ["ไม่สามารถโหลดผลตรวจได้ กรุณาลองใหม่", "Could not load the verification. Try again."],
    reading: ["กำลังอ่านรูป กรุณารอสักครู่", "Reading images. Please wait."],
    draftSaved: ["บันทึกแบบร่างในเครื่องแล้ว ยังไม่ได้ตรวจสอบ", "Draft saved on this device. Verification is still required."],
    draftFailed: ["ไม่สามารถบันทึกแบบร่างในเครื่องได้", "Could not save the draft on this device."],
    checking: ["กำลังตรวจสอบสินค้า…", "Verifying product…"],
    saved: ["บันทึกผลตรวจแล้ว ดูสถานะและขั้นตอนที่ต้องแก้ไขด้านล่าง", "Verification saved. See the status and next steps below."],
    conflict: ["สินค้านี้ถูกแก้ไขแล้ว โหลดรายการล่าสุดก่อนบันทึกอีกครั้ง", "This product changed. Load the latest version before saving again."],
    invalid: ["ข้อมูลไม่ถูกต้อง ตรวจสอบรูปสินค้า ราคา และจำนวนคงเหลือ แล้วลองใหม่", "Check the product images, price, and stock, then try again."],
    failed: ["ไม่สามารถตรวจสอบได้ ไม่ได้ยืนยันสถานะผ่าน กรุณาลองใหม่", "Verification could not run. Try again to get a result."],
    draftLoaded: ["โหลดแบบร่างในเครื่องแล้ว ต้องส่งตรวจใหม่", "Local draft loaded. Submit it for verification."],
    newListing: ["เพิ่มสินค้าใหม่", "Started a new listing."],
  };
  let currentMessage;
  let currentResult;
  const ids = [
    "listing-title",
    "listing-description",
    "listing-category",
    "registration-reference",
    "registered-name",
    "license-holder",
  ];
  let images = [];
  let imageRequest = 0;
  let readingImages = false;
  let saving = false;
  let productsRequest = 0;
  function markDirty() {
    dirty = true;
    version++;
    showResult(null);
    feedback("changed");
  }
  function renderImages() {
    $("#image-previews").replaceChildren();
    images.forEach((src, index) => {
      const frame = document.createElement("div");
      const image = document.createElement("img");
      image.src = src;
      image.alt = tr(`รูปสินค้า ${index + 1}`, `Product image ${index + 1}`);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = tr(`ลบรูป ${index + 1}`, `Remove image ${index + 1}`);
      remove.disabled = saving || readingImages;
      remove.addEventListener("click", () => {
        if (saving || readingImages) return;
        images.splice(index, 1);
        renderImages();
        markDirty();
      });
      frame.append(image, remove);
      $("#image-previews").append(frame);
    });
  }
  $("#listing-images").addEventListener("change", async (event) => {
    const request = ++imageRequest;
    const files = [...event.target.files];
    readingImages = false;
    $("#submit-listing").disabled = saving;
    renderImages();
    markDirty();
    if (files.length + images.length > 5 || files.some(file =>
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024)) {
      feedback("invalidImage");
      event.target.value = "";
      return;
    }
    readingImages = true;
    $("#submit-listing").disabled = true;
    renderImages();
    try {
      const added = await Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })));
      if (request === imageRequest) images.push(...added);
    } catch (_) {
      if (request === imageRequest) feedback("unreadableImage");
    } finally {
      if (request === imageRequest) {
        readingImages = false;
        $("#submit-listing").disabled = saving;
        event.target.value = "";
        renderImages();
      }
    }
  });
  let version = 0;
  let dirty = false;
  let reports = [];
  let editingProduct = null;
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("trustcart-demo-reports") || "[]",
    );
    if (Array.isArray(saved)) reports = saved;
  } catch (_) {}
  const payload = () => ({
    images: [...images],
    price: $("#listing-price").value,
    stock: Number($("#listing-stock").value),
    title: $("#listing-title").value.trim(),
    description: $("#listing-description").value,
    category: $("#listing-category").value,
    registration_reference: $("#registration-reference").value.trim(),
    product_name: $("#registered-name").value.trim(),
    license_holder: $("#license-holder").value.trim(),
  });
  function fill(data) {
    imageRequest++;
    readingImages = false;
    $("#submit-listing").disabled = saving;
    images = Array.isArray(data.images) ? [...data.images] : [];
    $("#listing-images").value = "";
    $("#listing-price").value = data.price ?? "";
    $("#listing-stock").value = data.stock ?? "";
    renderImages();
    const values = [
      data.title,
      data.description,
      data.category,
      data.registration_reference,
      data.product_name,
      data.license_holder,
    ];
    ids.forEach((id, i) => {
      if (typeof values[i] === "string") $("#" + id).value = values[i];
    });
  }
  function feedback(key) {
    currentMessage = key;
    $("#seller-feedback").textContent = tr(...messages[key]);
  }
  function showResult(result) {
    currentResult = result;
    const container = $("#seller-result");
    container.replaceChildren();
    if (result) window.TrustCartVerification.render(container, result, {audit: false});
  }
  function updateProductLink() {
    const link = $("#view-product");
    link.hidden = !editingProduct || editingProduct.hasPrice === false;
    if (editingProduct && editingProduct.hasPrice !== false) link.href = `/products/${encodeURIComponent(editingProduct.id)}`;
    else link.removeAttribute("href");
  }
  function renderReports() {
    $("#seller-product-list").replaceChildren();
    if (!reports.length) {
      $("#seller-product-list").textContent = tr("ยังไม่มีรายการที่ตรวจสอบ", "There are no verified listings yet.");
      return;
    }
    for (const entry of reports) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seller-product-row";
      const title = entry.title || entry.id;
      button.textContent = entry.productId ? tr("แก้ไข / Edit", "Edit") : tr("ดูรายงาน / View report", "View report");
      button.setAttribute("aria-label", `${button.textContent}: ${title}`);
      button.addEventListener("click", async () => {
        if (saving) return;
        if (
          dirty &&
          !window.confirm(
            tr("มีข้อมูลที่ยังไม่ได้ตรวจสอบ ต้องการเปลี่ยนรายการหรือไม่?", "Switch listings and discard your unsaved changes?"),
          )
        )
          return;
        const request = ++version;
        $("#view-product").hidden = true;
        $("#view-product").removeAttribute("href");
        showResult(null);
        feedback("loading");
        try {
          const response = await fetch(
            entry.productId
              ? `/v1/products/${encodeURIComponent(entry.productId)}`
              : `/v1/verifications/${encodeURIComponent(entry.id)}`,
          );
          if (!response.ok) throw Error();
          const record = await response.json();
          if (request !== version) return;
          const result = entry.productId ? record.verification : record;
          editingProduct = entry.productId
            ? { id: record.id, version: record.version, hasPrice: record.listing.price != null }
            : null;
          if (!entry.productId && result.id !== entry.id) throw Error();
          if (result.listing) fill(result.listing);
          else
            fill({
              title: result.listing_title || "",
              description: "",
              category: "other",
              registration_reference: "",
              product_name: "",
              license_holder: "",
            });
          if (entry.productId) {
            reports = reports.map(item => item.productId === record.id ? {
              ...item, version: record.version, listing: record.listing,
              title: record.listing.title || record.listing.product_name, status: result.status,
            } : item);
            renderReports();
            $("#listing-title").focus();
          }
          dirty = false;
          updateProductLink();
          showResult(result);
          feedback("loaded");
        } catch (_) {
          if (request === version)
            feedback("loadFailed");
        }
      });
      const row = document.createElement("div");
      row.className = "seller-product-entry";
      const listing = entry.listing || {};
      const photo = document.createElement("img");
      photo.className = "seller-item-image";
      photo.src = listing.images?.[0] || "/static/assets/no-product-image.svg";
      photo.alt = title;
      photo.width = photo.height = 88;
      photo.loading = "lazy";
      const summary = document.createElement("div");
      summary.className = "seller-item-summary";
      const heading = document.createElement("h3");
      heading.textContent = title;
      const metadata = document.createElement("div");
      metadata.className = "seller-item-metadata";
      const price = document.createElement("span");
      price.className = "seller-item-price";
      price.textContent = listing.price == null ? tr("ต้องระบุราคา", "Price required") : `฿${Number(listing.price).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const stock = document.createElement("span");
      stock.className = "seller-item-stock";
      stock.textContent = listing.stock == null ? tr("ยังไม่ระบุสต็อก", "Stock unspecified") : tr(`สต็อก ${listing.stock} ชิ้น`, `Stock: ${listing.stock}`);
      const status = document.createElement("span");
      status.className = "seller-item-status";
      const statuses = ["APPROVED", "PENDING", "DENIED", "UNKNOWN"];
      const state = statuses.includes(entry.status) ? entry.status : "UNKNOWN";
      status.dataset.status = state;
      status.textContent = tr(`ผลตรวจ ${state}`, `Verification: ${state}`);
      metadata.append(price, stock, status);
      summary.append(heading, metadata);
      const actions = document.createElement("div");
      actions.className = "seller-item-actions";
      actions.append(button);
      row.append(photo, summary, actions);
      if (entry.productId && listing.price != null) {
        const view = document.createElement("a");
        view.className = "seller-view-product seller-view-action";
        view.textContent = tr("ดูสินค้า / View product ↗", "View product ↗");
        view.href = `/products/${encodeURIComponent(entry.productId)}`;
        view.target = "_blank";
        view.rel = "noopener noreferrer";
        view.setAttribute("aria-label", `${tr("ดูสินค้า / View product", "View product")}: ${entry.title || entry.productId}`);
        view.title = tr("เปิดหน้าลูกค้าด้วยข้อมูลที่บันทึกล่าสุด", "Open the customer page with the latest saved product");
        actions.append(view);
      }
      $("#seller-product-list").append(row);
    }
  }
  $("#seller-form").addEventListener("input", markDirty);
  $("#save-draft").addEventListener("click", () => {
    if (readingImages) { feedback("reading"); return; }
    try {
      localStorage.setItem("trustcart-seller-draft", JSON.stringify(payload()));
      feedback("draftSaved");
    } catch (_) {
      feedback("draftFailed");
    }
  });
  $("#seller-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || readingImages || !$("#seller-form").reportValidity()) return;
    saving = true;
    productsRequest++;
    renderImages();
    const listing = payload();
    const request = ++version;
    showResult(null);
    $("#submit-listing").disabled = true;
    document
      .querySelectorAll(
        "#seller-form input,#seller-form textarea,#seller-form select,#save-draft,#new-product",
      )
      .forEach((control) => {
        control.disabled = true;
      });
    feedback("checking");
    try {
      const response = await fetch(
        editingProduct ? `/v1/products/${editingProduct.id}` : "/v1/products",
        {
          method: editingProduct ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingProduct
              ? { ...listing, expected_version: editingProduct.version }
              : listing,
          ),
        },
      );
      if (!response.ok) {
        if (response.status === 409) throw new Error("conflict");
        if (response.status === 422) throw new Error("invalid");
        throw Error();
      }
      const record = await response.json();
      const result = record.verification;
      if (request !== version) return;
      if (!result || typeof result.id !== "string") throw Error();
      editingProduct = { id: record.id, version: record.version, hasPrice: record.listing.price != null };
      updateProductLink();
      dirty = false;
      showResult(result);
      reports = [
        {
          id: result.id,
          productId: record.id,
          version: record.version,
          listing: record.listing,
          title: listing.title,
          status: result.status,
        },
        ...reports.filter((entry) => entry.productId !== record.id),
      ].slice(0, 30);
      try {
        sessionStorage.setItem(
          "trustcart-demo-reports",
          JSON.stringify(reports.map(({ listing, ...metadata }) => metadata)),
        );
      } catch (_) {}
      try {
        localStorage.setItem("trustcart-products-updated", String(Date.now()));
      } catch (_) {}
      renderReports();
      feedback("saved");
    } catch (error) {
      if (request === version) {
        showResult(null);
        feedback(error.message === "conflict" || error.message === "invalid" ? error.message : "failed");
      }
    } finally {
      saving = false;
      renderImages();
      $("#submit-listing").disabled = false;
      document
        .querySelectorAll(
          "#seller-form input,#seller-form textarea,#seller-form select,#save-draft,#new-product",
        )
        .forEach((control) => {
          control.disabled = false;
        });
    }
  });
  try {
    const draft = JSON.parse(
      localStorage.getItem("trustcart-seller-draft") || "null",
    );
    if (draft && typeof draft === "object") {
      fill(draft);
      dirty = true;
      feedback("draftLoaded");
    }
  } catch (_) {}
  $("#new-product").addEventListener("click", () => {
    if (
      dirty &&
      !window.confirm(tr("เริ่มรายการใหม่โดยไม่บันทึกข้อมูลปัจจุบันหรือไม่?", "Start a new listing and discard your unsaved changes?"))
    )
      return;
    editingProduct = null;
    updateProductLink();
    dirty = false;
    version++;
    $("#seller-form").reset();
    imageRequest++;
    readingImages = false;
    images = [];
    $("#submit-listing").disabled = false;
    renderImages();
    showResult(null);
    feedback("newListing");
  });
  async function loadProducts() {
    if (saving) return;
    const request = ++productsRequest;
    try {
      const response = await fetch("/v1/products", { cache: "no-store" });
      if (!response.ok) return;
      const records = await response.json();
      if (request !== productsRequest || !Array.isArray(records)) return;
      reports = [
        ...records.map((record) => ({
          id: record.verification.id,
          productId: record.id,
          version: record.version,
          listing: record.listing,
          title: record.listing.title || record.listing.product_name,
          status: record.verification.status,
        })),
        ...reports.filter(
          (entry) =>
            !entry.productId &&
            !records.some((record) => record.verification.id === entry.id),
        ),
      ];
      renderReports();
    } catch (_) {}
  }
  window.addEventListener("focus", loadProducts);
  window.addEventListener("trustcart-languagechange", () => {
    renderImages();
    renderReports();
    showResult(currentResult);
    if (currentMessage) feedback(currentMessage);
  });
  renderReports();
  loadProducts();
})();
