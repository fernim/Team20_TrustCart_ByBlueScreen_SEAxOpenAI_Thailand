"use strict";
window.TrustCartSession = (() => {
  let user = { role: "guest" };
  const ready = fetch("/v1/auth/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : user))
    .then((value) => {
      user = value;
      return user;
    })
    .catch(() => user);
  async function api(path, options = {}) {
    await ready;
    const headers = { ...options.headers };
    if (options.method && options.method !== "GET")
      headers["X-CSRF-Token"] = user.csrf_token || "";
    const response = await fetch(path, {
      ...options,
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      let detail = "Request failed";
      try {
        const body = await response.json();
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      } catch (_) {}
      const error = new Error(detail);
      error.status = response.status;
      throw error;
    }
    return response;
  }
  const json = async (path, body, method = "POST") =>
    (
      await api(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json();
  ready.then((account) => {
    for (const bar of document.querySelectorAll(".integration-nav")) {
      bar.replaceChildren();
      for (const [role, path, label] of [
        ["seller", "/seller", "Seller Centre"],
        ["reviewer", "/agency", "Agency workspace"],
      ]) {
        if (account.role === role) {
          const a = document.createElement("a");
          a.href = path;
          a.textContent = label;
          bar.append(a);
        }
      }
      if (account.role === "guest") {
        const a = document.createElement("a");
        a.href = "/login";
        a.textContent = "Sign in / เข้าสู่ระบบ";
        bar.append(a);
      } else {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `${account.id} · Sign out`;
        b.onclick = async () => {
          await api("/v1/auth/logout", { method: "POST" });
          location.href = "/login";
        };
        bar.append(b);
      }
    }
  });
  return { ready, api, json };
})();
