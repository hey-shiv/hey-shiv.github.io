/* ==========================================================================
   home.js — interaction and motion for the homepage.
   --------------------------------------------------------------------------
   Progressive: the page is complete without this file. Helpers that do not
   need libraries run first (loader, cursor, index preview, skills
   constellation, dashboards); the scroll choreography needs GSAP and Lenis.
   Reduced motion skips the loader and all choreography.
   ========================================================================== */

(function () {
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---- loader: the figure draws, notes are written, then the sheet lifts -- */
  var loaderCount = document.querySelector("[data-count]");
  if (!reduced) {
    root.classList.add("js-motion");
    // The counter reaches 100 only when everything is in: every image
    // (including ones that would normally wait for scroll), the fonts, and
    // the window load event, which covers scripts and stylesheets.
    var imgs = Array.prototype.slice.call(document.images).filter(function (im) { return im.getAttribute("src"); });
    imgs.forEach(function (im) { if (im.loading === "lazy") im.loading = "eager"; });
    var fontsDone = !(document.fonts && document.fonts.ready);
    if (!fontsDone) document.fonts.ready.then(function () { fontsDone = true; });
    var pageDone = document.readyState === "complete";
    window.addEventListener("load", function () { pageDone = true; });
    var shown = 0, t0 = performance.now(), done = false;
    var finish = function () {
      if (root.classList.contains("is-ready")) return;
      root.classList.add("is-ready");
      document.dispatchEvent(new CustomEvent("site:ready"));
    };
    var progress = function () {
      // A broken image still counts as settled, so one failure cannot hang the page.
      var loaded = imgs.filter(function (im) { return im.complete; }).length;
      return (loaded + (fontsDone ? 1 : 0) + (pageDone ? 1 : 0)) / (imgs.length + 2);
    };
    var tick = function () {
      var real = progress();
      var timeCap = Math.min(1, (performance.now() - t0) / 3000);   // long enough to see the notes written
      var target = Math.min(real, timeCap);
      shown += (target - shown) * 0.12;
      if (real < 1) shown = Math.min(shown, 0.99);                  // 100 means everything is loaded
      else if (target >= 1 && shown > 0.995) shown = 1;
      if (loaderCount) loaderCount.textContent = String(Math.round(shown * 100));
      if (shown >= 1 && !done) { done = true; setTimeout(finish, 400); return; }
      if (!done) setTimeout(tick, 16);   // a timer, not animation frames, so background tabs progress too
    };
    tick();
    // Safety net for a very slow or stalled connection: show the page anyway.
    setTimeout(function () { if (!done) { done = true; finish(); } }, 20000);
  }

  var mouse = { x: -9999, y: -9999 };
  window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  /* ---- notes and instruments in the empty margins ------------------------- */
  // A few ink notes and instruments sit in the blank space near the page's
  // left and right borders, never over content. They slide in from the edge
  // when the page opens, then drift, sway and turn as you scroll. If one would
  // ever touch text, a card or a figure, it fades out until it is clear.
  var layer = document.querySelector(".music");
  if (layer && !reduced) {
    var shapes = ["m-eighth", "m-lute", "m-beamed", "m-violin", "m-clef", "m-trumpet", "m-vinyl", "m-drum", "m-quarter", "m-fork"];
    var count = window.innerWidth < 760 ? 4 : 7;
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var bits = [];
    for (var k = 0; k < count; k++) {
      var id = shapes[k % shapes.length];
      var el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.setAttribute("viewBox", "0 0 64 64");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#" + id);
      el.appendChild(use);
      var big = /lute|violin|trumpet|drum|vinyl/.test(id);
      var size = big ? rnd(70, 96) : rnd(40, 56);
      el.setAttribute("width", size); el.setAttribute("height", size);
      if (k % 3 === 1) el.classList.add("is-coral");
      layer.appendChild(el);
      bits.push({ el: el, size: size, ax: 0, ay: 0, side: 1, speed: rnd(-0.14, 0.14), rot0: rnd(-25, 25), spin: rnd(-0.05, 0.05), phase: rnd(0, 6.28), px: 0, py: 0, enter: 0 });
    }

    // Everything the notes must stay clear of, in page coordinates.
    var avoidSel = ".site-header, .hero-copy, .deck, .hero-doodle, .stack, .constellation, .contact, " +
      "main h1, main h2, main h3, main p, main li, main a, main button, main figure, main dl, .case, .wall, .index, .cells";
    var textRects = [];   // page-coordinate boxes of everything readable, for the per-frame check
    function placeAll() {
      var W = document.documentElement.clientWidth;
      layer.style.height = "0px";                        // measure the page without the layer
      var docH = document.documentElement.scrollHeight;
      layer.style.height = docH + "px";
      var sy = window.scrollY, H = window.innerHeight;
      var pad = 48;                                      // small margin; the per-frame check hides any crossing
      var rects = Array.prototype.map.call(document.querySelectorAll(avoidSel), function (n) {
        var r = n.getBoundingClientRect();
        return { l: r.left - 24, r: r.right + 24, t: r.top + sy - pad, b: r.bottom + sy + pad };
      });
      textRects = Array.prototype.map.call(document.querySelectorAll(avoidSel), function (n) {
        var r = n.getBoundingClientRect();
        return { l: r.left - 12, r: r.right + 12, t: r.top + sy - 12, b: r.bottom + sy + 12, };
      });
      var free = function (x, y, half) {
        for (var i = 0; i < rects.length; i++) {
          var q = rects[i];
          if (x + half > q.l && x - half < q.r && y + half > q.t && y - half < q.b) return false;
        }
        return x - half > 4 && x + half < W - 4;
      };
      var top = H * 0.25, bottom = (document.querySelector(".contact") || document.body).getBoundingClientRect().top + sy - 60;
      var used = [];
      bits.forEach(function (b, i) {
        var half = b.size / 2 + 8, best = null;
        // Walk the page in bands, trying spots from the borders inward.
        var band0 = top + (bottom - top) * (i / bits.length), band1 = top + (bottom - top) * ((i + 1) / bits.length);
        var leftFirst = i % 2 === 0;
        for (var tries = 0; tries < 260 && !best; tries++) {
          var inward = Math.min(0.42, 0.04 + tries * 0.0016);   // widen slowly from the edge
          var edgeX = rnd(0.02, inward) * W;
          var x = (leftFirst ? tries % 2 === 0 : tries % 2 === 1) ? edgeX : W - edgeX;
          var y = rnd(band0, band1);
          if (!free(x, y, half)) continue;
          if (used.some(function (u) { return Math.hypot(u.x - x, u.y - y) < 220; })) continue;
          best = { x: x, y: y };
        }
        b.hidden = !best;
        b.el.style.display = best ? "" : "none";
        if (best) { b.ax = best.x; b.ay = best.y; b.side = best.x < W / 2 ? -1 : 1; used.push(best); }
      });
    }

    // Sticky cards and the fixed header move with the viewport, so check
    // their live boxes every frame.
    var liveEls = Array.prototype.slice.call(document.querySelectorAll(".case, .site-header"));
    function overSticky(x, vy, half) {
      for (var i = 0; i < liveEls.length; i++) {
        var r = liveEls[i].getBoundingClientRect();
        if (x + half > r.left - 12 && x - half < r.right + 12 && vy + half > r.top - 12 && vy - half < r.bottom + 12) return true;
      }
      return false;
    }

    var t0 = null;
    function frame(now) {
      if (root.classList.contains("is-ready") && t0 === null) t0 = now;
      var H = window.innerHeight, W = document.documentElement.clientWidth, sy = window.scrollY;
      bits.forEach(function (b, i) {
        if (b.hidden) return;
        // Slide in from the nearest border, one after another.
        var enter = t0 === null ? 0 : Math.min(1, Math.max(0, (now - t0 - 300 - i * 140) / 1400));
        enter = 1 - Math.pow(1 - enter, 3);
        var offX = (1 - enter) * b.side * (W * 0.25 + b.size);
        // Scroll-driven drift: offset measured from when the piece is centred.
        var rel = sy + H / 2 - b.ay;
        var y = b.ay + rel * b.speed;
        var x = b.ax + Math.sin(sy / 420 + b.phase) * 10 + offX;
        var rot = b.rot0 + sy * b.spin + (1 - enter) * b.side * 90;
        // Never over anything readable: fade out while overlapping, including
        // sticky cards and the fixed header, which move with the viewport.
        var half = b.size / 2, hit = false;
        for (var j = 0; j < textRects.length && !hit; j++) {
          var q = textRects[j];
          var qt = q.t, qb = q.b;
          if (x + half > q.l && x - half < q.r && y + half > qt && y - half < qb) hit = true;
        }
        if (!hit) hit = overSticky(x, y - sy, half);
        b.el.style.opacity = hit ? "0" : "";
        b.el.style.transform = "translate(" + (x - b.size / 2).toFixed(1) + "px," + (y - b.size / 2).toFixed(1) + "px) rotate(" + rot.toFixed(1) + "deg)";
      });
      requestAnimationFrame(frame);
    }

    // Keep the map of readable content fresh: images load lazily and the
    // page reflows, so re-measure on size changes and now and then on scroll.
    function measureText() {
      var sy = window.scrollY;
      textRects = Array.prototype.map.call(document.querySelectorAll(avoidSel), function (n) {
        var r = n.getBoundingClientRect();
        return { l: r.left - 12, r: r.right + 12, t: r.top + sy - 12, b: r.bottom + sy + 12 };
      });
    }
    var lastMeasure = 0;
    window.addEventListener("scroll", function () {
      var now = performance.now();
      if (now - lastMeasure > 300) { lastMeasure = now; measureText(); }
    }, { passive: true });
    if ("ResizeObserver" in window) {
      var ro, main = document.querySelector("main");
      new ResizeObserver(function () { clearTimeout(ro); ro = setTimeout(placeAll, 150); }).observe(main);
    }

    placeAll();
    requestAnimationFrame(frame);
    var rp;
    window.addEventListener("resize", function () { clearTimeout(rp); rp = setTimeout(placeAll, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAll);
    window.addEventListener("load", placeAll);
    document.addEventListener("site:ready", function () { setTimeout(placeAll, 50); });
  }

  /* ---- cursor that grows over links --------------------------------------- */
  var cursor = document.querySelector(".cursor");

  if (cursor && fine && !reduced) {
    var label = cursor.querySelector(".cursor-label");
    var cx = -200, cy = -200;
    (function follow() {
      cx += (mouse.x - cx) * 0.2; cy += (mouse.y - cy) * 0.2;
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      requestAnimationFrame(follow);
    })();
    document.addEventListener("pointerleave", function () { cursor.classList.add("is-hidden"); });
    document.addEventListener("pointerenter", function () { cursor.classList.remove("is-hidden"); });
    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest("a, button");
      if (!t || t.classList.contains("skill")) { cursor.classList.remove("is-big"); return; }
      label.textContent = t.getAttribute("data-cursor") || (t.target === "_blank" ? "Open" : "Go");
      cursor.classList.add("is-big");
    });
  }

  /* ---- work index: a painting follows the cursor over each row ------------ */
  var peek = document.querySelector(".peek");
  if (peek && fine && !reduced) {
    var peekImg = peek.querySelector("img");
    var px = 0, py = 0, peekOn = false;
    document.querySelectorAll("[data-peek]").forEach(function (a) {
      a.addEventListener("pointerenter", function () { peekImg.src = a.getAttribute("data-peek"); peek.classList.add("is-on"); peekOn = true; });
      a.addEventListener("pointerleave", function () { peek.classList.remove("is-on"); peekOn = false; });
    });
    (function followPeek() {
      px += (mouse.x + 28 - px) * 0.14; py += (mouse.y - 90 - py) * 0.14;
      if (peekOn) peek.style.transform = "translate3d(" + px + "px," + py + "px,0) rotate(" + ((mouse.x - px) * 0.04).toFixed(2) + "deg)";
      requestAnimationFrame(followPeek);
    })();
  }

  /* ---- dashboard bars grow into view -------------------------------------- */
  var dashes = document.querySelectorAll("[data-dash]");
  if ("IntersectionObserver" in window && !reduced) {
    var dio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-on"); dio.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -20% 0px" });
    dashes.forEach(function (d) { dio.observe(d); });
  } else {
    dashes.forEach(function (d) { d.classList.add("is-on"); });
  }

  /* ---- skills constellation ----------------------------------------------- */
  // Lines join skills that were used in the same project. Hover or focus a
  // skill to see where it was used; the rest of the sky dims.
  var sky = document.querySelector("[data-constellation]");
  if (sky) {
    var names = {
      song: "The First Song", cover: "Cover Song Retrieval", coil: "Coil",
      llm: "Modern Mini LLM", nn: "Neural Network from Scratch", audio: "Audio Explorer"
    };
    var svg = sky.querySelector(".links");
    var items = Array.prototype.slice.call(sky.querySelectorAll(".skill")).map(function (btn) {
      var p = (btn.getAttribute("data-projects") || "").split(/\s+/).filter(Boolean);
      return { btn: btn, li: btn.parentNode, projects: p, w: p.length };
    });
    var nameEl = sky.querySelector("[data-skill-name]");
    var usedEl = sky.querySelector("[data-skill-used]");

    // For each project, chain its skills left to right so the lines stay sparse.
    var edges = [];
    Object.keys(names).forEach(function (key) {
      var members = items.filter(function (it) { return it.projects.indexOf(key) !== -1; });
      members.sort(function (a, b) { return parseFloat(a.li.style.getPropertyValue("--x")) - parseFloat(b.li.style.getPropertyValue("--x")); });
      for (var i = 1; i < members.length; i++) edges.push({ a: members[i - 1], b: members[i], project: key });
    });
    var lines = edges.map(function () {
      var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      svg.appendChild(l);
      return l;
    });

    function centre(it, box) {
      var r = it.btn.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    }
    function drawLines() {
      var box = sky.getBoundingClientRect();
      edges.forEach(function (e, i) {
        var a = centre(e.a, box), b = centre(e.b, box);
        lines[i].setAttribute("x1", a.x); lines[i].setAttribute("y1", a.y);
        lines[i].setAttribute("x2", b.x); lines[i].setAttribute("y2", b.y);
      });
    }

    function describe(it) {
      if (!it.projects.length) return "In my toolkit, not in the projects shown here.";
      if (it.projects.length === 6) return "Used in every project here.";
      return "Used in " + it.projects.map(function (k) { return names[k]; }).join(", ") + ".";
    }
    function activate(it) {
      sky.classList.add("is-active");
      svg.classList.add("is-active");
      items.forEach(function (o) {
        var shared = o !== it && o.projects.some(function (k) { return it.projects.indexOf(k) !== -1; });
        o.btn.classList.toggle("is-on", o === it);
        o.btn.classList.toggle("is-rel", shared);
      });
      edges.forEach(function (e, i) {
        lines[i].classList.toggle("is-rel", it.projects.indexOf(e.project) !== -1);
      });
      nameEl.textContent = it.btn.textContent;
      usedEl.textContent = describe(it);
    }
    function reset() {
      sky.classList.remove("is-active");
      svg.classList.remove("is-active");
      items.forEach(function (o) { o.btn.classList.remove("is-on", "is-rel"); });
      lines.forEach(function (l) { l.classList.remove("is-rel"); });
    }
    items.forEach(function (it) {
      it.btn.addEventListener("pointerenter", function () { activate(it); });
      it.btn.addEventListener("focus", function () { activate(it); });
      it.btn.addEventListener("click", function () { activate(it); });
    });
    sky.addEventListener("pointerleave", reset);
    sky.addEventListener("focusout", function (e) { if (!sky.contains(e.relatedTarget)) reset(); });

    // Gentle depth: heavier skills drift less than light ones as the cursor moves.
    var wide = window.matchMedia("(min-width: 761px)");
    if (fine && !reduced) {
      var tx = 0, ty = 0, sx = 0, sy = 0;
      sky.addEventListener("pointermove", function (e) {
        var r = sky.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
      });
      sky.addEventListener("pointerleave", function () { tx = 0; ty = 0; });
      (function drift() {
        sx += (tx - sx) * 0.06; sy += (ty - sy) * 0.06;
        if (wide.matches && (Math.abs(sx) > 0.0005 || Math.abs(sy) > 0.0005)) {
          items.forEach(function (it) {
            var depth = 26 - it.w * 3.5;
            it.li.style.transform = "translate(-50%, -50%) translate(" + (-sx * depth).toFixed(2) + "px," + (-sy * depth).toFixed(2) + "px)";
          });
          drawLines();
        }
        requestAnimationFrame(drift);
      })();
    }

    drawLines();
    window.addEventListener("resize", drawLines);
    window.addEventListener("scroll", function () { requestAnimationFrame(drawLines); }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLines);
  }

  /* ---- contact: copy the address, and show the time in Bengaluru ------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var label = btn.querySelector("[data-copy-label]");
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var done = function () {
        label.textContent = "Copied";
        btn.classList.add("is-done");
        setTimeout(function () { label.textContent = "Copy address"; btn.classList.remove("is-done"); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.location.href = "mailto:" + text; });
      else window.location.href = "mailto:" + text;
    });
  });
  var clock = document.querySelector("[data-clock]");
  if (clock) {
    var fmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
    var tickClock = function () { clock.textContent = fmt.format(new Date()) + " IST"; };
    tickClock();
    setInterval(tickClock, 30000);
  }

  /* ---- "Ping me.." types itself when the closing band comes into view ---- */
  var ping = document.querySelector("[data-type]");
  if (ping && !reduced && "IntersectionObserver" in window) {
    var full = ping.getAttribute("data-type");
    ping.setAttribute("aria-hidden", "true");
    ping.textContent = "";
    var pio = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      pio.disconnect();
      var n = 0;
      (function typeNext() {
        ping.textContent = full.slice(0, ++n);
        if (n < full.length) setTimeout(typeNext, n === 4 ? 260 : 110 + Math.random() * 70);
      })();
    }, { threshold: 0.6 });
    pio.observe(ping);
  }

  /* ---- contact staff: optional sound -------------------------------------- */
  // Off by default. When switched on, hovering or focusing a note plays its
  // pitch as a soft, short sine tone.
  var soundBtn = document.querySelector("[data-sound]");
  var audio = null, soundOn = false;
  function playNote(li) {
    if (!soundOn) return;
    var f = parseFloat(li.getAttribute("data-freq"));
    if (!f) return;
    if (!audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
    }
    var t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.95);
    li.classList.add("is-playing");
    setTimeout(function () { li.classList.remove("is-playing"); }, 450);
  }
  if (soundBtn) {
    soundBtn.addEventListener("click", function () {
      soundOn = !soundOn;
      soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
      soundBtn.textContent = soundOn ? "[ sound: on ]" : "[ sound: off ]";
      if (soundOn && audio && audio.state === "suspended") audio.resume();
    });
  }
  document.querySelectorAll(".notes .note").forEach(function (li) {
    var hit = li.querySelector(".note-hit");
    hit.addEventListener("pointerenter", function () { playNote(li); });
    hit.addEventListener("focus", function () { playNote(li); });
  });

  /* ---- everything below needs GSAP ---------------------------------------- */
  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (reduced || !gsap || !ST) return;
  gsap.registerPlugin(ST);

  if (window.Lenis) {
    var lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (ev) {
        var id = a.getAttribute("href");
        var target = id.length > 1 && document.querySelector(id);
        if (!target) return;
        ev.preventDefault();
        lenis.scrollTo(target, { offset: -70, duration: 1.5 });
      });
    });
  }

  /* ---- hero entrance, after the loader lifts ------------------------------ */
  var mark = document.querySelector(".claim mark");
  if (mark) mark.style.setProperty("--mark", "0%");
  gsap.set(".name .line > span", { yPercent: 110 });
  gsap.set(".hero .bracket, .hero-intro, .hero-actions, .hero-doodle", { y: 20, opacity: 0 });
  gsap.set(".deck .card", { y: 140, opacity: 0 });

  function heroIn() {
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(".name .line > span", { yPercent: 0, duration: 1.4, stagger: 0.1 })
      .to(".hero .bracket, .hero-intro, .hero-actions, .hero-doodle", { y: 0, opacity: 1, duration: 1.1, stagger: 0.08 }, 0.3)
      .to(".deck .card", { y: 0, opacity: 1, duration: 1.3, stagger: 0.09, clearProps: "transform,opacity" }, 0.2)
      .add(function () { if (mark) mark.style.setProperty("--mark", "100%"); }, 0.7);
  }
  if (root.classList.contains("is-ready")) heroIn();
  else document.addEventListener("site:ready", heroIn, { once: true });

  /* ---- manifesto: words fill in as you read ------------------------------- */
  document.querySelectorAll(".fill-text").forEach(function (p) {
    var words = p.textContent.trim().split(/\s+/).map(function (w) {
      var s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      return s;
    });
    p.textContent = "";
    words.forEach(function (w, i) { if (i) p.appendChild(document.createTextNode(" ")); p.appendChild(w); });
    ST.create({
      trigger: p, start: "top 80%", end: "bottom 40%", scrub: true,
      onUpdate: function (self) {
        var n = Math.round(self.progress * words.length);
        for (var i = 0; i < words.length; i++) words[i].classList.toggle("on", i < n);
      }
    });
  });

  /* ---- index rows, cells and headings slide in ---------------------------- */
  gsap.utils.toArray(".index li, .cells .cell").forEach(function (el) {
    gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
  });
  gsap.utils.toArray(".work-head h2, .skills-head h2, .about h2").forEach(function (h) {
    gsap.from(h, { y: 60, opacity: 0, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: h, start: "top 85%" } });
  });

  /* ---- stacked cases: each card recedes as the next one arrives ----------- */
  var mm = gsap.matchMedia();
  mm.add("(min-width: 1100px) and (min-height: 700px)", function () {
    var cases = gsap.utils.toArray(".case");
    cases.forEach(function (c, i) {
      var next = cases[i + 1];
      if (!next) return;
      // Explicit start values: tweening a filter from "none" starts at 0.
      gsap.fromTo(c, { scale: 1, filter: "brightness(1)" }, {
        scale: 0.93, filter: "brightness(0.82)", ease: "none",
        scrollTrigger: { trigger: next, start: "top bottom", end: "top 20%", scrub: true }
      });
    });
  });

  /* ---- painting parallax inside the case art ------------------------------ */
  gsap.utils.toArray(".about-art > img").forEach(function (img) {
    gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
      yPercent: 6, ease: "none",
      scrollTrigger: { trigger: img.parentNode, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
})();
