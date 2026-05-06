// Geometry Runner - Embedded Game Version
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const W = 960;
const H = 540;

const GROUND = 80;
const PLAYER_SIZE = 40;
const GRAVITY = 1;
const JUMP = -18;
const SPEED = 8;

let running = false;
let dead = false;
let worldX = 0;
let last = 0;
let jumpQueued = false;

const player = {
  x: 200,
  y: H - GROUND - PLAYER_SIZE,
  vy: 0,
  angle: 0,
  onGround: true
};

const spikes = buildLevel();

function buildLevel() {
  const arr = [];
  let x = 900;

  function spike(gap = 200) {
    arr.push({ x, w: 40, h: 60 });
    x += gap;
  }

  function triple() {
    for (let i = 0; i < 3; i++) {
      arr.push({ x: x + i * 60, w: 40, h: 60 });
    }
    x += 300;
  }

  spike(220);
  spike(160);
  triple();
  spike(300);
  triple();
  spike(260);

  arr.end = x + 400;
  return arr;
}

function queueJump() {
  if (!running) {
    start();
    return;
  }
  jumpQueued = true;
}

window.addEventListener("keydown", e => {
  if (e.code === "Space") queueJump();
});
canvas.addEventListener("mousedown", queueJump);
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  queueJump();
});

function start() {
  running = true;
  dead = false;
  worldX = 0;
  player.y = H - GROUND - PLAYER_SIZE;
  player.vy = 0;
  player.onGround = true;
  player.angle = 0;
  statusEl.textContent = "Running...";
}

function update(dt) {
  if (!running) return;

  if (dead) {
    if (jumpQueued) start();
    jumpQueued = false;
    return;
  }

  worldX += SPEED * dt;

  if (jumpQueued && player.onGround) {
    player.vy = JUMP;
    player.onGround = false;
  }
  jumpQueued = false;

  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  const groundY = H - GROUND - PLAYER_SIZE;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  }

  if (!player.onGround) player.angle += 8 * dt;
  else player.angle = 0;

  for (const s of spikes) {
    const sx = s.x - worldX;
    if (sx < -200 || sx > W + 200) continue;

    if (collide(player, sx, s)) {
      dead = true;
      running = false;
      statusEl.textContent = "You Died! Tap to retry.";
    }
  }

  if (worldX > spikes.end) {
    running = false;
    statusEl.textContent = "Level Complete!";
  }
}

function collide(p, sx, s) {
  const baseY = H - GROUND;
  const topY = baseY - s.h;

  const px1 = p.x, py1 = p.y;
  const px2 = p.x + PLAYER_SIZE, py2 = p.y + PLAYER_SIZE;

  const sx1 = sx, sx2 = sx + s.w;
  const sy1 = topY, sy2 = baseY;

  if (px2 < sx1 || px1 > sx2 || py2 < sy1 || py1 > sy2) return false;

  const cx = sx + s.w / 2;
  const half = s.w / 2;

  const corners = [
    { x: px1, y: py1 },
    { x: px2, y: py1 },
    { x: px1, y: py2 },
    { x: px2, y: py2 }
  ];

  for (const c of corners) {
    const t = (c.y - topY) / (baseY - topY);
    if (t < 0 || t > 1) continue;
    const allowed = half * t;
    if (c.x >= cx - allowed && c.x <= cx + allowed) return true;
  }

  return false;
}

function render() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#263238";
  ctx.fillRect(0, H - GROUND - 200, W, 200);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, H - GROUND, W, GROUND);

  ctx.fillStyle = "#ffca28";
  for (const s of spikes) {
    const sx = s.x - worldX;
    const baseY = H - GROUND;
    const topY = baseY - s.h;

    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.lineTo(sx + s.w / 2, topY);
    ctx.lineTo(sx + s.w, baseY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.translate(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
  ctx.rotate((player.angle * Math.PI) / 180);
  ctx.fillStyle = dead ? "#ff5252" : "#00e5ff";
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
  ctx.restore();
}

function loop(ts) {
  if (!last) last = ts;
  const dt = (ts - last) / 16.67;
  last = ts;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
