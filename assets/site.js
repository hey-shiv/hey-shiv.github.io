(function () {
  var storageKey = "site-theme";
  var root = document.documentElement;

  function getTheme() {
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") {
        return saved;
      }
    } catch (error) {}

    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    if (toggle) {
      toggle.textContent = theme === "dark" ? "☼" : "☾";
      toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
      toggle.setAttribute(
        "title",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    }
  }

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "theme-toggle";
  toggle.setAttribute("data-theme-toggle", "");
  toggle.textContent = "☾";
  var header = document.querySelector(".site-header");
  (header || document.body).appendChild(toggle);

  applyTheme(root.dataset.theme || getTheme());

  toggle.addEventListener("click", function () {
    var nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (error) {}

    applyTheme(nextTheme);
  });
})();
