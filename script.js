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
const CACTUS_GAP = 8;
const MAX_CACTUS_COUNT = 3;
const FLIGHT_EVERY = 300;
const FLIGHT_LENGTH = 100;
const FLIGHT_WIDTH = 48;
const FLIGHT_HEIGHT = 28;
const FLIGHT_SPEED = 240;
const TRANSFORM_DURATION = 1.35;
const BEST_SCORE_KEY = "dino-runner-best-score";
const dino = { y: GROUND_Y, velocityY: 0, ducking: false };

let state = "ready";
let obstacles = [];
let elapsed = 0;
let score = 0;
let scoreProgress = 0;
let duckHeld = false;
let upHeld = false;
let form = "dino";
let transformTime = 0;
let transition = null;
let flightBlend = 0;
let departingObstacles = [];
let landingTime = 0;
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
  if (!transition && form === "dino" && !dino.ducking && dino.y === GROUND_Y && dino.velocityY === 0) {
    landingTime = 0;
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
    upHeld = false;
    form = "dino";
    transformTime = 0;
    transition = null;
    flightBlend = 0;
    departingObstacles = [];
    landingTime = 0;
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
    updateModeLabel();
    state = "running";
    startButton.textContent = "진행 중";
    startButton.disabled = true;
  }
  canvas.focus({ preventScroll: true });
  jump();
}

function collides(obstacle) {
  const width = form === "pterosaur" ? FLIGHT_WIDTH : dino.ducking ? DUCK_WIDTH : DINO_WIDTH;
  const height = form === "pterosaur" ? FLIGHT_HEIGHT : dino.ducking ? DUCK_HEIGHT : DINO_HEIGHT;
  const left = DINO_X + 4;
  const right = DINO_X + width - 4;
  const top = dino.y - height + 4;
  const bottom = dino.y - 4;
  return left < obstacle.x + obstacle.width &&
    right > obstacle.x &&
    top < obstacle.y &&
    bottom > obstacle.y - obstacle.height;
}

function updateModeLabel() {
  const nextFlight = (Math.floor(score / FLIGHT_EVERY) + 1) * FLIGHT_EVERY;
  const flightEnd = Math.floor(score / FLIGHT_EVERY) * FLIGHT_EVERY + FLIGHT_LENGTH;
  document.getElementById("mode").textContent = transition
    ? (form === "pterosaur" ? "이륙 중 · 잠시 후 ↑ ↓로 비행" : "착지 중 · 잠시 후 점프 · 숙이기")
    : form === "pterosaur"
    ? `익룡 구간 · ↑ ↓로 새 피하기 · ${flightEnd}점까지`
    : `공룡 구간 · 다음 익룡 변신 ${nextFlight}점`;
}

function syncForm() {
  const nextForm = score >= FLIGHT_EVERY && score % FLIGHT_EVERY < FLIGHT_LENGTH
    ? "pterosaur" : "dino";
  if (nextForm === form) return;
  transition = {
    elapsed: 0,
    startY: dino.y,
    targetY: nextForm === "pterosaur" ? 140 : GROUND_Y,
    startBlend: flightBlend,
    targetBlend: nextForm === "pterosaur" ? 1 : 0,
    fromDuck: dino.ducking,
    fromStride: dino.y === GROUND_Y ? Math.floor(elapsed * 12) % 2 : 0
  };
  form = nextForm;
  dino.velocityY = 0;
  dino.ducking = false;
  upHeld = false;
  duckHeld = false;
  // 기존 장애물은 배경과 함께 사라지며, 변신을 마친 뒤 새 장애물을 생성합니다.
  departingObstacles = obstacles;
  obstacles = [];
  spawnTimer = 0;
  spawnInterval = 1.5;
  transformTime = TRANSFORM_DURATION + 0.5;
  landingTime = 0;
  updateModeLabel();
}

