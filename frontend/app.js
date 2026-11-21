"use strict";

// Catalog claims are synthetic. Only the backend can supply a verification result.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const categories = [
    ["ความงามและของใช้ส่วนตัว", "Beauty & personal care"],
    ["กลุ่มผลิตภัณฑ์เพื่อสุขภาพ", "Health products"],
    ["เสื้อผ้าแฟชั่นผู้ชาย", "Men’s clothing"],
    ["เสื้อผ้าแฟชั่นผู้หญิง", "Women’s clothing"],
    ["กระเป๋า", "Bags"],
    ["รองเท้าผู้ชาย", "Men’s shoes"],
    ["รองเท้าผู้หญิง", "Women’s shoes"],
    ["เครื่องประดับ", "Jewellery"],
    ["นาฬิกาและแว่นตา", "Watches & glasses"],
    ["เครื่องใช้ในบ้าน", "Home & living"],
    ["อุปกรณ์อิเล็กทรอนิกส์", "Electronics"],
    ["มือถือ และ แท็บเล็ต", "Phones & tablets"],
    ["เครื่องใช้ไฟฟ้าภายในบ้าน", "Home appliances"],
    ["คอมพิวเตอร์และแล็ปท็อป", "Computers & laptops"],
    ["กล้องและอุปกรณ์ถ่ายภาพ", "Cameras"],
    ["อาหารและเครื่องดื่ม", "Food & beverages"],
    ["ของเล่น สินค้าแม่และเด็ก", "Baby & toys"],
    ["กีฬาและกิจกรรมกลางแจ้ง", "Sports & outdoors"],
    ["สัตว์เลี้ยง", "Pets"],
    ["เกมและอุปกรณ์เสริม", "Gaming"],
    ["ยานยนต์", "Automotive"],
    ["เครื่องเขียน หนังสือ และงานอดิเรก", "Books & stationery"],
    ["ตั๋วและบัตรกำนัล", "Tickets & vouchers"],
    ["ช้อปปี้เพย์ใกล้ตัว", "Nearby deals"],
  ];
  const catalog = [
    [
      "หูฟังไร้สาย แบบครอบหู สีดำ",
      "Wireless over-ear headphones, black",
      10,
      429,
      890,
      2100,
    ],
    [
      "เสื้อเชิ้ตแขนยาว ทรงสบาย สีฟ้า",
      "Relaxed long-sleeve shirt, blue",
      2,
      199,
      390,
      832,
    ],
    [
      "กระเป๋าสะพายข้าง ทรงคลาสสิก",
      "Classic everyday shoulder bag",
      4,
      359,
      690,
      1230,
    ],
    [
      "รองเท้าผ้าใบ ลำลอง ใส่ได้ทุกวัน",
      "Everyday casual canvas sneakers",
      5,
      259,
      499,
      3600,
    ],
    [
      "นาฬิกาข้อมือ หน้าปัดสีน้ำเงิน",
      "Classic watch with blue dial",
      8,
      518,
      1399,
      632,
    ],
    [
      "ชุดเครื่องสำอาง พร้อมกระจกพกพา",
      "Makeup palette with compact mirror",
      0,
      189,
      320,
      4500,
    ],
    [
      "แล็ปท็อป สำหรับทำงานและเรียน",
      "Laptop for work and study",
      13,
      12990,
      16990,
      213,
    ],
    [
      "แก้วน้ำพร้อมฝาปิด สำหรับเด็ก",
      "Baby cup with lid and handles",
      16,
      129,
      259,
      1520,
    ],
    [
      "ชุดเดรสแขนกุด สีส้ม",
      "Orange sleeveless everyday dress",
      3,
      229,
      459,
      762,
    ],
    ["ชามอาหารสัตว์เลี้ยง สีเหลือง", "Yellow pet food bowl", 18, 79, 159, 6100],
    [
      "ชุดเครื่องนอน โทนสีธรรมชาติ",
      "Natural-tone bedding set",
      9,
      599,
      1290,
      932,
    ],
    ["มือถือ สมาร์ทโฟน สีม่วง", "Purple smartphone", 11, 8990, 11990, 427],
    ["รองเท้าส้นสูง โทนสีนู้ด", "Nude-tone classic heels", 6, 299, 590, 680],
    [
      "สร้อยคอพร้อมจี้ สีเงิน",
      "Silver-tone pendant necklace",
      7,
      149,
      299,
      2840,
    ],
    ["หน้ากากอนามัย แบบแพ็ก", "Disposable face mask pack", 1, 49, 99, 7200],
    [
      "โทรทัศน์ จอแบน สำหรับบ้าน",
      "Flat-screen home television",
      12,
      6490,
      9990,
      352,
    ],
    [
      "กล้องถ่ายภาพ สไตล์คลาสสิก",
      "Classic-style digital camera",
      14,
      3290,
      4990,
      174,
    ],
    ["ขนมขบเคี้ยว แบบแพ็ก", "Everyday snack pack", 15, 89, 159, 981],
    [
      "จักรยาน สำหรับกิจกรรมกลางแจ้ง",
      "Outdoor city bicycle",
      17,
      2590,
      3990,
      136,
    ],
    [
      "จอยเกมไร้สาย สำหรับคอนโซล",
      "Wireless console controller",
      19,
      790,
      1290,
      456,
    ],
    [
      "อุปกรณ์ตกแต่งรถยนต์ ชุดจำลอง",
      "Demo automotive accessory set",
      20,
      159,
      299,
      345,
    ],
    [
      "ชุดเครื่องเขียน สำหรับโต๊ะทำงาน",
      "Desk stationery set",
      21,
      99,
      199,
      2490,
    ],
    ["บัตรกำนัลจำลอง สำหรับสาธิต", "Sample gift voucher", 22, 100, 120, 80],
    [
      "ดีลร้านค้าใกล้บ้าน สำหรับสาธิต",
      "Sample neighbourhood store deal",
      23,
      69,
      99,
      91,
    ],
  ].map(([th, en, category, price, original, sold], id) => ({
    id,
    th,
    en,
    category,
    price,
    original,
    sold,
  }));
  const state = {
    language: "th",
    query: "",
    category: null,
    limit: 12,
    sort: "recommended",
  };
  // This listing uses the existing synthetic fixture; no registry record is invented here.
  const checkedProduct = catalog[14];
  checkedProduct.th = "ลูมาเวล วิตามินซี · แบรนด์สมมติ";
  checkedProduct.en = "LumaVale Vitamin C · fictional brand";
  const overclaimExamples = [
    {
      th: "ออราเฟิร์น คอลลาเจน — ผิวดูอ่อนวัยใน 3 วัน",
      en: "AuraFern Collagen — younger-looking skin in 3 days",
      descriptionTh:
        "แบรนด์สมมติ AuraFern · ตัวอย่างคำกล่าวอ้างเกินจริงสำหรับทดสอบ: ‘ผิวดูอ่อนวัยใน 3 วัน เห็นผลแน่นอนทุกคน’ ข้อความนี้ไม่ได้รับการยืนยันและไม่ใช่คำแนะนำ",
      descriptionEn:
        "Fictional brand AuraFern. Overclaim test example: ‘Younger-looking skin in 3 days, guaranteed for everyone.’ Unsupported sample advertising, not advice.",
      price: 329,
    },
    {
      th: "โนวาลีฟ วิตามินซี — ผิวกระจ่างใสทันที 100%",
      en: "NovaLeaf Vitamin C — instantly brighter skin, 100% guaranteed",
      descriptionTh:
        "แบรนด์สมมติ NovaLeaf · ตัวอย่างคำกล่าวอ้างเกินจริงสำหรับทดสอบ: ‘ผิวกระจ่างใสทันที 100% ตั้งแต่ครั้งแรก’ เป็นข้อความโฆษณาจำลองที่อ้างผลทันทีและรับประกันเกินจริง ไม่ใช่ข้อเท็จจริง",
      descriptionEn:
        "Fictional brand NovaLeaf. Overclaim test example: ‘Instantly brighter skin, 100% guaranteed from the first use.’ Unsupported instant-result guarantee, not a factual benefit.",
      price: 189,
    },
    {
      th: "ซันพีค น้ำมันปลา — ความจำดีขึ้นทันทีทุกคน",
      en: "SunPeak Fish Oil — instantly better memory for everyone",
      descriptionTh:
        "แบรนด์สมมติ SunPeak · ตัวอย่างคำกล่าวอ้างเกินจริงสำหรับทดสอบ: ‘ความจำดีขึ้นทันที เห็นผลทุกคนโดยไม่มีข้อยกเว้น’ ข้อความนี้ไม่ได้รับการยืนยัน ใช้เป็นกรณีทดสอบเท่านั้น ไม่ใช่คำแนะนำ",
      descriptionEn:
        "Fictional brand SunPeak. Overclaim test example: ‘Instantly better memory for everyone, without exception.’ Unsupported sample claim for testing only, not advice.",
      price: 259,
    },
  ];
  overclaimExamples.forEach((example) =>
    catalog.push({
      ...example,
      id: catalog.length,
      category: 1,
      original: example.price + 100,
      sold: 0,
      overclaim: true,
    }),
  );
  // Short excerpts from public Shopee titles; descriptions summarize visible pack data.
  Object.assign(catalog[21], {
    th: "Neocell Super Collagen + C",
    en: "Neocell Super Collagen + C",
    category: 1,
    sourceUrl:
      "https://shopee.co.th/Neocell-Super-Collagen--C--คอลลาเจน-วิตามินซี--(ขนาด-90-250-270-360-เม็ด)-i.38793442.783511072",
    sourceDescription: "คอลลาเจน วิตามินซี ขนาด 90/250/270/360 เม็ด",
  });
  Object.assign(catalog[22], {
    th: "Deva C Vitamin C 1000 มก.",
    en: "Deva C Vitamin C 1000 mg",
    category: 1,
    sourceUrl:
      "https://shopee.co.th/วิตามินซี-ดีว่าพลัสคอลลาเจน-(1ห่อ-30ซอง)-Deva-C-Vitamin-C-1000-มก.(ของแท้)-i.224681664.40201061048",
    sourceDescription: "วิตามินซี ดีว่าพลัสคอลลาเจน 1 ห่อ 30 ซอง",
  });
  let productVerification = null;
  const productVerifications = new Map();
  function hasProductVerification(product) {
    return (
      product.id === checkedProduct.id &&
      productVerification?.status === "APPROVED" &&
      Number.isFinite(productVerification.confidence) &&
      productVerification.confidence >= 0.75 &&
      productVerification.human_review_required === false &&
      productVerification.registry_source === "synthetic" &&
      typeof productVerification.chain_hash === "string" &&
      productVerification.chain_hash.length > 0
    );
  }
  function verificationLabel() {
    return state.language === "th" ? "ตรวจทะเบียนแล้ว" : "Registration checked";
  }
  function productCheckmark(product) {
    const verified = hasProductVerification(product);
    const denied = productVerifications.get(product.id)?.status === "DENIED";
    const label = verified
      ? verificationLabel()
      : denied
        ? state.language === "th"
          ? "ไม่ผ่านการตรวจสอบ"
          : "Did not pass verification"
        : state.language === "th"
          ? "ยังตรวจสอบไม่ได้"
          : "Could not verify";
    const badge = element(
      "button",
      `product-status ${verified ? "product-verified" : denied ? "product-denied" : "product-unconfirmed"}`,
    );
    badge.type = "button";
    badge.setAttribute("aria-label", label);
    badge.setAttribute("aria-haspopup", "dialog");
    badge.title = label;
    badge.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#product-status-title").textContent = label;
      const result = productVerifications.get(product.id);
      if (result?.id)
        $("#reviewer-link").href =
          `/reviewer?id=${encodeURIComponent(result.id)}`;
      openDialog($("#product-status-dialog"));
    });
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const seal = document.createElementNS(icon.namespaceURI, "path");
    seal.setAttribute(
      "d",
      verified
        ? "m12 1 3 2 3.6.4.9 3.5L22 10l-1 3.4.2 3.6-3.3 1.5-2.3 2.8-3.6-.5-3.4 1.1-2.6-2.6-3.5-1L2 14.6 1 11l2.4-2.8.8-3.5L7.8 4Z"
        : "M12 2 21 6v7c0 5-9 9-9 9S3 18 3 13V6Z",
    );
    const check = document.createElementNS(icon.namespaceURI, "path");
    check.setAttribute("d", verified ? "m7 12 3 3 7-7" : "M12 7v6m0 4v.1");
    check.setAttribute("class", "verified-tick");
    icon.append(seal, check);
    badge.append(icon);
    return badge;
  }
  const text = {
    th: {
      results: "รายการ",
      allProducts: "สินค้าจำลองทั้งหมด",
      search: "ค้นหา",
      clear: "ล้างตัวกรอง",
      noResults: "ไม่พบสินค้า",
      sold: "ขายแล้ว",
      shipping: "ส่งฟรี",
      preferred: "ร้านแนะนำ",
      location: "กรุงเทพมหานคร",
      placeholder: "ลูกค้าใหม่ รับเลย โค้ดส่วนลด หรือโค้ดส่งฟรี*",
      searchLabel: "ค้นหาสินค้าและร้านค้า",
      all: "ดูทั้งหมด",
      close: "ปิด",
      cart: "ตะกร้าสินค้า",
      homeTitle: "ช้อปสินค้าออนไลน์ — เว็บไซต์จำลอง TrustCart",
    },
    en: {
      results: "items",
      allProducts: "All demo products",
      search: "Search",
      clear: "Clear filters",
      noResults: "No products found",
      sold: "sold",
      shipping: "Free shipping",
      preferred: "Preferred",
      location: "Bangkok",
      placeholder: "New here? Discover welcome vouchers and free shipping*",
      searchLabel: "Search products and shops",
      all: "See all",
      close: "Close",
      cart: "Shopping cart",
      homeTitle: "Online shopping — TrustCart marketplace demo",
    },
  };
  const t = (key) => text[state.language][key] || key;
  const name = (product) => product[state.language];
  const categoryName = (index) =>
    categories[index][state.language === "th" ? 0 : 1];
  const price = (value) => "฿" + value.toLocaleString("en-US");
  const image = (category) => `/static/assets/category-${category}.webp`;
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function productImage(product) {
    const img = element("img");
    img.src =
      product.id === checkedProduct.id || product.overclaim
        ? "/static/assets/demo-supplement.svg"
        : image(product.category);
    img.alt = name(product);
    img.loading = "lazy";
    img.width = 200;
    img.height = 200;
    return img;
  }
  function productCard(product) {
    const card = element(
      "article",
      product.overclaim ? "product-card overclaim-example" : "product-card",
    );
    card.dataset.product = product.id;
    const open = element("button", "product-open");
    open.type = "button";
    open.setAttribute("aria-label", name(product));
    const picture = element("div", "product-picture");
    picture.append(
      productImage(product),
      element("span", "preferred", t("preferred")),
      element(
        "span",
        "discount",
        `−${Math.round((1 - product.price / product.original) * 100)}%`,
      ),
    );
    const copy = element("div", "product-copy");
    const productName = element("h3", "product-name", name(product));
    if (hasProductVerification(product)) {
      productName.prepend(
        productCheckmark(product),
        document.createTextNode(" "),
      );
    }
    copy.append(productName, element("span", "shipping-tag", t("shipping")));
    if (product.overclaim)
      copy.append(
        element(
          "span",
          "overclaim-warning",
          state.language === "th"
            ? "ตัวอย่างคำกล่าวอ้างเกินจริง"
            : "Overclaim test example",
        ),
      );
    const bottom = element("div", "product-bottom");
    bottom.append(
      element("span", "price", price(product.price)),
      element(
        "small",
        "",
        `${t("sold")} ${product.sold.toLocaleString("en-US")}`,
      ),
    );
    copy.append(bottom, element("span", "product-location", t("location")));
    open.append(picture);
    card.append(open, copy);
    return card;
  }
  function matches() {
    const query = state.query.toLocaleLowerCase().trim();
    const products = catalog.filter(
      (product) =>
        (state.category === null || product.category === state.category) &&
        (!query ||
          `${product.th} ${product.en} ${categories[product.category].join(" ")}`
            .toLocaleLowerCase()
            .includes(query)),
    );
    if (state.sort === "recommended") {
      for (let offset = 0; offset < overclaimExamples.length; offset++) {
        const sample = catalog[24 + offset];
        const index = products.indexOf(sample);
        if (index > offset + 2)
          products.splice(offset + 2, 0, products.splice(index, 1)[0]);
      }
      const demoIndex = products.indexOf(checkedProduct);
      if (demoIndex > 1)
        products.splice(1, 0, products.splice(demoIndex, 1)[0]);
    }
    if (state.sort === "price-low") products.sort((a, b) => a.price - b.price);
    if (state.sort === "price-high") products.sort((a, b) => b.price - a.price);
    return products;
  }
  function renderProducts() {
    const products = matches();
    $("#products").replaceChildren(
      ...products.slice(0, state.limit).map(productCard),
    );
    const label = state.query
      ? `“${state.query}”`
      : state.category === null
        ? t("allProducts")
        : categoryName(state.category);
    $("#results-summary").textContent =
      `${label} · ${products.length} ${t("results")}`;
    $("#empty-state").hidden = products.length > 0;
    $("#load-more").hidden = state.limit >= products.length;
    $("#clear-filters").hidden = !state.query && state.category === null;
  }
  function browse() {
    renderProducts();
    $("#catalog-title").scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function reset() {
    state.query = "";
    state.category = null;
    state.limit = 12;
    $("#search").value = "";
    $$("[data-category]").forEach((button) =>
      button.setAttribute("aria-pressed", "false"),
    );
    browse();
  }
  $("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = $("#search").value.trim();
    state.limit = 12;
    browse();
  });
  $("#clear-filters").addEventListener("click", reset);
  $("#reset-search").addEventListener("click", reset);
  $("#all-categories").addEventListener("click", reset);
  $("#sort").addEventListener("change", () => {
    state.sort = $("#sort").value;
    renderProducts();
  });
  $("#load-more").addEventListener("click", () => {
    state.limit += 12;
    renderProducts();
  });
  function renderCategories() {
    $("#categories").replaceChildren(
      ...categories.map((category, index) => {
        const button = element("button", "category");
        button.type = "button";
        button.dataset.category = index;
        button.setAttribute("aria-pressed", String(state.category === index));
        const img = element("img");
        img.src = image(index);
        img.alt = "";
        img.width = 83;
        img.height = 83;
        button.append(img, element("span", "", categoryName(index)));
        button.addEventListener("click", () => {
          state.category = index;
          state.limit = 12;
          $$("[data-category]").forEach((node) =>
            node.setAttribute("aria-pressed", String(node === button)),
          );
          browse();
        });
        return button;
      }),
    );
  }
  Object.assign(text.th, {
    welcome: "สิทธิพิเศษลูกค้าใหม่",
    trendy: "ช้อปปี้เทรนด์ดี้",
    home: "ดีลเครื่องใช้ไฟฟ้า",
    claimed: "เก็บแล้ว · โค้ดจำลอง",
    claim: "เก็บโค้ดจำลอง",
    couponSaved: "เก็บโค้ดจำลองแล้ว",
    previous: "โปรโมชั่นก่อนหน้า",
    next: "โปรโมชั่นถัดไป",
    promo: "โปรโมชั่น",
    soldFast: "ขายดี",
    sampleTime: "เวลานับถอยหลังสำหรับสาธิต",
  });
  Object.assign(text.en, {
    welcome: "New customer offers",
    trendy: "Shopee Trendy",
    home: "Home appliance deals",
    claimed: "Saved · demo voucher",
    claim: "Save demo voucher",
    couponSaved: "Demo voucher saved",
    previous: "Previous promotion",
    next: "Next promotion",
    promo: "Promotion",
    soldFast: "Selling fast",
    sampleTime: "Demo countdown",
  });
  let toastTimer;
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      $("#toast").hidden = true;
    }, 3000);
  }
  const returnFocus = new WeakMap();
  function openDialog(dialog) {
    returnFocus.set(dialog, document.activeElement);
    dialog.showModal();
  }
  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => returnFocus.get(dialog)?.focus());
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) dialog.close();
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          dialog.close();
      }
    });
  });
  const slides = ["hero", "trendy", "home"];
  let slide = 0;
  function renderSlide() {
    $("#hero-image").src = `/static/assets/${slides[slide]}.webp`;
    $("#hero-image").alt = t(["welcome", "trendy", "home"][slide]);
    $("#hero-banner").dataset.promo = ["welcome", "trendy", "home"][slide];
    $("#carousel-dots").replaceChildren(
      ...slides.map((_, index) => {
        const dot = element("button");
        dot.setAttribute("aria-label", `${t("promo")} ${index + 1}`);
        dot.setAttribute("aria-current", String(index === slide));
        dot.addEventListener("click", () => {
          slide = index;
          renderSlide();
        });
        return dot;
      }),
    );
  }
  $("#previous-slide").addEventListener("click", () => {
    slide = (slide + slides.length - 1) % slides.length;
    renderSlide();
  });
  $("#next-slide").addEventListener("click", () => {
    slide = (slide + 1) % slides.length;
    renderSlide();
  });
  const shortcuts = [
    ["ส่งฟรี", "Free shipping"],
    ["Fulfilled", "Fulfilled"],
    ["ช้อปปี้เทรนด์ดี้", "Shopee Trendy"],
    ["ช้อปปี้มอลล์", "Shopee Mall"],
    ["ช้อปปี้แฟชั่น", "Shopee Fashion"],
    ["ช้อปปี้ถูกชัวร์", "Best deals"],
    ["ซูเปอร์มาร์เก็ต", "Supermarket"],
  ];
  function renderShortcuts() {
    $("#shortcuts").replaceChildren(
      ...shortcuts.map((label, index) => {
        const button = element("button", "shortcut");
        const img = element("img");
        img.src = `/static/assets/shortcut-${index}.webp`;
        img.alt = "";
        button.append(
          img,
          element("span", "", label[state.language === "th" ? 0 : 1]),
        );
        button.addEventListener("click", () =>
          showPromo(index === 2 ? "trendy" : "welcome"),
        );
        return button;
      }),
    );
  }
  let couponClaimed = false;
  let currentPromo = "welcome";
  function showPromo(key) {
    currentPromo = key;
    $("#promo-title").textContent = t(key);
    $("#claim-coupon").textContent = t(couponClaimed ? "claimed" : "claim");
    $("#claim-coupon").disabled = couponClaimed;
    openDialog($("#promo-dialog"));
  }
  $$("[data-promo]").forEach((button) =>
    button.addEventListener("click", () => showPromo(button.dataset.promo)),
  );
  $("#claim-coupon").addEventListener("click", () => {
    couponClaimed = true;
    $("#claim-coupon").textContent = t("claimed");
    $("#claim-coupon").disabled = true;
    toast(t("couponSaved"));
  });
  const dealProducts = [
    catalog[4],
    catalog[0],
    catalog[2],
    catalog[3],
    catalog[5],
    catalog[7],
  ];
  function renderDeals() {
    $("#flash-products").replaceChildren(
      ...dealProducts.map((product, index) => {
        const button = element("button", "flash-card");
        button.dataset.product = product.id;
        button.setAttribute(
          "aria-label",
          `${name(product)} ${price(product.price)}`,
        );
        const amount = element("div", "flash-price", price(product.price));
        const bar = element("div", "sold-bar");
        bar.style.setProperty("--sold", `${55 + index * 7}%`);
        bar.append(element("span", "", t("soldFast")));
        button.append(
          productImage(product),
          element(
            "span",
            "discount",
            `−${Math.round((1 - product.price / product.original) * 100)}%`,
          ),
          amount,
          bar,
        );
        return button;
      }),
    );
  }
  const countdownEnd = Date.now() + (46 * 60 + 48) * 1000;
  function renderCountdown() {
    const seconds = Math.max(0, Math.floor((countdownEnd - Date.now()) / 1000));
    $("#countdown").textContent = [
      Math.floor(seconds / 3600),
      Math.floor(seconds / 60) % 60,
      seconds % 60,
    ]
      .map((part) => String(part).padStart(2, "0"))
      .join(" : ");
    $("#countdown").setAttribute("aria-label", t("sampleTime"));
  }
  window.setInterval(renderCountdown, 1000);
  $("#all-deals").addEventListener("click", () => {
    reset();
    state.limit = catalog.length;
    renderProducts();
  });
  Object.assign(text.th, {
    quantity: "จำนวน",
    add: "เพิ่มไปยังตะกร้า",
    added: "เพิ่มสินค้าลงตะกร้าจำลองแล้ว",
    quantityError: "กรุณาระบุจำนวนเต็มตั้งแต่ 1 ถึง 99 ชิ้น",
    emptyCart: "ยังไม่มีสินค้าในตะกร้า",
    total: "ยอดรวมจำลอง",
    remove: "ลบ",
    sampleProduct:
      "สินค้าจำลอง · ภาพประกอบจากเว็บไซต์อ้างอิง · ไม่ใช่ผลการรับรอง",
    accountTitle: "บัญชีสำหรับสาธิต",
    accountBody:
      "ต้นแบบนี้ไม่มีระบบบัญชี ไม่ต้องกรอกชื่อผู้ใช้หรือรหัสผ่าน สามารถทดลองค้นหาและเพิ่มสินค้าลงตะกร้าจำลองได้ทันที",
    sellerTitle: "Seller Centre",
    sellerBody:
      "หน้าผู้ขายยังไม่อยู่ในขอบเขตต้นแบบนี้ ทดลองใช้งาน API ตรวจสอบข้อมูลจำลองได้ที่ /docs",
    helpTitle: "วิธีใช้งานเว็บไซต์จำลอง",
    helpBody:
      "ค้นหาสินค้า เลือกหมวดหมู่ เปิดรายละเอียด และทดลองเพิ่มสินค้าลงตะกร้า ข้อมูลทั้งหมดเป็นข้อมูลจำลอง ไม่มีการชำระเงินหรือจัดส่งจริง",
    downloadTitle: "เว็บไซต์จำลองบนมือถือ",
    downloadBody:
      "ต้นแบบนี้รองรับการใช้งานผ่านเบราว์เซอร์บนมือถือ ไม่มีแอปพลิเคชันให้ดาวน์โหลด",
    socialTitle: "ช่องทางสำหรับสาธิต",
    socialBody:
      "ปุ่มนี้แสดงรูปแบบหน้าร้านเท่านั้น ต้นแบบไม่เชื่อมต่อบัญชีโซเชียลมีเดีย",
    notificationsTitle: "การแจ้งเตือน",
    notificationsBody: "ไม่มีการแจ้งเตือนใหม่ในเว็บไซต์จำลอง",
    aboutTitle: "เกี่ยวกับต้นแบบ TrustCart",
    aboutBody:
      "สร้างโดย Team BlueScreen โดยอ้างอิงรูปแบบหน้าแรกของ Shopee Thailand เพื่อสาธิตหน้าร้านเท่านั้น ไม่มีความเกี่ยวข้องอย่างเป็นทางการกับ Shopee",
  });
  Object.assign(text.en, {
    quantity: "Quantity",
    add: "Add to cart",
    added: "Added to demo cart",
    quantityError: "Enter a whole number from 1 to 99",
    emptyCart: "Your cart is empty",
    total: "Demo total",
    remove: "Remove",
    sampleProduct:
      "Synthetic product · reference imagery · no verification result",
    accountTitle: "Demo account",
    accountBody:
      "This prototype has no account system. No username or password is needed. Browse products and try the demo cart directly.",
    sellerTitle: "Seller Centre",
    sellerBody:
      "The seller portal is outside this UI prototype. Try the synthetic verification API at /docs.",
    helpTitle: "Using the demo",
    helpBody:
      "Search, select a category, open product details and add items to the sample cart. All catalog data is synthetic. No payments or deliveries take place.",
    downloadTitle: "Mobile website",
    downloadBody:
      "This prototype works in your mobile browser. There is no app to download.",
    socialTitle: "Demo social links",
    socialBody:
      "These controls demonstrate the storefront layout. No social accounts are connected.",
    notificationsTitle: "Notifications",
    notificationsBody: "You have no new notifications in this demo.",
    aboutTitle: "About the TrustCart prototype",
    aboutBody:
      "Built by Team BlueScreen using the Shopee Thailand homepage as a visual reference. This is an independent storefront prototype with no official Shopee affiliation.",
  });
  const cart = new Map();
  let selectedProduct = null;
  let currentInfo = "help";
  function renderDetail() {
    const product = selectedProduct;
    const layout = element("div", "product-detail-layout");
    const details = element("div");
    const heading = element("h2", "", name(product));
    heading.id = "product-title";
    if (hasProductVerification(product))
      heading.prepend(productCheckmark(product), document.createTextNode(" "));
    const amount = element("div", "detail-price", price(product.price));
    const quantity = element("div", "quantity");
    const label = element("label", "", t("quantity"));
    label.htmlFor = "quantity";
    const input = element("input");
    Object.assign(input, {
      id: "quantity",
      type: "number",
      min: "1",
      max: "99",
      step: "1",
      value: "1",
    });
    quantity.append(label, input);
    const add = element("button", "primary", t("add"));
    add.id = "add-to-cart";
    add.addEventListener("click", () => {
      const quantity = Number(input.value);
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99 ||
        (cart.get(product.id) || 0) + quantity > 99
      ) {
        toast(t("quantityError"));
        input.focus();
        return;
      }
      cart.set(product.id, (cart.get(product.id) || 0) + quantity);
      renderCart();
      $("#product-dialog").close();
      toast(t("added"));
    });
    details.append(
      heading,
      element(
        "div",
        "detail-note",
        hasProductVerification(product)
          ? state.language === "th"
            ? "สินค้าจำลอง · ตรวจเฉพาะทะเบียนและหมวดหมู่"
            : "Synthetic product · identity and category check only"
          : t("sampleProduct"),
      ),
      amount,
      quantity,
      add,
    );
    if (product.overclaim) {
      const warning = element(
        "p",
        "overclaim-warning",
        state.language === "th"
          ? "ตัวอย่างคำกล่าวอ้างเกินจริง · แบรนด์สมมติ · ไม่ได้รับการยืนยัน"
          : "Overclaim test example · fictional brand · unverified",
      );
      const description = element(
        "p",
        "product-description",
        state.language === "th" ? product.descriptionTh : product.descriptionEn,
      );
      details.insertBefore(warning, amount);
      details.insertBefore(description, amount);
    }
    if (product.sourceUrl) {
      const source = element(
        "a",
        "source-reference",
        "ดูรายการอ้างอิงบน Shopee",
      );
      source.href = product.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      details.insertBefore(
        element("p", "product-description", product.sourceDescription),
        amount,
      );
      details.insertBefore(
        element(
          "p",
          "detail-note",
          "ตัวอย่างอ้างอิง · สรุปข้อมูลบรรจุภัณฑ์จากชื่อรายการ ไม่ใช่คำอธิบายต้นฉบับ · ยังไม่ได้ตรวจยืนยัน",
        ),
        amount,
      );
      details.insertBefore(source, amount);
    }
    layout.append(productImage(product), details);
    $("#product-detail").replaceChildren(layout);
  }
  function renderCart() {
    const count = [...cart.values()].reduce(
      (sum, quantity) => sum + quantity,
      0,
    );
    $("#cart-count").textContent = count;
    $("#cart-count").hidden = count === 0;
    $("#open-cart").setAttribute("aria-label", `${t("cart")} (${count})`);
    let total = 0;
    const items = [...cart].map(([id, quantity]) => {
      const product = catalog[id];
      total += product.price * quantity;
      const row = element("div", "cart-item");
      const copy = element("div");
      copy.append(
        element("h3", "", name(product)),
        element("p", "", `${price(product.price)} × ${quantity}`),
      );
      const remove = element("button", "", t("remove"));
      remove.dataset.remove = id;
      remove.setAttribute("aria-label", `${t("remove")} ${name(product)}`);
      remove.addEventListener("click", () => {
        cart.delete(id);
        renderCart();
        (
          $("#cart-items [data-remove]") || $("#cart-dialog [data-close]")
        ).focus();
      });
      row.append(productImage(product), copy, remove);
      return row;
    });
    $("#cart-items").replaceChildren(
      ...(items.length ? items : [element("p", "empty-cart", t("emptyCart"))]),
    );
    $("#cart-total").textContent = `${t("total")}: ${price(total)}`;
  }
  function showCart() {
    renderCart();
    openDialog($("#cart-dialog"));
  }
  $("#open-cart").addEventListener("click", showCart);
  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-product]");
    if (card) {
      selectedProduct = catalog[Number(card.dataset.product)];
      renderDetail();
      openDialog($("#product-dialog"));
    }
  });
  $$("[data-info]").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.info === "cart") {
        showCart();
        return;
      }
      currentInfo = button.dataset.info;
      $("#info-title").textContent = t(`${currentInfo}Title`);
      $("#info-body").textContent = t(`${currentInfo}Body`);
      openDialog($("#info-dialog"));
    }),
  );
  const thaiLabels = new Map(
    $$("[data-i18n]").map((node) => [node, node.textContent]),
  );
  Object.assign(text.en, {
    skip: "Skip to main content",
    demo: "TrustCart · UI prototype · synthetic products · no real purchases · independent of Shopee",
    api: "API documentation",
    sell: "Start selling",
    download: "Download",
    follow: "Follow us",
    notifications: "Notifications",
    help: "Help",
    signup: "Sign up",
    login: "Log in",
    categories: "Categories",
    sampleDeals: "Sample deals",
    discover: "Daily discovery",
    sort: "Sort products",
    recommended: "Recommended",
    priceLow: "Price: low to high",
    priceHigh: "Price: high to low",
    tryAgain: "Try a different search or category.",
    reset: "Show all products",
    more: "See more",
    aboutTitle: "A new way to explore shopping with TrustCart",
    aboutBody:
      "A TrustCart storefront prototype recreating the Shopee Thailand homepage layout. Products, prices and promotions are illustrative. No payment or real order is processed.",
    verificationNote:
      "This page does not display product certifications. The separate synthetic registry API covers baseline identity and category checks only.",
    helpCenter: "Customer service",
    howTo: "How to use the demo",
    aboutTrustCart: "About TRUSTCART",
    aboutDemo: "About the prototype",
    reference: "Reference: Shopee Thailand",
    payments: "Payment methods",
    noPayment: "Visual examples only. No payments accepted.",
    delivery: "Delivery services",
    synthetic: "All catalog data is synthetic",
    independent: "Independent prototype. No official affiliation with Shopee.",
    backTop: "Back to top",
    cartNote: "Demo cart · no real orders · resets when you reload",
    understood: "Got it",
    couponNote: "Sample voucher only. Cannot be used on real orders.",
  });
  function renderHints() {
    const hints =
      state.language === "th"
        ? [
            "หูฟัง",
            "กระเป๋า",
            "เสื้อเชิ้ต",
            "รองเท้าผ้าใบ",
            "นาฬิกา",
            "เครื่องใช้ในบ้าน",
          ]
        : ["Headphones", "Bags", "Shirt", "Sneakers", "Watch", "Home & living"];
    $("#search-hints").replaceChildren(
      ...hints.map((hint) => {
        const button = element("button", "", hint);
        button.dataset.query = hint;
        button.addEventListener("click", () => {
          state.category = null;
          state.query = hint;
          state.limit = 12;
          $("#search").value = hint;
          renderCategories();
          browse();
        });
        return button;
      }),
    );
  }
  function renderLanguage() {
    document.documentElement.lang = state.language;
    $$("[data-i18n]").forEach((node) => {
      node.textContent =
        state.language === "th" ? thaiLabels.get(node) : t(node.dataset.i18n);
    });
    $("#search").placeholder = t("placeholder");
    $("#search").setAttribute("aria-label", t("searchLabel"));
    $(".search-button").setAttribute("aria-label", t("search"));
    $("#previous-slide").setAttribute("aria-label", t("previous"));
    $("#next-slide").setAttribute("aria-label", t("next"));
    $$(".dialog-close").forEach((button) =>
      button.setAttribute("aria-label", t("close")),
    );
    $(".carousel").setAttribute("aria-label", t("promo"));
    $(".shortcuts").setAttribute(
      "aria-label",
      state.language === "th" ? "บริการ" : "Services",
    );
    $$(".promotions .side-promos img").forEach((img, index) => {
      img.alt = t(index === 0 ? "trendy" : "home");
    });
    $(".new-user-banner img").alt = t("welcome");
    $("#promo-title").textContent = t(currentPromo);
    $("#claim-coupon").textContent = t(couponClaimed ? "claimed" : "claim");
    $("#info-title").textContent = t(`${currentInfo}Title`);
    $("#info-body").textContent = t(`${currentInfo}Body`);
    renderHints();
    renderCategories();
    renderProducts();
    renderShortcuts();
    renderDeals();
    renderSlide();
    renderCart();
    if (selectedProduct) renderDetail();
  }
  $("#language").addEventListener("change", () => {
    state.language = $("#language").value === "en" ? "en" : "th";
    renderLanguage();
  });
  renderHints();
  renderCart();
  renderCountdown();
  renderSlide();
  renderShortcuts();
  renderDeals();
  renderCategories();
  renderProducts();
  function saveReviewerReports() {
    const reports = [...productVerifications.entries()]
      .filter(([, result]) => typeof result?.id === "string")
      .map(([productId, result]) => ({
        id: result.id,
        title: catalog[productId].th,
        status: result.status,
      }));
    try {
      window.sessionStorage.setItem(
        "trustcart-demo-reports",
        JSON.stringify(reports),
      );
    } catch (_) {
      /* Report ID links still work if storage is unavailable. */
    }
  }
  async function loadProductVerification(product) {
    if (typeof window.fetch !== "function") return;
    try {
      const response = await window.fetch("/v1/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_reference: "DEMO-001",
          product_name:
            product.id === checkedProduct.id
              ? "Vitamin C Supplement"
              : product.th.split(" — ")[0],
          license_holder:
            product.id === checkedProduct.id
              ? "LumaVale Demo"
              : product.en.split(" ")[0] + " Demo",
          category: "supplement",
          title: product.th,
          description: product.descriptionTh || "แบรนด์สมมติ · ผลิตภัณฑ์จำลอง",
        }),
      });
      if (!response.ok) throw new Error("verification unavailable");
      const result = await response.json();
      productVerifications.set(product.id, result);
      if (product.id === checkedProduct.id) {
        productVerification = result;
        if (typeof result?.id === "string")
          $("#reviewer-link").href =
            `/reviewer?id=${encodeURIComponent(result.id)}`;
      }
      saveReviewerReports();
    } catch (_) {
      productVerifications.set(product.id, { status: "UNKNOWN" });
      if (product.id === checkedProduct.id) productVerification = null;
    }
    renderProducts();
    if (selectedProduct?.id === product.id) renderDetail();
  }
  [checkedProduct, ...catalog.filter((product) => product.overclaim)].forEach(
    loadProductVerification,
  );
})();
