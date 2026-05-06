// Geometry Dash–style mini clone
// Core mechanics: auto-run, jump, spikes, death, restart

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");

// --- Game constants ---
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const GROUND_HEIGHT = 80;
const PLAYER_SIZE = 40;
const GRAVITY = 0.9;
const JUMP_FORCE = -18;
const SCROLL_SPEED = 8; // world scroll speed

// Colors
const COLOR_PLAYER = "#00e5ff";
const COLOR_PLAYER_DEAD = "#ff5252";
const COLOR_GROUND = "#111";
const COLOR_SPIKE = "#ffca28";
const COLOR_BG_LAYER_1 = "#263238";
const COLOR_BG_LAYER_2 = "#37474f";

// Game state
let lastTime = 0;
let worldOffset = 0;
let running = false;
let dead = false;
let levelComplete = false;

// Player
const player = {
  x: 200,
  y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE,
  vy: 0,
  size: PLAYER_SIZE,
  onGround: true,
  rotation: 0,
};

// Simple level data: array of spike objects
// Each spike has an x position in "world space" and width/height
// You can tweak or extend this to build more complex levels.
const spikes = buildLevel();

// --- Input handling ---
let jumpQueued = false;

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

canvas.addEventListener("mousedown", queueJump);
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  queueJump();
});

// --- Level builder ---
function buildLevel() {
  const s = [];
  let x = 800;

  // Helper to add spike patterns
  function addSingleSpike(gap = 0) {
    s.push({
      x,
      width: 40,
      height: 60,
    });
    x += 200 + gap;
  }

  function addTripleSpike() {
    for (let i = 0; i < 3; i++) {
      s.push({
        x: x + i * 60,
        width: 40,
        height: 60,
      });
    }
    x += 400;
  }

  function addStaircase() {
    for (let i = 0; i < 4; i++) {
      s.push({
        x: x + i * 80,
        width: 40,
        height: 60 + i * 15,
      });
    }
    x += 500;
  }

  // Build a simple but varied level
  addSingleSpike();
  addSingleSpike(50);
  addTripleSpike();
  addSingleSpike(100);
  addStaircase();
  addTripleSpike();
  addSingleSpike(150);

  // Mark end of level (for completion)
  s.levelEndX = x + 400;

  return s;
}

// --- Game control ---
function startGame() {
  if (!running) {
    resetGame();
    running = true;
    statusEl.textContent = "Running...";
  }
}

function resetGame() {
  worldOffset = 0;
  dead = false;
  levelComplete = false;
  player.y = GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE;
  player.vy = 0;
  player.onGround = true;
  player.rotation = 0;
}

// --- Main loop ---
function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  update(delta / 16.67); // normalize to ~60fps units
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// --- Update ---
function update(dt) {
  if (!running) return;

  if (dead || levelComplete) {
    // Wait for user to press jump to restart
    if (jumpQueued) {
      jumpQueued = false;
      resetGame();
      statusEl.textContent = "Running...";
    }
    return;
  }

  // Scroll world
  worldOffset += SCROLL_SPEED * dt;

  // Handle jump
  if (jumpQueued && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }
  jumpQueued = false;

  // Apply gravity
  player.vy += GRAVITY * dt * 1.5;
  player.y += player.vy * dt * 1.5;

  // Ground collision
  const groundY = GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  }

  // Rotate player while in air for that cube spin feel
  if (!player.onGround) {
    player.rotation += 0.18 * dt * 60;
  } else {
    player.rotation = 0;
  }

  // Collision with spikes
  for (const spike of spikes) {
    const screenX = spike.x - worldOffset;
    if (screenX < -100 || screenX > GAME_WIDTH + 100) continue;

    if (checkSpikeCollision(player, screenX, spike)) {
      dead = true;
      statusEl.textContent = "You Died! Tap/press SPACE to retry.";
      break;
    }
  }

  // Level completion
  if (worldOffset > spikes.levelEndX) {
    levelComplete = true;
    statusEl.textContent = "Level Complete! Tap/press SPACE to play again.";
  }
}

