"use strict";
document.querySelector("#login-form").onsubmit = async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.querySelector("#username").value,
        password: document.querySelector("#password").value,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.detail);
    const next = new URLSearchParams(location.search).get("next");
    if (result.role === "reviewer" && next) {
      const target = new URL(next, location.origin);
      if (
        target.origin === location.origin &&
        (target.pathname === "/agency" ||
          /^\/agency\/submissions\/[0-9a-f-]{36}$/.test(target.pathname))
      ) {
        location.href = target.pathname + target.search;
        return;
      }
    }
    location.href =
      result.role === "seller"
        ? "/seller"
        : result.role === "reviewer"
          ? "/agency"
          : "/";
  } catch (error) {
    document.querySelector("#login-feedback").textContent = error.message;
    button.disabled = false;
  }
};
