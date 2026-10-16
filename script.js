"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const startButton = document.getElementById("start-button");

const GROUND_Y = 220;
const DINO_X = 80;
const DINO_WIDTH = 36;
const DINO_HEIGHT = 48;
const CACTUS_WIDTH = 24;
const CACTUS_HEIGHT = 44;
const dino = { y: GROUND_Y, velocityY: 0 };

let state = "ready";
let obstacles = [];
let elapsed = 0;
let score = 0;
let spawnTimer = 0;
let spawnInterval = 1.5;
let groundOffset = 0;
let gameOverAt = -Infinity;
let previousTimestamp = null;

function jump() {
  if (dino.y === GROUND_Y && dino.velocityY === 0) {
    dino.velocityY = -650;
  }
}

function startGame() {
  if (state === "gameover" && performance.now() - gameOverAt < 400) {
    return;
  }
  if (state !== "running") {
    dino.y = GROUND_Y;
    dino.velocityY = 0;
    obstacles = [];
    elapsed = 0;
    score = 0;
    spawnTimer = 0;
    spawnInterval = 1.5;
    groundOffset = 0;
    gameOverAt = -Infinity;
    previousTimestamp = null;
    scoreElement.textContent = "0";
    state = "running";
    startButton.textContent = "진행 중";
    startButton.disabled = true;
  }
  jump();
}

function collides(obstacle) {
  const left = DINO_X + 4;
  const right = DINO_X + DINO_WIDTH - 4;
  const top = dino.y - DINO_HEIGHT + 4;
  const bottom = dino.y - 4;
  return left < obstacle.x + CACTUS_WIDTH &&
    right > obstacle.x &&
    top < GROUND_Y &&
    bottom > GROUND_Y - CACTUS_HEIGHT;
}

function update(deltaTime, timestamp) {
  elapsed += deltaTime;
  score = Math.floor(elapsed * 10);
  scoreElement.textContent = String(score);
  const speed = Math.min(320 + elapsed * 6, 500);

  dino.velocityY += 1900 * deltaTime;
  dino.y += dino.velocityY * deltaTime;
  if (dino.y >= GROUND_Y && dino.velocityY >= 0) {
    dino.y = GROUND_Y;
    dino.velocityY = 0;
  }

  groundOffset = (groundOffset + speed * deltaTime) % 36;
  for (const obstacle of obstacles) {
    obstacle.x -= speed * deltaTime;
  }
  obstacles = obstacles.filter(obstacle => obstacle.x + CACTUS_WIDTH > 0);

  spawnTimer += deltaTime;
  if (spawnTimer >= spawnInterval) {
    obstacles.push({ x: 920 });
    spawnTimer -= spawnInterval;
    spawnInterval = 1.3 + Math.random() * 0.6;
  }

  if (obstacles.some(collides)) {
    state = "gameover";
    gameOverAt = timestamp;
    startButton.textContent = "재시작";
    startButton.disabled = false;
  }
}

function drawDino() {
  const x = DINO_X;
  const top = Math.round(dino.y - DINO_HEIGHT);
  const stride = state === "running" && dino.y === GROUND_Y
    ? Math.floor(elapsed * 12) % 2 : 0;

  ctx.fillStyle = "#45494c";
  ctx.fillRect(x + 16, top, 20, 16);
  ctx.fillRect(x + 12, top + 12, 17, 12);
  ctx.fillRect(x + 8, top + 21, 18, 16);
  ctx.fillRect(x, top + 20, 12, 9);
  ctx.fillRect(x, top + 16, 5, 6);
  ctx.fillRect(x + 24, top + 23, 9, 4);
  ctx.fillRect(x + 30, top + 26, 3, 5);
  ctx.fillRect(x + 9, top + 35, 6, stride ? 8 : 13);
  ctx.fillRect(x + 9, top + (stride ? 40 : 45), 10, 3);
  ctx.fillRect(x + 21, top + 35, 6, stride ? 13 : 8);
  ctx.fillRect(x + 21, top + (stride ? 45 : 40), 10, 3);
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(x + 29, top + 4, 3, 3);
}

function drawCactus(obstacle) {
  const x = Math.round(obstacle.x);
  const top = GROUND_Y - CACTUS_HEIGHT;
  ctx.fillStyle = "#45494c";
  ctx.fillRect(x + 9, top, 7, 44);
  ctx.fillRect(x, top + 13, 6, 18);
  ctx.fillRect(x + 4, top + 25, 7, 6);
  ctx.fillRect(x + 19, top + 7, 5, 19);
  ctx.fillRect(x + 14, top + 20, 7, 6);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#777c80";
  ctx.fillRect(0, GROUND_Y, canvas.width, 2);
  for (let i = 0; i < 27; i += 1) {
    const x = i * 36 - groundOffset;
    ctx.fillRect(Math.round(x), GROUND_Y + 10 + (i % 3) * 4, 4 + (i % 2) * 4, 2);
  }
  drawDino();
  obstacles.forEach(drawCactus);

  if (state !== "running") {
    ctx.fillStyle = "#3c4043";
    ctx.textAlign = "center";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(state === "ready" ? "Space 또는 클릭으로 시작" : "게임 오버", 450, 96);
    ctx.font = "16px Arial, sans-serif";
    ctx.fillText(state === "ready" ? "↑ 키로도 시작할 수 있어요" : "Space / ↑ / 클릭으로 재시작", 450, 128);
  }
}

function frame(timestamp) {
  const deltaTime = previousTimestamp === null
    ? 0 : Math.min(Math.max((timestamp - previousTimestamp) / 1000, 0), 0.033);
  previousTimestamp = timestamp;
  if (state === "running" && !document.hidden) {
    update(deltaTime, timestamp);
  }
  draw();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", event => {
  if (event.code !== "Space" && event.code !== "ArrowUp") {
    return;
  }
  // 버튼에 포커스가 있어도 Space의 기본 클릭을 막고 한 번만 처리합니다.
  event.preventDefault();
  if (!event.repeat) {
    startGame();
  }
});
canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  startGame();
});
startButton.addEventListener("click", startGame);
document.addEventListener("visibilitychange", () => {
  previousTimestamp = null;
});

requestAnimationFrame(frame);