// --- Collision detection ---
function checkSpikeCollision(player, spikeScreenX, spike) {
  // Approximate spike as triangle on top of ground
  const spikeBaseY = GAME_HEIGHT - GROUND_HEIGHT;
  const spikeTopY = spikeBaseY - spike.height;

  // Player AABB
  const px1 = player.x;
  const py1 = player.y;
  const px2 = player.x + player.size;
  const py2 = player.y + player.size;

  // Spike AABB (for quick reject)
  const sx1 = spikeScreenX;
  const sx2 = spikeScreenX + spike.width;
  const sy1 = spikeTopY;
  const sy2 = spikeBaseY;

  if (px2 < sx1 || px1 > sx2 || py2 < sy1 || py1 > sy2) {
    return false;
  }

  // More precise: treat spike as isosceles triangle
  // Left and right edges from base to top
  const spikeCenterX = spikeScreenX + spike.width / 2;

  // For each corner of the player, check if inside triangle
  const corners = [
    { x: px1, y: py1 },
    { x: px2, y: py1 },
    { x: px1, y: py2 },
    { x: px2, y: py2 },
  ];

  for (const c of corners) {
    if (pointInSpike(c.x, c.y, spikeCenterX, spikeBaseY, spikeTopY, spike.width)) {
      return true;
    }
  }

  return false;
}

function pointInSpike(x, y, cx, baseY, topY, width) {
  if (y < topY || y > baseY) return false;

  const halfW = width / 2;
  const t = (y - topY) / (baseY - topY); // 0 at top, 1 at base
  const allowedHalfWidth = halfW * t;

  return x >= cx - allowedHalfWidth && x <= cx + allowedHalfWidth;
}

// --- Rendering ---
function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawBackground();
  drawGround();
  drawSpikes();
  drawPlayer();
}

function drawBackground() {
  // Parallax rectangles
  const layer1Offset = (worldOffset * 0.3) % GAME_WIDTH;
  const layer2Offset = (worldOffset * 0.15) % GAME_WIDTH;

  ctx.fillStyle = COLOR_BG_LAYER_2;
  drawParallaxLayer(layer2Offset, 80, 0.4);

  ctx.fillStyle = COLOR_BG_LAYER_1;
  drawParallaxLayer(layer1Offset, 120, 0.6);
}

function drawParallaxLayer(offset, height, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  for (let i = -1; i <= 2; i++) {
    const x = i * GAME_WIDTH - offset;
    ctx.fillRect(x, GAME_HEIGHT - GROUND_HEIGHT - height, GAME_WIDTH, height);
  }

  ctx.restore();
}

function drawGround() {
  ctx.fillStyle = COLOR_GROUND;
  ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

  // Decorative lines
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  for (let i = 0; i < GAME_WIDTH; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, GAME_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(i + 20, GAME_HEIGHT - GROUND_HEIGHT + 10);
    ctx.stroke();
  }
}

function drawSpikes() {
  ctx.fillStyle = COLOR_SPIKE;
  ctx.strokeStyle = "#ffb300";
  ctx.lineWidth = 2;

  for (const spike of spikes) {
    const screenX = spike.x - worldOffset;
    if (screenX < -100 || screenX > GAME_WIDTH + 100) continue;

    const baseY = GAME_HEIGHT - GROUND_HEIGHT;
    const topY = baseY - spike.height;

    ctx.beginPath();
    ctx.moveTo(screenX, baseY);
    ctx.lineTo(screenX + spike.width / 2, topY);
    ctx.lineTo(screenX + spike.width, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();

  const color = dead ? COLOR_PLAYER_DEAD : COLOR_PLAYER;
  ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
  ctx.rotate((player.rotation * Math.PI) / 180);

  ctx.fillStyle = color;
  ctx.strokeStyle = "#00bcd4";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.rect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.fill();
  ctx.stroke();

  // Face details
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;

  // Eyes
  ctx.beginPath();
  ctx.rect(-player.size / 4 - 4, -player.size / 6, 8, 8);
  ctx.rect(player.size / 4 - 4, -player.size / 6, 8, 8);
  ctx.stroke();

  // Mouth
  ctx.beginPath();
  ctx.moveTo(-player.size / 4, player.size / 6);
  ctx.lineTo(player.size / 4, player.size / 6);
  ctx.stroke();

  ctx.restore();
}
