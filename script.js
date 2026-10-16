"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("best-score");
const startButton = document.getElementById("start-button");

const GROUND_Y = 220;
const DINO_X = 80;
const DINO_WIDTH = 36;
const DINO_HEIGHT = 48;
const CACTUS_WIDTH = 24;
const CACTUS_HEIGHT = 44;
const DUCK_WIDTH = 48;
const DUCK_HEIGHT = 26;
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 26;
const BEST_SCORE_KEY = "dino-runner-best-score";
const dino = { y: GROUND_Y, velocityY: 0, ducking: false };

let state = "ready";
let obstacles = [];
let elapsed = 0;
let score = 0;
let scoreProgress = 0;
let duckHeld = false;
let bestScore = readBestScore();
let savedBestScore = bestScore;
let spawnTimer = 0;
let spawnInterval = 1.5;
let groundOffset = 0;
let gameOverAt = -Infinity;
let previousTimestamp = null;

bestScoreElement.textContent = String(bestScore);

function readBestScore() {
  try {
    const value = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  if (bestScore <= savedBestScore) return;
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    savedBestScore = bestScore;
  } catch {
    // 저장이 차단된 브라우저에서도 현재 플레이의 최고점수는 유지합니다.
  }
}

function jump() {
  if (!dino.ducking && dino.y === GROUND_Y && dino.velocityY === 0) {
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
    dino.ducking = false;
    duckHeld = false;
    obstacles = [];
    elapsed = 0;
    score = 0;
    scoreProgress = 0;
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
  canvas.focus({ preventScroll: true });
  jump();
}

function collides(obstacle) {
  const width = dino.ducking ? DUCK_WIDTH : DINO_WIDTH;
  const height = dino.ducking ? DUCK_HEIGHT : DINO_HEIGHT;
  const left = DINO_X + 4;
  const right = DINO_X + width - 4;
  const top = dino.y - height + 4;
  const bottom = dino.y - 4;
  return left < obstacle.x + obstacle.width &&
    right > obstacle.x &&
    top < obstacle.y &&
    bottom > obstacle.y - obstacle.height;
}

function update(deltaTime, timestamp) {
  elapsed += deltaTime;
  const speed = Math.min(320 + elapsed * 8, 650);
  scoreProgress += deltaTime * 10 * (speed / 320);
  score = Math.floor(scoreProgress);
  scoreElement.textContent = String(score);
  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = String(bestScore);
  }

  dino.velocityY += 1900 * deltaTime;
  dino.y += dino.velocityY * deltaTime;
  if (dino.y >= GROUND_Y && dino.velocityY >= 0) {
    dino.y = GROUND_Y;
    dino.velocityY = 0;
  }
  dino.ducking = duckHeld && dino.y === GROUND_Y && dino.velocityY === 0;

  groundOffset = (groundOffset + speed * deltaTime) % 36;
  for (const obstacle of obstacles) {
    obstacle.x -= speed * deltaTime;
  }
  obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > 0);

  spawnTimer += deltaTime;
  if (spawnTimer >= spawnInterval) {
    const bird = elapsed >= 8 && Math.random() < 0.35;
    obstacles.push({
      type: bird ? "bird" : "cactus",
      x: 920,
      y: bird ? 190 : GROUND_Y,
      width: bird ? BIRD_WIDTH : CACTUS_WIDTH,
      height: bird ? BIRD_HEIGHT : CACTUS_HEIGHT
    });
    spawnTimer -= spawnInterval;
    spawnInterval = 1.3 + Math.random() * 0.6;
  }

  if (obstacles.some(collides)) {
    state = "gameover";
    gameOverAt = timestamp;
    startButton.textContent = "재시작";
    startButton.disabled = false;
    saveBestScore();
  }
}

function drawDino() {
  const x = DINO_X;
  const top = Math.round(dino.y - DINO_HEIGHT);
  const stride = state === "running" && dino.y === GROUND_Y
    ? Math.floor(elapsed * 12) % 2 : 0;

  ctx.fillStyle = "#45494c";
  if (dino.ducking) {
    const duckTop = Math.round(dino.y - DUCK_HEIGHT);
    ctx.fillRect(x, duckTop + 7, 12, 7);
    ctx.fillRect(x + 8, duckTop + 5, 24, 14);
    ctx.fillRect(x + 29, duckTop, 19, 13);
    ctx.fillRect(x + 12, duckTop + 17, 6, stride ? 5 : 9);
    ctx.fillRect(x + 12, duckTop + (stride ? 20 : 23), 10, 3);
    ctx.fillRect(x + 28, duckTop + 17, 6, stride ? 9 : 5);
    ctx.fillRect(x + 28, duckTop + (stride ? 23 : 20), 10, 3);
    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(x + 41, duckTop + 3, 3, 3);
    return;
  }
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

function drawBird(obstacle) {
  const x = Math.round(obstacle.x);
  const top = obstacle.y - obstacle.height;
  const flap = Math.floor(elapsed * 10) % 2;
  ctx.fillStyle = "#45494c";
  ctx.fillRect(x, top + 10, 9, 4);
  ctx.fillRect(x + 6, top + 5, 12, 12);
  ctx.fillRect(x + 14, top + 11, 19, 9);
  ctx.fillRect(x + 30, top + 9, 10, 5);
  ctx.fillRect(x + 20, top + (flap ? 17 : 0), 6, flap ? 9 : 13);
  ctx.fillRect(x + 25, top + (flap ? 22 : 0), 7, 4);
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(x + 9, top + 7, 2, 2);
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
  obstacles.forEach(obstacle => {
    if (obstacle.type === "bird") drawBird(obstacle);
    else drawCactus(obstacle);
  });

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

function getControlKey(event) {
  // 일부 웹뷰에서는 code가 비어 있으므로 실제 키 값도 함께 확인합니다.
  if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
    return "Space";
  }
  if (event.code === "ArrowUp" || event.key === "ArrowUp") return "ArrowUp";
  if (event.code === "ArrowDown" || event.key === "ArrowDown") return "ArrowDown";
  return null;
}

document.addEventListener("keydown", event => {
  const key = getControlKey(event);
  if (key === "ArrowDown") {
    event.preventDefault();
    if (state === "running") {
      duckHeld = true;
      dino.ducking = dino.y === GROUND_Y && dino.velocityY === 0;
    }
    return;
  }
  if (key !== "Space" && key !== "ArrowUp") {
    return;
  }
  // 버튼에 포커스가 있어도 Space의 기본 클릭을 막고 한 번만 처리합니다.
  event.preventDefault();
  if (!event.repeat) {
    startGame();
  }
});
document.addEventListener("keyup", event => {
  if (getControlKey(event) === "ArrowDown") {
    event.preventDefault();
    releaseDuck();
  }
});

function releaseDuck() {
  duckHeld = false;
  if (state === "running") dino.ducking = false;
}

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  startGame();
});
startButton.addEventListener("click", startGame);
document.addEventListener("visibilitychange", () => {
  previousTimestamp = null;
  releaseDuck();
  if (document.hidden) saveBestScore();
});
window.addEventListener("blur", releaseDuck);
window.addEventListener("pagehide", saveBestScore);

canvas.focus({ preventScroll: true });
requestAnimationFrame(frame);
