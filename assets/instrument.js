/* ==========================================================================
   instrument.js — one object, many representations
   --------------------------------------------------------------------------
   A single particle field that can arrange itself into any of the
   representations this site talks about: a waveform, a chroma grid, a
   circular transposition ring, two sequences under alignment, an embedding
   scatter, a retrieval result, a ranked list — and, for Audio Explorer, an
   STFT / Mel / MFCC / rhythm view.

   Everything on the site that moves is the SAME field changing state. That
   is the whole idea: signal becoming representation becoming retrieval.

   Every visualisation here is ILLUSTRATIVE. It is generated in-browser from
   deterministic functions, not from model output, and the pages that use it
   say so. No number drawn here is presented as a measured result.

   Vanilla canvas. No dependencies. Honours prefers-reduced-motion by
   dropping the idle animation and drawing states as static compositions.
   ========================================================================== */
(function (global) {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function hash(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  /* A short chord motif, as pitch classes — gives the chroma view a shape
     that reads as music rather than noise. */
  var MOTIF = [0, 4, 7, 11, 7, 4, 2, 9];

  var CLUSTERS = [
    { x: 0.20, y: 0.30 },
    { x: 0.46, y: 0.68 },
    { x: 0.72, y: 0.32 },
    { x: 0.84, y: 0.68 },
    { x: 0.36, y: 0.22 }
  ];

  var QUERY_CLUSTER = 1;
  var SELECTED_SHIFT = 7; /* the transposition the OTI view settles on */

  /* A monotone warping path: horizontal, vertical and diagonal steps, the
     shape a real DTW alignment traces through a cost matrix. */
  var DTW_PATH = (function () {
    var path = [], a = 0, b = 0, n = 0;
    while (a < 1 && b < 1 && n < 400) {
      path.push([a, b]);
      var r = hash(++n * 7.13);
      if (r < 0.30) a += 0.045;
      else if (r < 0.60) b += 0.045;
      else { a += 0.038; b += 0.038; }
    }
    return path;
  })();

  /* ---------------------------------------------------------------- states */
  /* Each state writes a target position, radius and role into `out`.
     role 0 = quiet, 1 = active/signal, 2 = the query point. */

  var states = {};

  states.wave = function (i, S, out) {
    var k = i / (S.N - 1);
    var env = 0.30 + 0.70 * Math.pow(Math.sin(k * Math.PI), 0.6);
    var s =
      Math.sin(k * 20 + S.t * 0.9 + S.lean * 5) * 0.50 +
      Math.sin(k * 57 + S.t * 1.5) * 0.27 +
      Math.sin(k * 131 + S.t * 0.5) * 0.13;
    out.x = S.P + k * S.iw;
    out.y = S.H * 0.5 + s * env * S.ih * 0.42;
    out.role = i % 16 === 0 ? 1 : 0;
    out.r = out.role ? 2.1 : 1.4;
  };

  states.chroma = function (i, S, out) {
    var rows = 12, cols = Math.floor(S.N / rows);
    var row = i % rows, col = Math.floor(i / rows);
    var root = MOTIF[Math.floor(col / 3) % MOTIF.length];
    var energy = 0.08 + hash(col * 31 + row * 7) * 0.10;
    if (row === root) energy = 1;
    else if (row === (root + 7) % 12) energy = 0.62;
    else if (row === (root + 4) % 12) energy = 0.44;
    out.x = S.P + (col + 0.5) * (S.iw / cols);
    out.y = S.P + (rows - 1 - row + 0.5) * (S.ih / rows);
    out.role = energy > 0.4 ? 1 : 0;
    out.r = 1.1 + energy * 2.3;
  };

  states.oti = function (i, S, out) {
    var slot = i % 12, band = Math.floor(i / 12);
    var bands = Math.floor(S.N / 12);
    var R = Math.min(S.iw, S.ih) * 0.34;
    var angle = -Math.PI / 2 + slot * (Math.PI * 2 / 12);
    var rad = R + (band - (bands - 1) / 2) * (R * 0.045);
    out.x = S.W / 2 + Math.cos(angle) * rad;
    out.y = S.H / 2 + Math.sin(angle) * rad;
    out.role = slot === SELECTED_SHIFT ? 1 : 0;
    out.r = out.role ? 2.3 : 1.3;
  };

  states.dtw = function (i, S, out) {
    var half = Math.floor(S.N / 2);
    var seq = i < half ? 0 : 1;
    var j = i % half, k = j / (half - 1);
    out.x = S.P + k * S.iw;
    out.y = seq
      ? S.H * 0.70 + Math.sin(k * 11 + 1.7 + S.t * 0.35) * S.ih * 0.05
      : S.H * 0.30 + Math.sin(k * 14 + S.t * 0.4) * S.ih * 0.05;
    out.role = j % 9 === 0 ? 1 : 0;
    out.r = out.role ? 2.1 : 1.4;
  };

  states.embed = function (i, S, out) {
    var c = CLUSTERS[i % CLUSTERS.length];
    out.x = c.x * S.W + (hash(i * 3.7) - 0.5) * S.W * 0.15;
    out.y = c.y * S.H + (hash(i * 9.1 + 5) - 0.5) * S.H * 0.24;
    out.role = 0;
    out.r = 1.7;
  };

  states.retrieve = function (i, S, out) {
    states.embed(i, S, out);
    var c = i % CLUSTERS.length;
    if (i === QUERY_CLUSTER) { out.role = 2; out.r = 3.4; }
    else if (c === QUERY_CLUSTER && i < CLUSTERS.length * 5) { out.role = 1; out.r = 2.6; }
    else { out.role = 0; out.r = 1.5; }
  };

  states.rank = function (i, S, out) {
    var rows = 12, per = Math.floor(S.N / rows);
    var row = Math.floor(i / per), col = i % per;
    var len = 1 - row * 0.055 - hash(row * 5.3) * 0.10;
    out.x = S.P + (col + 0.5) * ((S.iw * len) / per);
    out.y = S.P + (row + 0.5) * (S.ih / rows);
    /* Relevant items landing at ranks 1, 2, 4 and 7 — an illustration of
       what MAP / MRR / Recall@K measure, not a measured ranking. */
    out.role = row === 0 || row === 1 || row === 3 || row === 6 ? 1 : 0;
    out.r = out.role ? 2.0 : 1.3;
  };

  /* ---- Audio Explorer representations ---- */

  states.stft = function (i, S, out) {
    var rows = 16, cols = Math.floor(S.N / rows);
    var row = i % rows, col = Math.floor(i / rows);
    var energy =
      Math.pow(1 - row / rows, 1.7) *
      (0.45 + 0.55 * Math.abs(Math.sin(col * 0.45 + row * 0.22)));
    out.x = S.P + (col + 0.5) * (S.iw / cols);
    out.y = S.P + (rows - 1 - row + 0.5) * (S.ih / rows);
    out.role = energy > 0.55 ? 1 : 0;
    out.r = 1.0 + energy * 2.4;
  };

  states.mel = function (i, S, out) {
    var rows = 16, cols = Math.floor(S.N / rows);
    var row = i % rows, col = Math.floor(i / rows);
    /* Mel spacing: detail is spent low, compressed high. */
    var warp = Math.pow((row + 0.5) / rows, 1.9);
    var energy =
      Math.pow(1 - row / rows, 1.2) *
      (0.5 + 0.5 * Math.abs(Math.sin(col * 0.38 + row * 0.5)));
    out.x = S.P + (col + 0.5) * (S.iw / cols);
    out.y = S.P + S.ih - warp * S.ih;
    out.role = energy > 0.55 ? 1 : 0;
    out.r = 1.1 + energy * 2.6;
  };

  states.mfcc = function (i, S, out) {
    var rows = 13, cols = Math.floor(S.N / rows);
    var row = i % rows, col = Math.floor(i / rows);
    var coef = Math.sin(col * 0.3 + row * 1.1) * Math.pow(1 - row / rows, 0.8);
    var laneH = S.ih / rows;
    out.x = S.P + (col + 0.5) * (S.iw / cols);
    out.y = S.P + (row + 0.5) * laneH + coef * laneH * 0.34;
    out.role = Math.abs(coef) > 0.62 ? 1 : 0;
    out.r = 1.1 + Math.abs(coef) * 2.0;
  };

  states.rhythm = function (i, S, out) {
    var beats = 8;
    var beat = i % beats;
    var depth = Math.floor(i / beats);
    var maxDepth = Math.floor(S.N / beats);
    var strong = beat % 4 === 0;
    var x = S.P + (beat + 0.5) * (S.iw / beats);
    var spread = strong ? 0.9 : 0.45;
    out.x = x + (hash(i * 2.3) - 0.5) * S.iw * 0.02;
    out.y = S.H * 0.5 + (depth / maxDepth - 0.5) * S.ih * spread;
    out.role = strong && depth < maxDepth * 0.55 ? 1 : 0;
    out.r = strong ? 1.9 : 1.2;
  };

  /* ----------------------------------------------------------------- decor */
  /* Structure drawn behind or through the points: the line the waveform
     traces, chroma lanes, the transposition ring, the alignment path,
     retrieval links, the rank axis. Faded in and out with the morph. */

  var decor = {};

  decor.wave = function (ctx, S, a, C) {
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    ctx.strokeStyle = C.quiet;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (var i = 0; i <= 200; i++) {
      var k = i / 200;
      var env = 0.30 + 0.70 * Math.pow(Math.sin(k * Math.PI), 0.6);
      var s =
        Math.sin(k * 20 + S.t * 0.9 + S.lean * 5) * 0.50 +
        Math.sin(k * 57 + S.t * 1.5) * 0.27 +
        Math.sin(k * 131 + S.t * 0.5) * 0.13;
      var x = S.P + k * S.iw, y = S.H * 0.5 + s * env * S.ih * 0.42;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  decor.chroma = function (ctx, S, a, C) {
    ctx.save();
    ctx.globalAlpha = a * 0.5;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    for (var r = 0; r < 12; r++) {
      var y = S.P + (r + 0.5) * (S.ih / 12);
      ctx.beginPath();
      ctx.moveTo(S.P, y);
      ctx.lineTo(S.P + S.iw, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  decor.oti = function (ctx, S, a, C) {
    var cx = S.W / 2, cy = S.H / 2;
    var R = Math.min(S.iw, S.ih) * 0.34;
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    for (var s = 0; s < 12; s++) {
      var ang = -Math.PI / 2 + s * (Math.PI * 2 / 12);
      var sel = s === SELECTED_SHIFT;
      var inner = R * (sel ? 0.72 : 0.88);
      ctx.globalAlpha = a * (sel ? 0.95 : 0.4);
      ctx.strokeStyle = sel ? C.signal : C.line;
      ctx.lineWidth = sel ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
      ctx.lineTo(cx + Math.cos(ang) * (R * 1.1), cy + Math.sin(ang) * (R * 1.1));
      ctx.stroke();
    }

    /* A scan that sweeps the twelve candidate shifts and settles. */
    var sweep = reduced ? SELECTED_SHIFT : (S.t * 0.55) % 12;
    var settle = clamp((S.t - 6) / 3, 0, 1);
    var pos = lerp(sweep, SELECTED_SHIFT, settle);
    var pa = -Math.PI / 2 + pos * (Math.PI * 2 / 12);
    ctx.globalAlpha = a * 0.7;
    ctx.strokeStyle = C.signal;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(pa) * R * 0.92, cy + Math.sin(pa) * R * 0.92);
    ctx.stroke();
    ctx.restore();
  };

  decor.dtw = function (ctx, S, a, C) {
    var n = DTW_PATH.length;
    var shown = reduced ? n : Math.floor(clamp((S.t % 9) / 5, 0, 1) * n);
    ctx.save();
    for (var i = 0; i < n; i += 2) {
      var p = DTW_PATH[i];
      var lit = i < shown;
      ctx.globalAlpha = a * (lit ? 0.5 : 0.14);
      ctx.strokeStyle = lit ? C.signal : C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(S.P + p[0] * S.iw, S.H * 0.30 + Math.sin(p[0] * 14 + S.t * 0.4) * S.ih * 0.05);
      ctx.lineTo(S.P + p[1] * S.iw, S.H * 0.70 + Math.sin(p[1] * 11 + 1.7 + S.t * 0.35) * S.ih * 0.05);
      ctx.stroke();
    }
    ctx.restore();
  };

  decor.retrieve = function (ctx, S, a, C) {
    var q = { x: CLUSTERS[QUERY_CLUSTER].x * S.W, y: CLUSTERS[QUERY_CLUSTER].y * S.H };
    var pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(S.t * 0.9);
    ctx.save();
    ctx.strokeStyle = C.signal;
    ctx.lineWidth = 1;
    for (var i = 0; i < CLUSTERS.length * 5; i++) {
      if (i % CLUSTERS.length !== QUERY_CLUSTER || i === QUERY_CLUSTER) continue;
      ctx.globalAlpha = a * 0.45 * pulse;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(
        CLUSTERS[QUERY_CLUSTER].x * S.W + (hash(i * 3.7) - 0.5) * S.W * 0.15,
        CLUSTERS[QUERY_CLUSTER].y * S.H + (hash(i * 9.1 + 5) - 0.5) * S.H * 0.24
      );
      ctx.stroke();
    }
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 34 + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  decor.rank = function (ctx, S, a, C) {
    ctx.save();
    ctx.globalAlpha = a * 0.6;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(S.P - 6, S.P);
    ctx.lineTo(S.P - 6, S.P + S.ih);
    ctx.stroke();
    for (var r = 0; r < 12; r++) {
      var y = S.P + (r + 0.5) * (S.ih / 12);
      ctx.globalAlpha = a * (r === 0 || r === 1 || r === 3 || r === 6 ? 0.8 : 0.3);
      ctx.strokeStyle = r === 0 || r === 1 || r === 3 || r === 6 ? C.signal : C.line;
      ctx.beginPath();
      ctx.moveTo(S.P - 11, y);
      ctx.lineTo(S.P - 3, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  decor.rhythm = function (ctx, S, a, C) {
    ctx.save();
    ctx.globalAlpha = a * 0.4;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(S.P, S.H * 0.5);
    ctx.lineTo(S.P + S.iw, S.H * 0.5);
    ctx.stroke();
    ctx.restore();
  };

  /* ----------------------------------------------------------------- field */

  function field(canvas, config) {
    if (!canvas || !canvas.getContext) return null;

    var ctx = canvas.getContext("2d");
    var names = config.states;
    var N = config.count || 288;
    var onStage = config.onStage || null;

    var W = 0, H = 0, dpr = 1;
    var t = 0, raf = null, running = false;
    var stageFloat = 0;
    var pointer = 0.5, pointerTarget = 0.5;

    var A = { x: 0, y: 0, r: 1, role: 0 };
    var B = { x: 0, y: 0, r: 1, role: 0 };
    var S = { N: N, W: 0, H: 0, t: 0, P: 0, iw: 0, ih: 0, lean: 0 };

    var colors = { quiet: "#74797f", line: "#22252a", signal: "#d7ff3f", text: "#eef0f2" };

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      function v(n, f) { return (cs.getPropertyValue(n) || "").trim() || f; }
      colors.quiet = v("--text-muted", "#74797f");
      colors.line = v("--border", "#22252a");
      colors.signal = v("--signal", "#d7ff3f");
      colors.text = v("--text", "#eef0f2");
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      if (!W || !H) return;

      var P = Math.max(16, Math.min(W, H) * 0.06);
      S.W = W; S.H = H; S.t = t; S.P = P;
      S.iw = W - P * 2; S.ih = H - P * 2;
      S.lean = (pointer - 0.5) * 1.2;

      var last = names.length - 1;
      var f = clamp(stageFloat, 0, last);
      var ia = Math.floor(f);
      var ib = Math.min(ia + 1, last);
      var mix = easeInOut(f - ia);

      var na = names[ia], nb = names[ib];
      var fa = states[na], fb = states[nb];

      ctx.clearRect(0, 0, W, H);

      if (decor[na]) decor[na](ctx, S, 1 - mix, colors);
      if (nb !== na && decor[nb]) decor[nb](ctx, S, mix, colors);

      for (var i = 0; i < N; i++) {
        fa(i, S, A);
        fb(i, S, B);
        var x = lerp(A.x, B.x, mix);
        var y = lerp(A.y, B.y, mix);
        var r = lerp(A.r, B.r, mix);
        var role = mix < 0.5 ? A.role : B.role;

        if (role === 2) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors.signal;
        } else if (role === 1) {
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = colors.signal;
        } else {
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = colors.quiet;
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function frame() {
      t += 0.016;
      pointer += (pointerTarget - pointer) * 0.07;
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
      pointerTarget = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    });
    canvas.addEventListener("pointerleave", function () { pointerTarget = 0.5; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0.02 }).observe(canvas);
    } else {
      start();
    }

    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener("resize", resize);

    new MutationObserver(function () { readColors(); draw(); }).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ["data-theme"] }
    );

    readColors();
    resize();
    if (reduced) draw();

    var api = {
      setStage: function (f) {
        var next = clamp(f, 0, names.length - 1);
        if (next === stageFloat) return;
        var prevIndex = Math.round(stageFloat);
        stageFloat = next;
        /* Draw straight away rather than waiting on the animation loop: it
           may be stopped (off screen, reduced motion, background tab), and
           the field should still show the stage it is actually on. */
        draw();
        var index = Math.round(next);
        if (onStage && index !== prevIndex) onStage(index);
      },
      redraw: draw
    };

    if (onStage) onStage(0);
    return api;
  }

  global.Instrument = { field: field, reduced: reduced };
})(window);
