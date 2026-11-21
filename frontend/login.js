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
    location.href =
      result.role === "seller"
        ? "/seller"
        : result.role === "reviewer"
          ? "/reviewer"
          : "/";
  } catch (error) {
    document.querySelector("#login-feedback").textContent = error.message;
    button.disabled = false;
  }
};
