"use strict";
(() => {
  const key = "trustcart-language";
  const read = () => {
    try { return localStorage.getItem(key) === "en" ? "en" : "th"; }
    catch (_) { return "th"; }
  };
  const save = (language) => {
    try { localStorage.setItem(key, language); } catch (_) {}
  };
  window.TrustCartLocale = { read, save };

  const select = document.getElementById("workspace-language");
  if (!select) return;
  const labels = Array.from(document.querySelectorAll("[data-en]"), (node) => ({
    node, th: node.textContent, en: node.dataset.en,
  }));
  const attributes = ["placeholder", "title"].flatMap((attribute) =>
    Array.from(document.querySelectorAll(`[data-en-${attribute}]`), (node) => ({
      node, attribute, th: node.getAttribute(attribute), en: node.getAttribute(`data-en-${attribute}`),
    })),
  );
  function apply(language) {
    document.documentElement.lang = language;
    select.value = language;
    for (const label of labels) label.node.textContent = label[language];
    for (const entry of attributes) entry.node.setAttribute(entry.attribute, entry[language]);
    window.dispatchEvent(new Event("trustcart-languagechange"));
  }
  select.addEventListener("change", () => {
    const language = select.value === "en" ? "en" : "th";
    save(language);
    apply(language);
  });
  apply(read());
})();
