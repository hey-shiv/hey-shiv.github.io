/* ==========================================================================
   site.js — theme, motion, media
   --------------------------------------------------------------------------
   No dependencies. Everything degrades: if this file fails to load, the page
   is still fully readable, every section is visible, and video simply sits on
   its poster frame.
   ========================================================================== */

/* ---------------------------------------------------------------- theme --- */
(function () {
  var storageKey = "site-theme-v2";
  var root = document.documentElement;

  function getTheme() {
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return saved;
    } catch (error) {}
    return "dark";
  }

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "theme-toggle";
  toggle.setAttribute("data-theme-toggle", "");

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    toggle.textContent = theme === "light" ? "◐" : "◑";
    toggle.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    var label = theme === "light" ? "Switch to instrument mode" : "Switch to paper mode";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
  }

  (document.querySelector(".site-header") || document.body).appendChild(toggle);
  applyTheme(root.dataset.theme || getTheme());

  toggle.addEventListener("click", function () {
    var next = root.dataset.theme === "light" ? "dark" : "light";
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

/* -------------------------------------------------------- system film --- */
/* This is deliberately a single scroll field, not a navigation diagram. The
   same typographic material moves out of register as each question takes over. */
(function () {
  var section = document.querySelector(".system-transform");
  if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var stages = [0, 0.21, 0.42, 0.62, 0.8, 1];

  function triangle(progress, centre, width) {
    return Math.max(0, 1 - Math.abs(progress - centre) / width);
  }

  function update() {
    var rect = section.getBoundingClientRect();
    var distance = Math.max(1, section.offsetHeight - window.innerHeight);
    var progress = Math.max(0, Math.min(1, -rect.top / distance));
    section.style.setProperty("--system-progress", progress.toFixed(4));
    section.style.setProperty("--system-audio", triangle(progress, stages[0], 0.26).toFixed(3));
    section.style.setProperty("--system-representation", triangle(progress, stages[1], 0.22).toFixed(3));
    section.style.setProperty("--system-retrieval", triangle(progress, stages[2], 0.22).toFixed(3));
    section.style.setProperty("--system-evaluation", triangle(progress, stages[3], 0.2).toFixed(3));
    section.style.setProperty("--system-failure", triangle(progress, stages[4], 0.16).toFixed(3));
    section.style.setProperty("--system-resolution", Math.max(0, (progress - 0.84) / 0.16).toFixed(3));
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

/* ---------------------------------------------------------- signal rail --- */
(function () {
  var rail = document.querySelector(".signal-rail");
  var nodes = document.querySelectorAll("[data-signal]");
  if (!rail || !nodes.length || !("IntersectionObserver" in window)) return;

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.getAttribute("data-signal");
        var tick = rail.querySelector('li[data-signal="' + id + '"]');
        if (!tick) return;
        if (entry.isIntersecting) {
          rail.querySelectorAll("li.is-active").forEach(function (li) { li.classList.remove("is-active"); });
          tick.classList.add("is-active");
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
  );

  nodes.forEach(function (el) { io.observe(el); });
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

/* ---------------------------------------------------------------- worlds --- */
/* Scroll drives one continuous transformation: the field morphs through its
   states as the steps beside it pass the middle of the viewport. Normal
   scrolling is untouched — nothing is hijacked, nothing is trapped. */
(function () {
  if (!window.Instrument) return;

  document.querySelectorAll("[data-world]").forEach(function (world) {
    var canvas = world.querySelector("canvas[data-states]");
    var stepsEl = world.querySelector(".world-steps");
    if (!canvas || !stepsEl) return;

    var steps = Array.prototype.slice.call(world.querySelectorAll(".world-step"));
    var names = canvas.getAttribute("data-states").split(",");
    var hudStage = world.querySelector(".hud-stage");
    var hudLabel = world.querySelector(".hud-label");
    var last = names.length - 1;

    var field = window.Instrument.field(canvas, {
      states: names,
      onStage: function (index) {
        var step = steps[index];
        if (hudStage) {
          hudStage.textContent =
            String(index + 1).padStart(2, "0") + " / " + String(steps.length).padStart(2, "0");
        }
        if (hudLabel && step) hudLabel.textContent = step.getAttribute("data-stage") || "";
        steps.forEach(function (s, i) { s.classList.toggle("is-active", i === index); });
      }
    });

    if (!field) return;

    var ticking = false;

    /* Stage n is reached when step n's centre crosses the middle of the
       viewport, and the field morphs continuously between two steps as the
       reader moves from one to the next. Derived from the real step
       positions so unequal step heights stay in sync. */
    function update() {
      ticking = false;
      if (!steps.length) return;

      var mid = window.innerHeight * 0.5;
      var centres = steps.map(function (s) {
        var r = s.getBoundingClientRect();
        return r.top + r.height / 2;
      });

      var stage = 0;
      if (mid <= centres[0]) {
        stage = 0;
      } else if (mid >= centres[last]) {
        stage = last;
      } else {
        for (var i = 0; i < last; i++) {
          if (mid >= centres[i] && mid < centres[i + 1]) {
            var span = centres[i + 1] - centres[i];
            stage = i + (span > 0 ? (mid - centres[i]) / span : 0);
            break;
          }
        }
      }

      field.setStage(stage);
    }

    function onScroll() {
      /* rAF is throttled in background tabs; fall back to a direct call so
         the field never sits on a stale stage. */
      if (document.hidden) { update(); return; }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  });
})();

/* -------------------------------------------------------- failure network --- */
/* The graph stays on screen; selecting a node swaps the detail beside it.
   With JS off, every case is simply readable in sequence. */
(function () {
  var graph = document.querySelector("[data-fgraph]");
  if (!graph) return;

  var nodes = Array.prototype.slice.call(graph.querySelectorAll(".fnode"));
  var cases = Array.prototype.slice.call(document.querySelectorAll(".fcase"));
  if (!nodes.length || !cases.length) return;

  document.documentElement.classList.add("js-on");

  function activate(id) {
    nodes.forEach(function (n) {
      var on = n.getAttribute("data-case") === id;
      n.classList.toggle("is-active", on);
      n.setAttribute("aria-pressed", on ? "true" : "false");
    });
    graph.querySelectorAll(".fedge").forEach(function (e) {
      e.classList.toggle("is-lit", e.getAttribute("data-case") === id);
    });
    cases.forEach(function (c) {
      c.hidden = c.getAttribute("data-case") !== id;
    });
  }

  nodes.forEach(function (n) {
    n.addEventListener("click", function () { activate(n.getAttribute("data-case")); });
    n.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        activate(n.getAttribute("data-case"));
      }
    });
  });

  activate(nodes[0].getAttribute("data-case"));
})();

/* ------------------------------------------------- representation switcher --- */
(function () {
  if (!window.Instrument) return;

  var rep = document.querySelector("[data-rep]");
  if (!rep) return;

  var canvas = rep.querySelector("canvas[data-states]");
  var buttons = Array.prototype.slice.call(rep.querySelectorAll(".rep-switch button"));
  var note = rep.querySelector("[data-rep-note]");
  if (!canvas || !buttons.length) return;

  var field = window.Instrument.field(canvas, {
    states: canvas.getAttribute("data-states").split(",")
  });
  if (!field) return;

  function select(index) {
    field.setStage(index);
    buttons.forEach(function (b, i) {
      b.setAttribute("aria-pressed", i === index ? "true" : "false");
    });
    if (note) note.textContent = buttons[index].getAttribute("data-note") || "";
  }

  buttons.forEach(function (b, i) {
    b.addEventListener("click", function () { select(i); });
  });

  select(0);
})();

/* ----------------------------------------------------------- signal panel --- */
/* The hero field: a waveform that resolves into clustered points as the
   panel leaves the viewport. Same engine, no steps. */
(function () {
  if (!window.Instrument) return;

  document.querySelectorAll("[data-field]").forEach(function (wrap) {
    var canvas = wrap.querySelector("canvas[data-states]");
    if (!canvas) return;

    var names = canvas.getAttribute("data-states").split(",");
    var field = window.Instrument.field(canvas, { states: names });
    if (!field) return;

    var last = names.length - 1;
    var ticking = false;

    function update() {
      ticking = false;
      var rect = wrap.getBoundingClientRect();
      var progress = -rect.top / Math.max(1, rect.height);
      field.setStage(Math.max(0, Math.min(1, progress)) * last);
    }

    function onScroll() {
      if (document.hidden) { update(); return; }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  });
})();