function easeInOut(value) {
  return value * value * (3 - 2 * value);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function updateTransition(deltaTime) {
  transition.elapsed = Math.min(TRANSFORM_DURATION, transition.elapsed + deltaTime);
  const progress = transition.elapsed / TRANSFORM_DURATION;
  const eased = easeInOut(progress);
  flightBlend = lerp(transition.startBlend, transition.targetBlend, eased);
  // 작은 상승 곡선으로 이륙과 착지를 연결하고, 양 끝에서는 속도가 0이 됩니다.
  const lift = form === "pterosaur" ? 12 * Math.sin(Math.PI * progress) ** 2 : 0;
  dino.y = lerp(transition.startY, transition.targetY, eased) - lift;
  if (progress === 1) {
    dino.y = transition.targetY;
    flightBlend = transition.targetBlend;
    transition = null;
    departingObstacles = [];
    if (form === "dino") landingTime = 0.24;
    updateModeLabel();
  }
}

function spawnObstacles() {
  const flying = form === "pterosaur";
  const bird = flying || (elapsed >= 8 && Math.random() < 0.35);
  if (bird) {
    obstacles.push({
      type: "bird", x: 920,
      y: flying ? 85 + Math.floor(Math.random() * 3) * 50 : 190,
      width: BIRD_WIDTH, height: BIRD_HEIGHT
    });
    return;
  }
  const count = 1 + Math.floor(Math.random() * MAX_CACTUS_COUNT);
  for (let i = 0; i < count; i += 1) {
    obstacles.push({
      type: "cactus", x: 920 + i * (CACTUS_WIDTH + CACTUS_GAP),
      y: GROUND_Y, width: CACTUS_WIDTH, height: CACTUS_HEIGHT
    });
  }
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
  syncForm();
  transformTime = Math.max(0, transformTime - deltaTime);
  landingTime = Math.max(0, landingTime - deltaTime);

  const wasTransforming = transition !== null;
  if (wasTransforming) {
    updateTransition(deltaTime);
  } else if (form === "pterosaur") {
    const direction = Number(duckHeld) - Number(upHeld);
    dino.y = Math.max(30 + FLIGHT_HEIGHT, Math.min(204, dino.y + direction * FLIGHT_SPEED * deltaTime));
  } else {
    dino.velocityY += 1900 * deltaTime;
    dino.y += dino.velocityY * deltaTime;
    if (dino.y >= GROUND_Y && dino.velocityY >= 0) {
      dino.y = GROUND_Y;
      dino.velocityY = 0;
    }
    dino.ducking = duckHeld && dino.y === GROUND_Y && dino.velocityY === 0;
  }

  groundOffset = (groundOffset + speed * deltaTime) % 36;
  for (const obstacle of departingObstacles) {
    obstacle.x -= speed * deltaTime;
  }
  for (const obstacle of obstacles) {
    obstacle.x -= speed * deltaTime;
  }
  obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > 0);

  if (!wasTransforming) spawnTimer += deltaTime;
  if (spawnTimer >= spawnInterval) {
    spawnObstacles();
    spawnTimer -= spawnInterval;
    spawnInterval = 1.3 + Math.random() * 0.6;
  }

  if (!wasTransforming && obstacles.some(collides)) {
    state = "gameover";
    gameOverAt = timestamp;
    startButton.textContent = "재시작";
    startButton.disabled = false;
    saveBestScore();
  }
}

function drawMorphCharacter() {
  const ducking = transition && form === "pterosaur" ? transition.fromDuck : dino.ducking;
  const stride = transition && form === "pterosaur" ? transition.fromStride : 0;
  // 각 사각형을 머리·몸통·꼬리·팔/날개·다리 순서로 대응시켜 형태를 이어 줍니다.
  const groundParts = ducking ? [
    [29, -26, 19, 13], [24, -21, 8, 8], [8, -21, 24, 14],
    [0, -19, 12, 7], [0, -19, 0, 0], [25, -14, 4, 3], [28, -12, 3, 3],
    [12, -9, 6, stride ? 5 : 9], [12, stride ? -6 : -3, 10, 3],
    [28, -9, 6, stride ? 9 : 5], [28, stride ? -3 : -6, 10, 3],
    [43, -16, 4, 2], [41, -23, 3, 3]
  ] : [
    [16, -48, 20, 16], [12, -36, 17, 12], [8, -27, 18, 16],
    [0, -28, 12, 9], [0, -32, 5, 6], [24, -25, 9, 4], [30, -22, 3, 5],
    [9, -13, 6, stride ? 8 : 13], [9, stride ? -8 : -3, 10, 3],
    [21, -13, 6, stride ? 13 : 8], [21, stride ? -3 : -8, 10, 3],
    [32, -37, 4, 2], [29, -44, 3, 3]
  ];
  const flap = (Math.sin(elapsed * 12) + 1) / 2;
  const flightParts = [
    [30, -23, 12, 12], [27, -26, 8, 5], [10, -17, 26, 10],
    [0, -15, 14, 4], [0, -15, 0, 0], [15, -28 + 17 * flap, 8, 11], [7, -28 + 24 * flap, 10, 4],
    [17, -9, 3, 3], [18, -6, 6, 2], [24, -9, 3, 3], [25, -6, 6, 2],
    [39, -19, 9, 4], [35, -20, 3, 3]
  ];
  groundParts.forEach((part, index) => {
    const shape = part.map((value, axis) => lerp(value, flightParts[index][axis], flightBlend));
    ctx.fillStyle = index === groundParts.length - 1 ? "#f7f7f7" : "#45494c";
    ctx.fillRect(DINO_X + shape[0], dino.y + shape[1], shape[2], shape[3]);
  });
}

