/* ==========================================================================
   site.js — theme, motion, media
   --------------------------------------------------------------------------
   No dependencies. Everything degrades: if this file fails to load, the page
   is still fully readable, every section is visible, and video simply sits on
   its poster frame.
   ========================================================================== */

/* ---------------------------------------------------------------- theme --- */
(function () {
  var storageKey = "site-theme";
  var root = document.documentElement;

  function getTheme() {
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return saved;
    } catch (error) {}
    return "light";
  }

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "theme-toggle";
  toggle.setAttribute("data-theme-toggle", "");

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    toggle.textContent = theme === "dark" ? "☼" : "☾";
    toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    var label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
  }

  (document.querySelector(".site-header") || document.body).appendChild(toggle);
  applyTheme(root.dataset.theme || getTheme());

  toggle.addEventListener("click", function () {
    var next = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(storageKey, next);
    } catch (error) {}
    applyTheme(next);
  });
})();

/* --------------------------------------------------------------- motion --- */
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = document.querySelectorAll(".rise");
  if (!items.length || reduced || !("IntersectionObserver" in window)) return;

  // Only hide things once we know we can reveal them again.
  document.documentElement.classList.add("js-motion");

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.02 }
  );

  items.forEach(function (el) {
    io.observe(el);
  });

  // Safety net: if anything is still hidden shortly after load, show it.
  window.addEventListener("load", function () {
    setTimeout(function () {
      document.querySelectorAll(".rise:not(.in)").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add("in");
      });
    }, 400);
  });
})();

/* ---------------------------------------------------------------- media --- */
(function () {
  var vids = document.querySelectorAll("video[data-autoplay]");
  if (!vids.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  vids.forEach(function (v) {
    // Give people a control if we are not going to play it for them.
    if (reduced) {
      v.setAttribute("controls", "");
      v.preload = "metadata";
      return;
    }

    if (!("IntersectionObserver" in window)) {
      v.preload = "metadata";
      v.setAttribute("controls", "");
      return;
    }

    new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (v.preload !== "auto") v.preload = "auto";
            var p = v.play();
            if (p && p.catch) p.catch(function () {
              // Autoplay refused: hand control back to the reader.
              v.setAttribute("controls", "");
            });
          } else if (!v.paused) {
            v.pause();
          }
        });
      },
      { threshold: 0.25 }
    ).observe(v);
  });
})();
