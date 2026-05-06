// game.js - Geometry Runner embedded game
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const muteBtn = document.getElementById("muteBtn");

  // Logical resolution (keeps physics consistent while canvas scales)
  const LOGICAL_W = 960;
  const LOGICAL_H = 540;

  // Game constants
  const GROUND_H = 80;
  const PLAYER_SIZE = 40;
  const GRAVITY = 1.0;
  const JUMP_V = -18;
  const SCROLL_SPEED = 8;

  // Colors
  const COLORS = {
    bg1: "#263238",
    bg2: "#37474f",
    ground: "#111",
    spike: "#ffca28",
    player: "#00e5ff",
    playerDead: "#ff5252",
  };

  // State
  let running = false;
  let dead = false;
  let levelComplete = false;
  let worldX = 0;
  let lastTime = 0;
  let jumpQueued = false;
  let muted = false;

  // Player
  const player = {
    x: 200,
    y: LOGICAL_H - GROUND_H - PLAYER_SIZE,
    vy: 0,
    size: PLAYER_SIZE,
    onGround: true,
    angle: 0,
  };

  // Build level (array of spikes)
  const spikes = buildLevel();

  // Responsive canvas scaling
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * devicePixelRatio);
    canvas.height = Math.round((rect.width * devicePixelRatio) * (LOGICAL_H / LOGICAL_W));
    // Keep logical coordinate system via transform
    ctx.setTransform(canvas.width / LOGICAL_W, 0, 0, canvas.height / LOGICAL_H, 0, 0);
  }

  // Initialize size based on CSS width/height
  function initCanvasSize() {
    // Ensure canvas element has the intended CSS aspect ratio
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    // Force an initial resize
    resizeCanvas();
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  // Input
  function queueJump() {
    if (!running) {
      startGame();
      return;
    }
    jumpQueued = true;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      queueJump();
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    queueJump();
  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    queueJump();
  }, { passive: false });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "🔇" : "🔊";
  });

  // Start / reset
  function startGame() {
    running = true;
    dead = false;
    levelComplete = false;
    worldX = 0;
    player.y = LOGICAL_H - GROUND_H - PLAYER_SIZE;
    player.vy = 0;
    player.onGround = true;
    player.angle = 0;
    statusEl.textContent = "Running...";
  }

  function resetAfterDeath() {
    running = false;
    statusEl.textContent = "Tap to start";
  }

  // Level builder
  function buildLevel() {
    const arr = [];
    let x = 900;
    function addSpike(gap = 200) {
      arr.push({ x, w: 40, h: 60 });
      x += gap;
    }
    function addPattern(count, gapBetween = 60) {
      for (let i = 0; i < count; i++) {
        arr.push({ x: x + i * gapBetween, w: 40, h: 60 });
      }
      x += count * gapBetween + 200;
    }
    // Compose a short level
    addSpike(220);
    addSpike(160);
    addPattern(3, 60);
    addSpike(300);
    addPattern(4, 70);
    addSpike(260);
    // End marker
    arr.levelEnd = x + 400;
    return arr;
  }

  // Collision helpers
  function checkCollision(player, spikeScreenX, spike) {
    const baseY = LOGICAL_H - GROUND_H;
    const topY = baseY - spike.h;

    // AABB quick reject
    const px1 = player.x, py1 = player.y;
    const px2 = player.x + player.size, py2 = player.y + player.size;
    const sx1 = spikeScreenX, sx2 = spikeScreenX + spike.w, sy1 = topY, sy2 = baseY;
    if (px2 < sx1 || px1 > sx2 || py2 < sy1 || py1 > sy2) return false;

    // Triangle test (isosceles)
    const cx = spikeScreenX + spike.w / 2;
    const halfW = spike.w / 2;
    // For each player corner
    const corners = [
      { x: px1, y: py1 }, { x: px2, y: py1 },
      { x: px1, y: py2 }, { x: px2, y: py2 }
    ];
    for (const c of corners) {
      if (pointInTriangle(c.x, c.y, cx, topY, spike.w, baseY)) return true;
    }
    return false;
  }

  function pointInTriangle(px, py, cx, topY, width, baseY) {
    if (py < topY || py > baseY) return false;
    const t = (py - topY) / (baseY - topY); // 0..1
    const allowedHalf = (width / 2) * t;
    return px >= cx - allowedHalf && px <= cx + allowedHalf;
  }

  // Game loop
  function update(dt) {
    if (!running) return;

    if (dead || levelComplete) {
      // wait for restart input
      if (jumpQueued) {
        jumpQueued = false;
        startGame();
      }
      return;
    }

    // Scroll world
    worldX += SCROLL_SPEED * dt;

    // Jump
    if (jumpQueued && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      if (!muted) playJumpSound();
    }
    jumpQueued = false;

    // Physics
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    // Ground collision
    const groundY = LOGICAL_H - GROUND_H - player.size;
    if (player.y >= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.onGround = true;
    }

    // Rotation while airborne
    if (!player.onGround) player.angle += 8 * dt;
    else player.angle = 0;

    // Spike collisions
    for (const s of spikes) {
      const sx = s.x - worldX;
      if (sx < -200 || sx > LOGICAL_W + 200) continue;
      if (checkCollision(player, sx, s)) {
        dead = true;
        running = false;
        statusEl.textContent = "You Died! Tap/press SPACE to retry.";
        if (!muted) playDeathSound();
        break;
      }
    }

    // Level complete
    if (worldX > spikes.levelEnd) {
      levelComplete = true;
      running = false;
      statusEl.textContent = "Level Complete! Tap to play again.";
      if (!muted) playCompleteSound();
    }
  }

  function render() {
    // Clear
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Background parallax
    drawParallax(worldX);

    // Ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, LOGICAL_H - GROUND_H, LOGICAL_W, GROUND_H);

    // Decorative ground lines
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    for (let i = 0; i < LOGICAL_W; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, LOGICAL_H - GROUND_H);
      ctx.lineTo(i + 20, LOGICAL_H - GROUND_H + 10);
      ctx.stroke();
    }

    // Spikes
    ctx.fillStyle = COLORS.spike;
    ctx.strokeStyle = "#ffb300";
    ctx.lineWidth = 2;
    for (const s of spikes) {
      const sx = s.x - worldX;
      if (sx < -200 || sx > LOGICAL_W + 200) continue;
      const baseY = LOGICAL_H - GROUND_H;
      const topY = baseY - s.h;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx + s.w / 2, topY);
      ctx.lineTo(sx + s.w, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Player
    ctx.save();
    ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
    ctx.rotate((player.angle * Math.PI) / 180);
    ctx.fillStyle = dead ? COLORS.playerDead : COLORS.player;
    ctx.strokeStyle = "#00bcd4";
    ctx.lineWidth = 3;
    ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
    ctx.strokeRect(-player.size / 2, -player.size / 2, player.size, player.size);

    // Face
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(-player.size / 4 - 4, -player.size / 6, 8, 8);
    ctx.strokeRect(player.size / 4 - 4, -player.size / 6, 8, 8);
    ctx.beginPath();
    ctx.moveTo(-player.size / 4, player.size / 6);
    ctx.lineTo(player.size / 4, player.size / 6);
    ctx.stroke();

    ctx.restore();
  }

  // Parallax background
  function drawParallax(worldX) {
    const layer1 = (worldX * 0.3) % LOGICAL_W;
    const layer2 = (worldX * 0.15) % LOGICAL_W;

    // Layer 2
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = COLORS.bg2;
    for (let i = -1; i <= 2; i++) {
      const x = i * LOGICAL_W - layer2;
      ctx.fillRect(x, LOGICAL_H - GROUND_H - 140, LOGICAL_W, 140);
    }
    ctx.restore();

    // Layer 1
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = COLORS.bg1;
    for (let i = -1; i <= 2; i++) {
      const x = i * LOGICAL_W - layer1;
      ctx.fillRect(x, LOGICAL_H - GROUND_H - 220, LOGICAL_W, 220);
    }
    ctx.restore();
  }

  // Simple sounds (tiny beep using WebAudio)
  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
  function playTone(freq, time = 0.06, type = "sine") {
    if (muted) return;
    ensureAudio();
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.12;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
    o.stop(audioCtx.currentTime + time + 0.02);
  }
  function playJumpSound() { playTone(880, 0.06, "triangle"); }
  function playDeathSound() { playTone(120, 0.18, "sawtooth"); }
  function playCompleteSound() { playTone(660, 0.12, "sine"); }

  // Main loop
  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dtMs = Math.min(40, ts - lastTime);
    lastTime = ts;
    const dt = dtMs / 16.67; // normalize to ~60fps units

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // Boot
  initCanvasSize();
  resizeCanvas();
  requestAnimationFrame(loop);

  // Keep logical canvas size in sync when CSS size changes
  const ro = new ResizeObserver(() => resizeCanvas());
  ro.observe(canvas);

  // Expose a small API for debugging in console
  window._GeometryRunner = {
    start: startGame,
    reset: () => { running = false; dead = false; levelComplete = false; worldX = 0; statusEl.textContent = "Tap to start"; },
    mute: () => { muted = true; muteBtn.textContent = "🔇"; },
    unmute: () => { muted = false; muteBtn.textContent = "🔊"; }
  };
})();
