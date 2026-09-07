/* ==========================================================================
   Hero visualisation — signal → representation → retrieval
   --------------------------------------------------------------------------
   An illustration of the shape of the cover-song retrieval pipeline, drawn
   from generated data. It is NOT model output and the caption says so.

   Three panels, left to right:
     1. a waveform, the signal as it arrives
     2. a 12-row chroma field, the representation the system actually uses
     3. an embedding scatter with the query's nearest neighbours linked

   Vanilla canvas, no dependencies. Colours are read from the CSS custom
   properties so it follows the theme. Animation stops when the canvas is off
   screen, and never starts at all under prefers-reduced-motion.
   ========================================================================== */
(function () {
  var canvas = document.getElementById("hero-viz");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1;
  var t = 0;
  var running = false;
  var raf = null;

  var COLS = 40;   // chroma frames
  var ROWS = 12;   // pitch classes
  var PTS = 34;    // embedding points

  // ---- Deterministic pseudo-random, so the picture is stable across loads.
  function rand(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // A repeating chord progression, as pitch classes.
  var MOTIF = [0, 4, 7, 11, 7, 4, 2, 9];

  // ---- Precomputed chroma field: energy at root, third and fifth.
  var field = [];
  for (var c = 0; c < COLS; c++) {
    var root = MOTIF[Math.floor(c / 3) % MOTIF.length];
    var col = [];
    for (var r = 0; r < ROWS; r++) {
      var e = 0.06 + rand(c * 31 + r * 7) * 0.1;
      if (r === root) e = 1;
      else if (r === (root + 7) % 12) e = 0.62;
      else if (r === (root + 4) % 12) e = 0.44;
      col.push(e);
    }
    field.push(col);
  }

  // ---- Embedding points. One query, three true neighbours near it.
  var pts = [];
  for (var i = 0; i < PTS; i++) {
    pts.push({ x: rand(i * 3.7), y: rand(i * 9.1 + 5), q: false, n: false });
  }
  pts[0].x = 0.52; pts[0].y = 0.44; pts[0].q = true;         // query
  var NB = [1, 2, 3];
  pts[1].x = 0.40; pts[1].y = 0.33;
  pts[2].x = 0.63; pts[2].y = 0.36;
  pts[3].x = 0.47; pts[3].y = 0.62;
  NB.forEach(function (k) { pts[k].n = true; });

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    if (!W || !H) return;

    var ink = css("--text", "#14161a");
    var muted = css("--border-strong", "#cbcbc5");
    var accent = css("--accent", "#1f3a6e");

    ctx.clearRect(0, 0, W, H);

    var gap = Math.max(18, W * 0.045);
    var pw = (W - gap * 2) / 3;          // panel width
    var padY = 10;
    var innerH = H - padY * 2;

    // ---------------------------------------------------------------- 1. signal
    var x0 = 0;
    var midY = H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.85;
    for (var sx = 0; sx <= pw; sx++) {
      var u = sx / pw;
      // Amplitude envelope with a few transients, plus a slow drift.
      var env = 0.35 + 0.65 * Math.pow(Math.sin(u * Math.PI), 0.7);
      var s =
        Math.sin(u * 46 + t * 0.9) * 0.55 +
        Math.sin(u * 111 + t * 1.7) * 0.28 +
        Math.sin(u * 233 + t * 0.4) * 0.14;
      var y = midY + s * env * (innerH * 0.42);
      if (sx === 0) ctx.moveTo(x0 + sx, y); else ctx.lineTo(x0 + sx, y);
    }
    ctx.stroke();
    ctx.restore();

    // ------------------------------------------------------- 2. chroma field
    var x1 = pw + gap;
    var cw = pw / COLS;
    var ch = innerH / ROWS;
    var sweep = (t * 0.05) % 1;                   // playhead position 0..1
    for (var cc = 0; cc < COLS; cc++) {
      for (var rr = 0; rr < ROWS; rr++) {
        var v = field[cc][rr];
        // Brighten cells near the playhead so the eye follows it.
        var d = Math.abs(cc / COLS - sweep);
        var lift = Math.max(0, 1 - d * 9);
        var a = v * (0.30 + lift * 0.7);
        if (a < 0.02) continue;
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = v > 0.4 && lift > 0.25 ? accent : ink;
        ctx.fillRect(
          x1 + cc * cw,
          padY + (ROWS - 1 - rr) * ch,
          Math.max(1, cw - 1),
          Math.max(1, ch - 1)
        );
      }
    }
    ctx.globalAlpha = 1;

    // --------------------------------------------------- 3. embedding + kNN
    var x2 = (pw + gap) * 2;
    var px = function (p) { return x2 + p.x * pw; };
    var py = function (p) { return padY + p.y * innerH; };

    // Neighbour links, breathing slowly.
    var pulse = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.6));
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    NB.forEach(function (k) {
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.moveTo(px(pts[0]), py(pts[0]));
      ctx.lineTo(px(pts[k]), py(pts[k]));
      ctx.stroke();
    });
    ctx.restore();

    pts.forEach(function (p, i) {
      var r = p.q ? 4.2 : p.n ? 3.2 : 2;
      ctx.beginPath();
      ctx.globalAlpha = p.q || p.n ? 1 : 0.28;
      ctx.fillStyle = p.q || p.n ? accent : muted;
      ctx.arc(px(p), py(p), r, 0, Math.PI * 2);
      ctx.fill();
      if (p.q) {                      // ring around the query
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px(p), py(p), 8 + pulse * 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }

  function frame() {
    t += 0.016;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // Only animate while visible, and only if motion is welcome.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0.05 }).observe(canvas);
  } else {
    start();
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }

  // Redraw on theme change so the canvas follows the tokens.
  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  resize();
  if (reduced) draw();
})();
