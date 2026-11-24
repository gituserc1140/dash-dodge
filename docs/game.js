"use strict";

(function () {
  var canvas = document.getElementById("gameCanvas");
  var stage = document.getElementById("stage");
  var statusEl = document.getElementById("status");
  var muteBtn = document.getElementById("mute");
  if (!canvas || !stage) return;
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var VIEW_W = 180;
  var HUD_BOTTOM = 36;
  var BEST_KEY = "dash-dodge.best";
  var MUTE_KEY = "dash-dodge.muted";
  var NEAR = 8;
  var DASH_TIME = 0.09;
  var DASH_CD = 0.64;
  var HIT_W = 8;
  var HIT_H = 15;

  var PALETTE = [
    { body: "#ff4fd8", dark: "#7a145c", light: "#ffc4f0" },
    { body: "#24e7ff", dark: "#07566e", light: "#c8f8ff" },
    { body: "#b6ff3c", dark: "#3d6e0e", light: "#e7ffb0" },
    { body: "#ffd23a", dark: "#7a5a0c", light: "#fff1ad" },
    { body: "#7d8cff", dark: "#2a2f86", light: "#d5dbff" },
    { body: "#ff7a3c", dark: "#7a3010", light: "#ffc9a6" },
  ];
  var SPIKE = { body: "#ff335c", dark: "#6e1028", light: "#ffd0dc" };

  var FONT = {
    A: ["010", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    C: ["111", "100", "100", "100", "111"],
    D: ["110", "101", "101", "101", "110"],
    E: ["111", "100", "110", "100", "111"],
    F: ["111", "100", "110", "100", "100"],
    G: ["111", "100", "101", "101", "111"],
    H: ["101", "101", "111", "101", "101"],
    I: ["111", "010", "010", "010", "111"],
    J: ["001", "001", "001", "101", "010"],
    K: ["101", "101", "110", "101", "101"],
    L: ["100", "100", "100", "100", "111"],
    M: ["101", "111", "101", "101", "101"],
    N: ["110", "101", "101", "101", "101"],
    O: ["111", "101", "101", "101", "111"],
    P: ["110", "101", "110", "100", "100"],
    Q: ["111", "101", "101", "111", "001"],
    R: ["110", "101", "110", "101", "101"],
    S: ["111", "100", "111", "001", "111"],
    T: ["111", "010", "010", "010", "010"],
    U: ["101", "101", "101", "101", "111"],
    V: ["101", "101", "101", "101", "010"],
    W: ["101", "101", "101", "111", "101"],
    X: ["101", "101", "010", "101", "101"],
    Y: ["101", "101", "010", "010", "010"],
    Z: ["111", "001", "010", "100", "111"],
    0: ["111", "101", "101", "101", "111"],
    1: ["010", "110", "010", "010", "111"],
    2: ["111", "001", "111", "100", "111"],
    3: ["111", "001", "111", "001", "111"],
    4: ["101", "101", "111", "001", "001"],
    5: ["111", "100", "111", "001", "111"],
    6: ["111", "100", "111", "101", "111"],
    7: ["111", "001", "010", "010", "010"],
    8: ["111", "101", "111", "101", "111"],
    9: ["111", "101", "111", "001", "111"],
    "!": ["010", "010", "010", "000", "010"],
  };

  var streaks = [];
  for (var s = 0; s < 16; s++) {
    streaks.push({
      x: (s * 29 + 7) % VIEW_W,
      h: 8 + (s % 5) * 5,
      p: (s * 53) % 340,
      c: s % 5 === 0 ? "#1a1034" : "#100a22",
    });
  }

  var reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    reduce = false;
  }

  var viewW = VIEW_W;
  var viewH = 320;
  var score = 0;
  var best = 0;
  var phase = "boot";
  var hazards = [];
  var particles = [];
  var pops = [];
  var ghosts = [];
  var shake = 0;
  var squash = 0;
  var squashKick = 0;
  var nearFlash = 0;
  var deathFlash = 0;
  var scoreFlash = 0;
  var anim = 0;
  var runT = 0;
  var seed = 1;
  var runs = 0;
  var lane = 90;
  var fallAcc = 0;
  var spawnN = 0;
  var nearCount = 0;
  var showHint = true;
  var dashCd = 0;
  var lastDir = 1;
  var booted = false;
  var last = 0;
  var soundOn = true;
  var actx = null;
  var pointerOn = false;
  var activeId = null;
  var targetX = 90;
  var lastTap = 0;
  var keys = { left: false, right: false };
  var statusSec = -1;
  var player = { x: 90, vx: 0, dash: 0, dashDir: 1 };

  function loadBest() {
    try {
      var n = Number(window.localStorage.getItem(BEST_KEY));
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    } catch (err) {
      return 0;
    }
    return 0;
  }

  function saveBest(n) {
    try {
      window.localStorage.setItem(BEST_KEY, String(n));
    } catch (err) {
      /* storage can be blocked; the run still plays */
    }
  }

  function loadSound() {
    try {
      soundOn = window.localStorage.getItem(MUTE_KEY) !== "1";
    } catch (err) {
      soundOn = true;
    }
    paintMute();
  }

  function paintMute() {
    if (!muteBtn) return;
    muteBtn.classList.toggle("is-muted", !soundOn);
    muteBtn.setAttribute("aria-pressed", soundOn ? "false" : "true");
    var label = soundOn ? "Mute sound" : "Unmute sound";
    muteBtn.setAttribute("aria-label", label);
    muteBtn.setAttribute("title", label);
  }

  function setStatus(text) {
    if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
  }

  function rnd() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function ramp() {
    var u = 1 - Math.exp(-runT / 4.2);
    return u > 1 ? 1 : u;
  }

  function fallSpeed() {
    return 255 + ramp() * 185;
  }

  function rowSpacing() {
    return 66 - ramp() * 12;
  }

  function gapWidth() {
    return 60 - ramp() * 16;
  }

  function feetY() {
    return viewH - 14;
  }

  function bumpBest() {
    var s = Math.floor(score);
    if (s <= best) return;
    best = s;
    saveBest(best);
  }

  function reset() {
    runs += 1;
    seed = ((Date.now() + runs * 997) >>> 0) || 1;
    score = 0;
    runT = 0;
    phase = "play";
    hazards = [];
    particles = [];
    pops = [];
    ghosts = [];
    shake = 0;
    squash = 0;
    squashKick = 0;
    nearFlash = 0;
    deathFlash = 0;
    scoreFlash = 0;
    nearCount = 0;
    showHint = true;
    dashCd = 0;
    lastTap = 0;
    fallAcc = 28;
    spawnN = 0;
    statusSec = -1;
    lane = viewW / 2;
    player.x = viewW / 2;
    player.vx = 0;
    player.dash = 0;
    player.dashDir = lastDir || 1;
    targetX = player.x;
    opening();
    setStatus("Drag to dodge.");
  }

  function advanceLane() {
    var gap = gapWidth();
    var maxShift = Math.max(8, gap - HIT_W - 20);
    var mag = Math.min(maxShift, 8 + ramp() * 12);
    var dir = rnd() < 0.5 ? -1 : 1;
    var pull = (viewW / 2 - lane) * 0.28;
    var half = gap / 2;
    lane = clamp(lane + dir * mag + pull, half + 16, viewW - half - 16);
  }

  function pushHazard(x, y, w, h, spike, pal) {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.max(8, Math.round(w));
    h = Math.max(8, Math.round(h));
    if (x > viewW - 4 || x + w < 4) return;
    hazards.push({
      x: x,
      y: y,
      w: w,
      h: h,
      kind: spike ? "spike" : "block",
      pal: pal,
      closed: false,
    });
  }

  function spawnSide(edge, side, y, pal) {
    var room = side < 0 ? edge : viewW - edge;
    if (room < 16) return;
    var spike = rnd() < 0.4;
    var h = spike ? 18 : 16;
    var w = Math.min(room, spike ? 16 + rnd() * 6 : 30 + rnd() * 16);
    var x = side < 0 ? edge - w : edge;
    pushHazard(x, y, w, h, spike, spike ? SPIKE : pal);
    var remain = room - w - 6;
    if (remain > 20) {
      var spike2 = rnd() < 0.55;
      var w2 = Math.min(remain, spike2 ? 16 : 22 + rnd() * 14);
      var x2 = side < 0 ? x - 6 - w2 : x + w + 6;
      pushHazard(x2, y, w2, spike2 ? 16 : 14, spike2, spike2 ? SPIKE : pal);
    }
  }

  function spawnWave(y) {
    if (hazards.length > 36) return;
    var gap = gapWidth();
    var half = gap / 2;
    var pal = PALETTE[spawnN % PALETTE.length];
    spawnN += 1;
    spawnSide(lane - half, -1, y, pal);
    spawnSide(lane + half, 1, y, pal);
  }

  function opening() {
    var spacing = 64;
    var playerTop = feetY() - HIT_H;
    var y0 = playerTop - 96;
    var center = viewW / 2;
    var plan = [0, 10, 18];
    var spawned = 0;
    for (var i = 0; i < plan.length; i++) {
      var y = y0 - i * spacing;
      if (y < HUD_BOTTOM + 32) break;
      var half = gapWidth() / 2;
      lane = clamp(center + plan[i], half + 12, viewW - half - 12);
      spawnWave(y);
      spawned += 1;
    }
    if (!spawned) {
      lane = center;
      spawnWave(Math.max(HUD_BOTTOM + 32, y0));
    }
  }

  function updateSpawns(dt) {
    fallAcc += fallSpeed() * dt;
    var spacing = rowSpacing();
    var guard = 0;
    while (fallAcc >= spacing && guard < 3) {
      fallAcc -= spacing;
      advanceLane();
      spawnWave(-20);
      guard += 1;
    }
  }

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) {
      try {
        actx = new AC();
      } catch (err) {
        return null;
      }
    }
    if (actx.state === "suspended") {
      var pending = actx.resume();
      if (pending && pending.catch) pending.catch(function () {});
    }
    return actx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!soundOn) return;
    var audio = unlockAudio();
    if (!audio) return;
    try {
      var t0 = audio.currentTime;
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(Math.max(1, freq), t0);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      }
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) {
      /* a blip can be rejected; the game continues */
    }
  }

  function blipDash() {
    blip(320, 0.08, "square", 0.04, 920);
  }

  function blipClose() {
    blip(880, 0.07, "square", 0.04, 1380);
  }

  function blipFail() {
    blip(220, 0.26, "sawtooth", 0.05, 54);
  }

  function burst(x, y, color, n, speed) {
    var count = reduce ? Math.max(3, Math.ceil(n / 2)) : n;
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 * i) / count + rnd() * 0.35;
      var sp = speed * (0.45 + rnd() * 0.7);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * 0.25,
        life: 0.22 + rnd() * 0.22,
        color: i % 2 ? "#fff6e0" : color,
        s: i % 4 === 0 ? 2 : 1,
      });
    }
    if (particles.length > 90) particles.splice(0, particles.length - 90);
  }

  function doDash(dir) {
    if (phase !== "play" || dashCd > 0) return;
    if (!dir) dir = lastDir || 1;
    player.dash = DASH_TIME;
    player.dashDir = dir < 0 ? -1 : 1;
    lastDir = player.dashDir;
    dashCd = DASH_CD;
    squashKick = 1;
    burst(player.x, feetY() - 8, "#6ffbff", 7, 70);
    blipDash();
  }

  function awardClose(h) {
    score += 25;
    scoreFlash = 0.28;
    nearFlash = 0.1;
    squashKick = Math.max(squashKick, 0.75);
    nearCount += 1;
    var hx = h.x + h.w / 2;
    var dir = player.x >= hx ? 1 : -1;
    pops.push({
      x: clamp(player.x + dir * 26, 40, viewW - 40),
      y: feetY() - 52 - pops.length * 8,
      life: 0.62,
    });
    if (pops.length > 4) pops.shift();
    burst(player.x, feetY() - HIT_H, "#fff36a", 8, 60);
    blipClose();
    bumpBest();
  }

  function die() {
    if (phase === "over") return;
    phase = "over";
    shake = reduce ? 2 : 7;
    deathFlash = 0.12;
    nearFlash = 0;
    showHint = false;
    player.dash = 0;
    pops = [];
    burst(player.x, feetY() - 8, "#ff335c", 18, 110);
    blipFail();
    bumpBest();
    setStatus("Game over. Score " + Math.floor(score) + ". Best " + best + ". Tap to retry.");
  }

  function spikeSpan(h, y) {
    var t = (y - h.y) / h.h;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var half = (h.w / 2) * (1 - t);
    var cx = h.x + h.w / 2;
    return { l: cx - half, r: cx + half };
  }

  function horizGap(l, r, sl, sr) {
    if (r < sl) return sl - r;
    if (l > sr) return l - sr;
    return 0;
  }

  function hazardSpan(h, top, bottom) {
    if (h.kind !== "spike") return { l: h.x, r: h.x + h.w };
    var y = Math.max(h.y, top);
    return spikeSpan(h, y);
  }

  function overlaps(l, r, top, bottom, h) {
    if (bottom <= h.y || top >= h.y + h.h) return false;
    if (h.kind !== "spike") return r > h.x && l < h.x + h.w;
    var y0 = Math.max(top, h.y);
    var y1 = Math.min(bottom, h.y + h.h);
    var steps = 3;
    for (var i = 0; i <= steps; i++) {
      var span = spikeSpan(h, y0 + ((y1 - y0) * i) / steps);
      if (r > span.l && l < span.r) return true;
    }
    return false;
  }

  function stepPlayer(dt) {
    var prev = player.x;
    if (player.dash > 0) {
      player.vx = player.dashDir * 1240;
      player.x += player.vx * dt;
      player.dash -= dt;
      if (player.dash < 0) player.dash = 0;
    } else if (pointerOn) {
      var dx = targetX - player.x;
      var maxStep = 960 * dt;
      if (Math.abs(dx) <= maxStep) {
        player.vx = dx / Math.max(dt, 0.001);
        player.x = targetX;
      } else {
        player.vx = Math.sign(dx) * 960;
        player.x += player.vx * dt;
      }
    } else {
      var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      player.vx = dir * 340;
      player.x += player.vx * dt;
    }
    player.vx = clamp(player.vx, -1400, 1400);
    player.x = clamp(player.x, 8, viewW - 8);
    if (Math.abs(player.vx) > 30) lastDir = player.vx > 0 ? 1 : -1;
    return prev;
  }

  function checkHits(prevX) {
    var top = feetY() - HIT_H;
    var bottom = feetY() - 1;
    var l = Math.min(prevX, player.x) - HIT_W / 2;
    var r = Math.max(prevX, player.x) + HIT_W / 2;
    var bodyL = player.x - HIT_W / 2;
    var bodyR = player.x + HIT_W / 2;
    for (var i = 0; i < hazards.length; i++) {
      var h = hazards[i];
      if (h.y > bottom || h.y + h.h < top) continue;
      if (overlaps(l, r, top, bottom, h)) {
        die();
        return;
      }
    }
    for (var j = 0; j < hazards.length; j++) {
      var haz = hazards[j];
      if (haz.closed) continue;
      if (haz.y > bottom || haz.y + haz.h < top) continue;
      var span = hazardSpan(haz, top, bottom);
      var gap = horizGap(bodyL, bodyR, span.l, span.r);
      if (gap > 0 && gap <= NEAR) {
        haz.closed = true;
        awardClose(haz);
      }
    }
  }

  function simulate(dt) {
    var steps = Math.max(1, Math.ceil(dt / 0.008));
    var h = dt / steps;
    var sp = fallSpeed();
    for (var s = 0; s < steps; s++) {
      if (phase !== "play") return;
      var prev = stepPlayer(h);
      for (var i = 0; i < hazards.length; i++) hazards[i].y += sp * h;
      checkHits(prev);
    }
  }

  function update(dt) {
    anim += dt;
    if (phase === "play") {
      runT += dt;
      score += 10 * dt;
      bumpBest();
      if (dashCd > 0) dashCd = Math.max(0, dashCd - dt);
      updateSpawns(dt);
      simulate(dt);
      var sec = Math.floor(runT);
      if (sec !== statusSec && sec > 0) {
        statusSec = sec;
        setStatus("Score " + Math.floor(score) + ". Best " + best + ".");
      }
      if (player.dash > 0) {
        ghosts.push({ x: player.x, life: 0.12 });
        if (ghosts.length > 5) ghosts.shift();
      }
    }
    var kept = [];
    for (var i = 0; i < hazards.length; i++) {
      if (hazards[i].y < viewH + 12) kept.push(hazards[i]);
    }
    hazards = kept;
    var alive = [];
    for (var p = 0; p < particles.length; p++) {
      var bit = particles[p];
      bit.vy += 90 * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.life -= dt;
      if (bit.life > 0) alive.push(bit);
    }
    particles = alive;
    var nextPops = [];
    for (var q = 0; q < pops.length; q++) {
      pops[q].y -= 16 * dt;
      pops[q].life -= dt;
      if (pops[q].life > 0) nextPops.push(pops[q]);
    }
    pops = nextPops;
    var nextGhosts = [];
    for (var g = 0; g < ghosts.length; g++) {
      ghosts[g].life -= dt;
      if (ghosts[g].life > 0) nextGhosts.push(ghosts[g]);
    }
    ghosts = nextGhosts;
    var goal = squashKick;
    if (player.dash > 0) goal = 1;
    else goal = Math.max(goal, Math.min(0.55, Math.abs(player.vx) / 780));
    squash += (goal - squash) * Math.min(1, dt * 12);
    if (squash < 0.01) squash = 0;
    squashKick = Math.max(0, squashKick - dt * 3.5);
    if (shake > 0) shake = Math.max(0, shake - dt * 16);
    if (nearFlash > 0) nearFlash = Math.max(0, nearFlash - dt);
    if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt);
    if (scoreFlash > 0) scoreFlash = Math.max(0, scoreFlash - dt);
  }

  function textWidth(str, scale) {
    return str.length * 4 * scale - scale;
  }

  function drawText(str, x, y, scale, color, align) {
    var s = String(str).toUpperCase();
    var width = textWidth(s, scale);
    var cx = Math.round(x);
    if (align === "center") cx = Math.round(x - width / 2);
    else if (align === "right") cx = Math.round(x - width);
    var cy = Math.round(y);
    for (var i = 0; i < s.length; i++) {
      var glyph = FONT[s.charAt(i)];
      if (glyph) {
        for (var r = 0; r < 5; r++) {
          for (var c = 0; c < 3; c++) {
            if (glyph[r].charAt(c) !== "1") continue;
            ctx.fillStyle = "#140a22";
            ctx.fillRect(cx + c * scale + 1, cy + r * scale + 1, scale, scale);
            ctx.fillStyle = color;
            ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
          }
        }
      }
      cx += 4 * scale;
    }
  }

  function drawBanner(text, y, color) {
    var scale = 2;
    var tw = textWidth(text, scale);
    var w = tw + 16;
    var h = 5 * scale + 10;
    var x = Math.round((viewW - w) / 2);
    y = Math.round(y);
    ctx.fillStyle = "#120a22";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    drawText(text, viewW / 2, y + 5, scale, color, "center");
  }

  function drawSky() {
    ctx.fillStyle = "#070614";
    ctx.fillRect(0, 0, viewW, viewH);
    var scroll = anim * fallSpeed() * 0.45;
    for (var i = 0; i < streaks.length; i++) {
      var st = streaks[i];
      var y = (st.p + scroll * (0.35 + (i % 3) * 0.12)) % (viewH + st.h);
      ctx.fillStyle = st.c;
      ctx.fillRect(st.x, Math.round(y - st.h), 1, st.h);
    }
    ctx.fillStyle = "#14081c";
    ctx.fillRect(0, HUD_BOTTOM - 1, viewW, 1);
  }

  function drawGround() {
    var y = feetY();
    ctx.fillStyle = "#071018";
    ctx.fillRect(0, y, viewW, viewH - y);
    ctx.fillStyle = "#24e7ff";
    ctx.fillRect(0, y, viewW, 1);
    ctx.fillStyle = "#07566e";
    ctx.fillRect(0, y + 1, viewW, 2);
    ctx.fillStyle = "#123246";
    var shift = Math.floor(anim * fallSpeed() * 0.2) % 8;
    for (var x = -shift; x < viewW; x += 8) ctx.fillRect(x, y + 4, 3, 1);
  }

  function drawBlock(h) {
    var x = Math.round(h.x);
    var y = Math.round(h.y);
    var w = Math.round(h.w);
    var hh = Math.round(h.h);
    ctx.fillStyle = h.pal.dark;
    ctx.fillRect(x, y, w, hh);
    if (w > 2 && hh > 2) {
      ctx.fillStyle = h.pal.body;
      ctx.fillRect(x + 1, y + 1, w - 2, hh - 2);
    }
    ctx.fillStyle = h.pal.light;
    ctx.fillRect(x + 2, y + 2, Math.max(1, w - 6), 2);
    if (w > 24) {
      ctx.fillStyle = h.pal.dark;
      ctx.fillRect(x + Math.floor(w / 2), y + 1, 1, hh - 2);
    }
  }

  function drawSpike(h) {
    var height = Math.max(1, Math.round(h.h));
    var top = Math.round(h.y);
    var cx = h.x + h.w / 2;
    for (var row = 0; row < height; row++) {
      var t = row / height;
      var half = Math.round((h.w / 2) * (1 - t));
      var y = top + row;
      ctx.fillStyle = row === height - 1 ? h.pal.light : h.pal.body;
      ctx.fillRect(Math.round(cx) - half, y, Math.max(1, half * 2), 1);
      if (half > 1) {
        ctx.fillStyle = h.pal.dark;
        ctx.fillRect(Math.round(cx) - half, y, 1, 1);
      }
    }
  }

  function drawHazard(h) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = h.pal.dark;
    ctx.fillRect(Math.round(h.x + 2), Math.round(h.y - 7), Math.max(1, Math.round(h.w) - 4), 3);
    ctx.globalAlpha = 0.22;
    ctx.fillRect(Math.round(h.x + 5), Math.round(h.y - 13), Math.max(1, Math.round(h.w) - 10), 2);
    ctx.globalAlpha = 1;
    if (h.kind === "spike") drawSpike(h);
    else drawBlock(h);
  }

  function drawRunner() {
    var sx = 1 + squash * 0.5;
    var sy = 1 - squash * 0.38;
    var moving = Math.abs(player.vx) > 40;
    var step = Math.sin(anim * (player.dash > 0 ? 34 : 18));
    var lift = moving ? 1 : Math.sin(anim * 3.2) > 0.65 ? 1 : 0;
    var lLift = moving && step > 0 ? 1 : 0;
    var rLift = moving && step < 0 ? 1 : 0;
    var ready = dashCd <= 0 && phase === "play";
    var visor = player.dash > 0 ? "#fff6e0" : ready ? "#6ffbff" : "#ff4fd8";
    function part(ox, oy, w, h, color, xOff) {
      var px = Math.round(player.x + (ox + (xOff || 0)) * sx);
      var py = Math.round(feetY() - lift - (oy + h) * sy);
      ctx.fillStyle = color;
      ctx.fillRect(px, py, Math.max(1, Math.round(w * sx)), Math.max(1, Math.round(h * sy)));
    }
    function body(xOff, force) {
      part(-5, 0, 4, 3, force || "#24e7ff", xOff);
      part(1, 0, 4, 3, force || "#24e7ff", xOff);
      part(-4, 3 + lLift, 3, 4, force || "#d7fff4", xOff);
      part(1, 3 + rLift, 3, 4, force || "#d7fff4", xOff);
      part(-5, 7, 10, 5, force || "#f4fff8", xOff);
      part(-5, 8, 10, 2, force || "#ff4fd8", xOff);
      part(-4, 12, 8, 5, force || "#f4fff8", xOff);
      part(-3, 13, 6, 2, force || visor, xOff);
      part(-2, 14, 2, 1, force || "#fff6e0", xOff);
      part(-1, 17, 2, 2, force || (ready ? "#6ffbff" : "#ffd23a"), xOff);
    }
    ctx.fillStyle = "#14081c";
    ctx.fillRect(Math.round(player.x - 6 * sx), feetY() - 1, Math.round(12 * sx), 2);
    body(0.8, "#140c22");
    body(0, null);
  }

  function drawGhosts() {
    for (var i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      ctx.globalAlpha = Math.max(0.15, g.life * 2);
      ctx.fillStyle = "#6ffbff";
      ctx.fillRect(Math.round(g.x - 4), feetY() - 12, 8, 10);
      ctx.globalAlpha = 1;
    }
  }

  function drawPips() {
    var full = dashCd <= 0 ? 1 : 1 - dashCd / DASH_CD;
    var segs = 4;
    var w = 5;
    var gap = 2;
    var total = segs * w + (segs - 1) * gap;
    var x = Math.round((viewW - total) / 2);
    var y = 29;
    for (var i = 0; i < segs; i++) {
      var on = full >= (i + 0.15) / segs;
      ctx.fillStyle = on ? "#6ffbff" : "#241c3a";
      ctx.fillRect(x + i * (w + gap), y, w, 3);
    }
  }

  function drawHud() {
    var color = scoreFlash > 0 ? "#fff36a" : "#fff6e0";
    drawText(String(Math.floor(score)), viewW / 2, 4, 3, color, "center");
    drawText("BEST " + best, viewW / 2, 21, 1, "#f0c98a", "center");
    drawPips();
  }

  function drawFlash() {
    if (deathFlash > 0) {
      ctx.globalAlpha = Math.min(0.22, deathFlash * 1.6);
      ctx.fillStyle = "#ff335c";
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ff5d73";
      ctx.fillRect(0, 0, viewW, 2);
      ctx.fillRect(0, viewH - 2, viewW, 2);
      ctx.fillRect(0, 0, 2, viewH);
      ctx.fillRect(viewW - 2, 0, 2, viewH);
    } else if (nearFlash > 0) {
      ctx.globalAlpha = Math.min(0.28, nearFlash * 2.6);
      ctx.fillStyle = "#e7fdff";
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#6ffbff";
      ctx.fillRect(0, 0, viewW, 2);
      ctx.fillRect(0, viewH - 2, viewW, 2);
      ctx.fillRect(0, 0, 2, viewH);
      ctx.fillRect(viewW - 2, 0, 2, viewH);
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    drawSky();
    ctx.save();
    if (shake > 0) {
      var mag = reduce ? 1 : shake > 3 ? 2 : 1;
      var ox = (Math.floor(anim * 47) % 2 === 0 ? -1 : 1) * mag;
      var oy = (Math.floor(anim * 29) % 2 === 0 ? 1 : -1) * mag;
      ctx.translate(ox, oy);
    }
    ctx.beginPath();
    ctx.rect(0, HUD_BOTTOM, viewW, viewH - HUD_BOTTOM);
    ctx.clip();
    for (var i = 0; i < hazards.length; i++) drawHazard(hazards[i]);
    drawGround();
    drawGhosts();
    for (var p = 0; p < particles.length; p++) {
      var bit = particles[p];
      ctx.fillStyle = bit.color;
      ctx.fillRect(Math.round(bit.x), Math.round(bit.y), bit.s, bit.s);
    }
    if (phase !== "over") drawRunner();
    ctx.restore();
    for (var q = 0; q < pops.length; q++) {
      var pop = pops[q];
      ctx.globalAlpha = pop.life > 0.18 ? 1 : Math.max(0, pop.life / 0.18);
      var scale = 2;
      var tw = textWidth("CLOSE!", scale);
      var bw = tw + 8;
      var bh = 5 * scale + 6;
      var bx = Math.round(pop.x - bw / 2);
      var by = Math.round(pop.y);
      ctx.fillStyle = "#120a22";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#fff36a";
      ctx.fillRect(bx, by, bw, 1);
      drawText("CLOSE!", pop.x, by + 3, scale, "#fff36a", "center");
      ctx.globalAlpha = 1;
    }
    drawHud();
    if (phase === "play" && showHint) {
      drawBanner("DRAG TO DODGE", HUD_BOTTOM + 4, "#fff6e0");
    } else if (phase === "over") {
      var y = Math.round(viewH * 0.4);
      drawBanner("GAME OVER", y, "#ff5d73");
      drawBanner("TAP TO RETRY", y + 28, "#fff6e0");
    }
    drawFlash();
  }

  function loop(now) {
    window.requestAnimationFrame(loop);
    if (document.hidden) {
      last = 0;
      return;
    }
    var dt = last ? Math.min(0.033, (now - last) / 1000) : 0.016;
    last = now;
    update(dt);
    draw();
  }

  function eventX(e) {
    var rect = canvas.getBoundingClientRect();
    var x = ((e.clientX - rect.left) / (rect.width || 1)) * viewW;
    if (!isFinite(x)) x = player.x;
    return clamp(x, 8, viewW - 8);
  }

  function isMute(e) {
    var t = e.target;
    return !!(t && t.closest && t.closest("#mute"));
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.isPrimary === false) return;
    if (isMute(e)) return;
    if (e.cancelable) e.preventDefault();
    unlockAudio();
    var now = performance.now();
    if (phase === "over") {
      if (activeId !== null) return;
      reset();
      lastTap = now;
    } else if (lastTap > 0 && now - lastTap < 280) {
      var tapX = eventX(e);
      var dir = Math.abs(tapX - player.x) > 5 ? (tapX < player.x ? -1 : 1) : lastDir || 1;
      doDash(dir);
      lastTap = 0;
    } else {
      lastTap = now;
    }
    if (phase !== "play") return;
    activeId = e.pointerId;
    pointerOn = true;
    targetX = eventX(e);
    showHint = false;
  }

  function onPointerMove(e) {
    if (!pointerOn || e.pointerId !== activeId) return;
    if (e.cancelable) e.preventDefault();
    targetX = eventX(e);
  }

  function onPointerUp(e) {
    if (e.pointerId !== activeId) return;
    pointerOn = false;
    activeId = null;
  }

  function onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isMute(e)) return;
    var left = e.code === "ArrowLeft" || e.code === "KeyA";
    var right = e.code === "ArrowRight" || e.code === "KeyD";
    var space = e.code === "Space" || e.key === " ";
    if (!left && !right && !space) return;
    e.preventDefault();
    if (!booted) return;
    unlockAudio();
    if (phase === "over") {
      if (space && !e.repeat) reset();
      return;
    }
    if (e.repeat && space) return;
    if (left) keys.left = true;
    if (right) keys.right = true;
    if (space) {
      var dir = keys.right && !keys.left ? 1 : keys.left && !keys.right ? -1 : lastDir || 1;
      doDash(dir);
    }
    showHint = false;
  }

  function onKeyUp(e) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  }

  function fit() {
    var vw = stage.clientWidth;
    var vh = stage.clientHeight;
    try {
      var style = window.getComputedStyle(stage);
      vw -= (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      vh -= (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    } catch (err) {
      /* padding is optional; the viewport size still fits the arena */
    }
    if (vw < 8 || vh < 8) return false;
    var scale = 1;
    while ((scale + 1) * VIEW_W <= vw && (scale + 1) * 240 <= vh && scale < 6) {
      scale += 1;
    }
    var lh = Math.floor(vh / scale);
    if (lh > 320) lh = 320;
    if (lh < 1) lh = 1;
    viewW = VIEW_W;
    viewH = lh;
    canvas.width = viewW;
    canvas.height = viewH;
    canvas.style.width = viewW * scale + "px";
    canvas.style.height = viewH * scale + "px";
    ctx.imageSmoothingEnabled = false;
    return true;
  }

  if (muteBtn) {
    muteBtn.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    });
    muteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      soundOn = !soundOn;
      try {
        window.localStorage.setItem(MUTE_KEY, soundOn ? "0" : "1");
      } catch (err) {
        /* ignore blocked storage */
      }
      paintMute();
      if (soundOn) blip(660, 0.05, "square", 0.035, 880);
    });
  }

  window.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", fit);
  window.addEventListener("blur", function () {
    keys.left = false;
    keys.right = false;
    pointerOn = false;
    activeId = null;
  });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  document.addEventListener(
    "touchmove",
    function (e) {
      if (e.cancelable) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  window.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener("gesturestart", function (e) {
    e.preventDefault();
  });

  function playerBox() {
    return {
      x: player.x - HIT_W / 2,
      y: feetY() - HIT_H,
      w: HIT_W,
      h: HIT_H,
    };
  }

  window.__dashDodge = {
    snapshot: function () {
      return {
        phase: phase,
        score: Math.floor(score),
        best: best,
        hint: showHint,
        shake: shake,
        dashCd: dashCd,
        dashing: player.dash > 0,
        near: nearCount,
        runT: runT,
        flash: nearFlash + deathFlash,
        sound: soundOn,
        viewW: viewW,
        viewH: viewH,
        lane: lane,
        player: playerBox(),
        hazards: hazards.map(function (h) {
          return { x: h.x, y: h.y, w: h.w, h: h.h, kind: h.kind };
        }),
      };
    },
  };

  function boot() {
    if (!fit()) {
      window.requestAnimationFrame(boot);
      return;
    }
    best = loadBest();
    loadSound();
    reset();
    booted = true;
    window.requestAnimationFrame(loop);
  }

  boot();
})();
