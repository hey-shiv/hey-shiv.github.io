/* ==========================================================================
   signal.js — the live signal
   --------------------------------------------------------------------------
   A single continuous waveform that stands in for "signal" at the top of
   the homepage. It idles as a breathing waveform, leans toward the pointer's
   horizontal position, and — as the visitor scrolls the panel past the top
   of the viewport — dissolves into a scatter of discrete points, a small
   illustration of signal becoming representation.

   Illustrative, generated in-browser. Not model output; the caption on the
   page says so. Vanilla canvas, no dependencies, and it never starts at all
   under prefers-reduced-motion.
   ========================================================================== */
(function () {
  var canvas = document.getElementById("live-signal");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1;
  var t = 0;
  var running = false;
  var raf = null;
  var pointerX = 0.5;   // 0..1 across the canvas
  var targetPointerX = 0.5;
  var morph = 0;         // 0 = pure waveform, 1 = fully scattered points

  var N = 160; // sample points along the signal

  function rand(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // Precompute a stable scatter target for each sample, arranged into three
  // loose clusters — a nod to representation/retrieval without claiming to
  // be one.
  var clusters = [
    { x: 0.2, y: 0.32 },
    { x: 0.52, y: 0.68 },
    { x: 0.8, y: 0.28 },
  ];
  var scatter = [];
  for (var i = 0; i < N; i++) {
    var c = clusters[i % clusters.length];
    scatter.push({
      x: c.x + (rand(i * 3.1) - 0.5) * 0.22,
      y: c.y + (rand(i * 7.7 + 2) - 0.5) * 0.3,
    });
  }

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

    var ink = css("--text-secondary", "#aeb3ba");
    var signal = css("--signal", "#d7ff3f");
    var faint = css("--border-strong", "#34383f");

    ctx.clearRect(0, 0, W, H);

    var midY = H * 0.52;
    var amp = H * 0.3;
    var lean = (pointerX - 0.5) * 0.6;

    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";

    if (morph < 0.999) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - morph * 1.15);
      ctx.strokeStyle = ink;
      ctx.beginPath();
      for (var sx = 0; sx <= N; sx++) {
        var u = sx / N;
        var env = 0.3 + 0.7 * Math.pow(Math.sin(u * Math.PI), 0.6);
        var s =
          Math.sin(u * 22 + t * 0.9 + lean * 6) * 0.5 +
          Math.sin(u * 61 + t * 1.6) * 0.28 +
          Math.sin(u * 143 + t * 0.5) * 0.14;
        var x = u * W;
        var y = midY + s * env * amp * (1 - morph * 0.4);
        if (sx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (morph > 0.001) {
      var pulse = 0.55 + 0.45 * Math.sin(t * 0.8);
      for (var i2 = 0; i2 < N; i2++) {
        var u2 = i2 / N;
        var env2 = 0.3 + 0.7 * Math.pow(Math.sin(u2 * Math.PI), 0.6);
        var s2 =
          Math.sin(u2 * 22 + t * 0.9 + lean * 6) * 0.5 +
          Math.sin(u2 * 61 + t * 1.6) * 0.28 +
          Math.sin(u2 * 143 + t * 0.5) * 0.14;
        var wx = u2 * W;
        var wy = midY + s2 * env2 * amp;

        var target = scatter[i2];
        var px = target.x * W;
        var py = target.y * H;

        var x = wx + (px - wx) * morph;
        var y = wy + (py - wy) * morph;

        var onSignal = i2 % 11 === 0;
        ctx.globalAlpha = 0.25 + morph * (onSignal ? 0.75 : 0.4);
        ctx.fillStyle = onSignal ? signal : faint;
        var r = onSignal ? 2.6 : 1.6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (morph > 0.4) {
        ctx.save();
        ctx.globalAlpha = (morph - 0.4) / 0.6 * 0.35 * (0.6 + 0.4 * pulse);
        ctx.strokeStyle = signal;
        ctx.lineWidth = 1;
        clusters.forEach(function (c) {
          var cx = c.x * W, cy = c.y * H;
          ctx.beginPath();
          ctx.arc(cx, cy, 26 + pulse * 4, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      }
    }
  }

  function frame() {
    t += 0.016;
    pointerX += (targetPointerX - pointerX) * 0.06;
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

  canvas.addEventListener("pointermove", function (e) {
    var rect = canvas.getBoundingClientRect();
    targetPointerX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  });

  canvas.addEventListener("pointerleave", function () {
    targetPointerX = 0.5;
  });

  function updateMorph() {
    var wrap = canvas.closest(".live-signal");
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    // 0 while the panel is on screen, sliding to 1 as it passes above the
    // viewport — signal dissolving into representation on the way past.
    var progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    morph = progress;
    if (reduced) draw();
  }

  window.addEventListener("scroll", updateMorph, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0.02 }).observe(canvas);
  } else {
    start();
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }

  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  resize();
  updateMorph();
  if (reduced) draw();
})();
