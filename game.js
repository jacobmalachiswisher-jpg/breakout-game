const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const groundY = 230;
let lastTime = 0;
let gameOver = false;
let score = 0;

// Player
const player = {
  x: 80,
  y: groundY,
  size: 30,
  vy: 0,
  gravity: 0.7,
  jumpStrength: -13,
  onGround: true,
};

// Obstacles
const obstacles = [];
const obstacleMinGap = 900;
const obstacleMaxGap = 1600;
let nextObstacleX = 500;

// Input
let jumpQueued = false;
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    jumpQueued = true;
  }
});
canvas.addEventListener("mousedown", () => {
  jumpQueued = true;
});

function resetGame() {
  gameOver = false;
  score = 0;
  player.y = groundY;
  player.vy = 0;
  player.onGround = true;
  obstacles.length = 0;
  nextObstacleX = 500;
  lastTime = 0;
  requestAnimationFrame(loop);
}

function spawnObstacle() {
  const width = 30;
  const height = 40;
  obstacles.push({
    x: canvas.width + 20,
    y: groundY + player.size - height,
    width,
    height,
    passed: false,
  });
  nextObstacleX =
    canvas.width +
    obstacleMinGap +
    Math.random() * (obstacleMaxGap - obstacleMinGap);
}

function update(dt) {
  if (gameOver) return;

  // Handle jump
  if (jumpQueued && player.onGround) {
    player.vy = player.jumpStrength;
    player.onGround = false;
  }
  jumpQueued = false;

  // Physics
  player.vy += player.gravity;
  player.y += player.vy;

  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  }

  // Spawn obstacles
  if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < nextObstacleX) {
    spawnObstacle();
  }

  // Move obstacles
  const speed = 6;
  for (const o of obstacles) {
    o.x -= speed;
    if (!o.passed && o.x + o.width < player.x) {
      o.passed = true;
      score++;
    }
  }

  // Remove off-screen obstacles
  while (obstacles.length && obstacles[0].x + obstacles[0].width < -50) {
    obstacles.shift();
  }

  // Collision
  for (const o of obstacles) {
    if (
      player.x < o.x + o.width &&
      player.x + player.size > o.x &&
      player.y < o.y + o.height &&
      player.y + player.size > o.y
    ) {
      gameOver = true;
    }
  }
}

function drawGround() {
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY + player.size);
  ctx.lineTo(canvas.width, groundY + player.size);
  ctx.stroke();
}

function drawPlayer() {
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(player.x, player.y, player.size, player.size);
}

function drawObstacles() {
  ctx.fillStyle = "#ff1744";
  for (const o of obstacles) {
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.height);
    ctx.lineTo(o.x + o.width / 2, o.y);
    ctx.lineTo(o.x + o.width, o.y + o.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawUI() {
  ctx.fillStyle = "#fff";
  ctx.font = "20px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, 16, 30);

  if (gameOver) {
    ctx.textAlign = "center";
    ctx.font = "32px system-ui";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "18px system-ui";
    ctx.fillText(
      "Press SPACE or CLICK to restart",
      canvas.width / 2,
      canvas.height / 2 + 20
    );
  }
}

function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameOver) {
    update(dt);
  } else {
    // Allow restart
    if (jumpQueued) {
      jumpQueued = false;
      resetGame();
      return;
    }
  }

  drawGround();
  drawPlayer();
  drawObstacles();
  drawUI();

  requestAnimationFrame(loop);
}

resetGame();