function drawDino() {
  const x = DINO_X;
  const top = Math.round(dino.y - DINO_HEIGHT);
  const stride = state === "running" && dino.y === GROUND_Y && landingTime === 0
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
  const sky = [247, 247, 247].map((value, index) => Math.round(lerp(value, [226, 239, 249][index], flightBlend)));
  ctx.fillStyle = `rgb(${sky.join(",")})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = flightBlend * 0.25;
  ctx.fillStyle = "#a2b6c4";
  for (let i = 0; i < 5; i += 1) {
    const x = ((i * 211 - elapsed * 100) % 1050 + 1050) % 1050 - 75;
    ctx.fillRect(x, 65 + i * 29, 30 + (i % 3) * 12, 2);
  }
  ctx.restore();
  const groundScreenY = GROUND_Y + flightBlend * 100;
  ctx.fillStyle = "#777c80";
  ctx.fillRect(0, groundScreenY, canvas.width, 2);
  for (let i = 0; i < 27; i += 1) {
    const x = i * 36 - groundOffset;
    ctx.fillRect(Math.round(x), groundScreenY + 10 + (i % 3) * 4, 4 + (i % 2) * 4, 2);
  }
  if (transition) {
    ctx.save();
    ctx.globalAlpha = 1 - easeInOut(transition.elapsed / TRANSFORM_DURATION);
    departingObstacles.forEach(obstacle => {
      if (obstacle.type === "bird") drawBird(obstacle);
      else {
        ctx.save();
        ctx.translate(0, groundScreenY - GROUND_Y);
        drawCactus(obstacle);
        ctx.restore();
      }
    });
    ctx.restore();
  }
  if (flightBlend > 0 || transition) drawMorphCharacter();
  else {
    ctx.save();
    const squash = dino.y === GROUND_Y ? Math.sin(Math.PI * landingTime / 0.24) * 0.08 : 0;
    ctx.translate(DINO_X + DINO_WIDTH / 2, dino.y);
    ctx.scale(1 + squash, 1 - squash);
    ctx.translate(-DINO_X - DINO_WIDTH / 2, -dino.y);
    drawDino();
    ctx.restore();
  }
  obstacles.forEach(obstacle => {
    if (obstacle.type === "bird") drawBird(obstacle);
    else drawCactus(obstacle);
  });

  if (state === "running" && transformTime > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, transformTime / 0.3);
    ctx.fillStyle = "#3c4043";
    ctx.textAlign = "center";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText(form === "pterosaur" ? "익룡으로 변신! ↑ ↓로 이동" : "공룡으로 변신! 점프 · 숙이기", 450, 50);
    ctx.restore();
  }

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
  if (state === "running" && form === "pterosaur" && (key === "ArrowUp" || key === "ArrowDown")) {
    event.preventDefault();
    if (key === "ArrowUp") upHeld = true;
    else duckHeld = true;
    return;
  }
  if (key === "ArrowDown") {
    event.preventDefault();
    if (state === "running") {
      duckHeld = true;
      dino.ducking = !transition && dino.y === GROUND_Y && dino.velocityY === 0;
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
  if (getControlKey(event) === "ArrowUp") {
    event.preventDefault();
    upHeld = false;
  }
  if (getControlKey(event) === "ArrowDown") {
    event.preventDefault();
    releaseDuck();
  }
});

function releaseDuck() {
  duckHeld = false;
  if (state === "running") dino.ducking = false;
}

function releaseControls() {
  upHeld = false;
  releaseDuck();
}

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  startGame();
});
startButton.addEventListener("click", startGame);
document.addEventListener("visibilitychange", () => {
  previousTimestamp = null;
  releaseControls();
  if (document.hidden) saveBestScore();
});
window.addEventListener("blur", releaseControls);
window.addEventListener("pagehide", saveBestScore);

canvas.focus({ preventScroll: true });
requestAnimationFrame(frame);
