const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const resumeButton = document.getElementById("resume-button");
const restartButton = document.getElementById("restart-button");
const levelIndicator = document.getElementById("level-indicator");

const musicSlider = document.getElementById("music-volume");
const sfxSlider = document.getElementById("sfx-volume");
const skinPreview = document.getElementById("skin-preview");
const skinBadge = document.getElementById("skin-badge");
const skinPrevPreview = document.getElementById("skin-prev-preview");
const skinNextPreview = document.getElementById("skin-next-preview");
const skinName = document.getElementById("skin-name");
const skinDesc = document.getElementById("skin-desc");
const skinPrev = document.getElementById("skin-prev");
const skinNext = document.getElementById("skin-next");

const WORLD_HEIGHT = 900;
const LEVEL_COUNT = 10;
const BALL_RADIUS = 26;
const GRAVITY = 2600;
const MOVE_ACCEL = 2200;
const AIR_ACCEL = 1400;
const MAX_SPEED = 620;
const FRICTION = 2000;
const AIR_DRAG = 200;
const JUMP_SPEED = 860;
const SHAKE_SPEED = 520;
const CALM_SPEED = 260;

const ASSET_ROOT = "../Media Files";

const ballTextures = {
  normal: new Image(),
  shook: new Image(),
  dizzy: new Image(),
};
ballTextures.normal.src = `${ASSET_ROOT}/Textures/Boll/Boll.png`;
ballTextures.shook.src = `${ASSET_ROOT}/Textures/Boll/Boll_Shook.png`;
ballTextures.dizzy.src = `${ASSET_ROOT}/Textures/Boll/Boll_Dizzy.png`;

const backgroundSources = [
  `${ASSET_ROOT}/Textures/Background/Grassy_Planes_Day.png`,
  `${ASSET_ROOT}/Textures/Background/Grassy_Planes_Night.png`,
];
const backgrounds = backgroundSources.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

const musicSources = [
  `${ASSET_ROOT}/Sounds/Music/Build_A_Life.mp3`,
  `${ASSET_ROOT}/Sounds/Music/Lit_Up.mp3`,
];
const musicPlaylist = musicSources.map((src) => new Audio(src));
let currentTrackIndex = 0;
let audioReady = false;
let audioContext = null;

musicPlaylist.forEach((track) => {
  track.loop = false;
  track.volume = Number(musicSlider.value);
  track.addEventListener("ended", () => {
    currentTrackIndex = (currentTrackIndex + 1) % musicPlaylist.length;
    playCurrentTrack();
  });
});

const sfx = {
  jump: { frequency: 440, duration: 0.12 },
  portal: { frequency: 620, duration: 0.18 },
  fail: { frequency: 220, duration: 0.2 },
};

const state = {
  levelIndex: 0,
  levels: [],
  background: backgrounds[0],
  paused: false,
  gameWon: false,
  keys: new Set(),
  lastTime: 0,
  player: {
    x: 120,
    y: 420,
    vx: 0,
    vy: 0,
    angle: 0,
    onGround: false,
    coyoteTime: 0,
    textureState: "normal",
    dizzyTimer: 0,
    wasShook: false,
    onPlatform: null,
  },
  camera: {
    x: 0,
    y: 0,
  },
  skins: [
    {
      name: "Classic Boll",
      description: "Reach level 1 to unlock.",
      unlockLevel: 1,
    },
    {
      name: "Stone Boll",
      description: "Reach level 4 to unlock.",
      unlockLevel: 4,
    },
    {
      name: "Galaxy Boll",
      description: "Reach level 7 to unlock.",
      unlockLevel: 7,
    },
  ],
  selectedSkin: 0,
  unlockedLevels: 1,
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function playCurrentTrack() {
  if (!audioReady) return;
  const track = musicPlaylist[currentTrackIndex];
  track.currentTime = 0;
  track.play().catch(() => {});
}

function initAudio() {
  if (audioReady) return;
  audioReady = true;
  playCurrentTrack();
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playSfx(type) {
  if (!audioContext) return;
  const settings = sfx[type];
  if (!settings) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = settings.frequency;
  gain.gain.value = Number(sfxSlider.value) * 0.18;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + settings.duration);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function generateLevel(index) {
  const levelLength = 1600 + index * 700;
  const platforms = [];
  const hazards = [];

  let x = 0;
  let y = 520;

  platforms.push({ x: 0, y: 560, width: 400, height: 30, moving: false });
  x = 420;

  const gapMin = 120 + index * 6;
  const gapMax = 240 + index * 12;
  const heightShift = 80 + index * 6;

  while (x < levelLength - 420) {
    const width = randomRange(200, 360);
    const gap = randomRange(gapMin, gapMax);
    y = clamp(y + randomRange(-heightShift, heightShift), 280, 640);
    const platform = {
      x,
      y,
      width,
      height: 24,
      moving: false,
    };

    if (index > 1 && Math.random() < 0.35) {
      platform.moving = true;
      platform.baseX = platform.x;
      platform.baseY = platform.y;
      platform.axis = Math.random() > 0.5 ? "x" : "y";
      platform.range = randomRange(40, 120 + index * 6);
      platform.speed = randomRange(0.6, 1.2 + index * 0.08);
      platform.phase = Math.random() * Math.PI * 2;
    }

    platforms.push(platform);

    if (Math.random() < 0.4 + index * 0.03) {
      hazards.push({
        x: x + width * 0.4,
        y: y - 18,
        width: 50,
        height: 18,
      });
    }

    x += width + gap;
  }

  const portal = {
    x: levelLength - 220,
    y: 380,
    width: 70,
    height: 140,
  };

  const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];

  return {
    length: levelLength,
    platforms,
    hazards,
    portal,
    background,
    index,
  };
}

function initLevels() {
  state.levels = Array.from({ length: LEVEL_COUNT }, (_, i) => generateLevel(i));
  setLevel(0);
}

function setLevel(index) {
  state.levelIndex = index;
  state.background = state.levels[index].background;
  state.player.x = 140;
  state.player.y = 440;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.angle = 0;
  state.player.textureState = "normal";
  state.player.dizzyTimer = 0;
  state.player.wasShook = false;
  state.player.onPlatform = null;
  updateLevelIndicator();
  updateSkinUnlocks();
}

function updateLevelIndicator() {
  levelIndicator.textContent = `Level ${state.levelIndex + 1} / ${LEVEL_COUNT}`;
}

function updateSkinUnlocks() {
  state.unlockedLevels = Math.max(state.unlockedLevels, state.levelIndex + 1);
  updateSkinUI();
}

function handleInput(dt) {
  const left = state.keys.has("a") || state.keys.has("arrowleft");
  const right = state.keys.has("d") || state.keys.has("arrowright");
  const direction = Number(right) - Number(left);
  const accel = state.player.onGround ? MOVE_ACCEL : AIR_ACCEL;

  if (direction !== 0) {
    state.player.vx += direction * accel * dt;
  } else if (state.player.onGround) {
    const sign = Math.sign(state.player.vx);
    const decel = FRICTION * dt;
    state.player.vx = Math.abs(state.player.vx) <= decel ? 0 : state.player.vx - sign * decel;
  } else {
    const sign = Math.sign(state.player.vx);
    const drag = AIR_DRAG * dt;
    state.player.vx = Math.abs(state.player.vx) <= drag ? 0 : state.player.vx - sign * drag;
  }

  state.player.vx = clamp(state.player.vx, -MAX_SPEED, MAX_SPEED);

  if (state.player.coyoteTime > 0) {
    state.player.coyoteTime -= dt;
  }
}

function jump() {
  if (state.player.onGround || state.player.coyoteTime > 0) {
    state.player.vy = -JUMP_SPEED;
    state.player.onGround = false;
    state.player.coyoteTime = 0;
    playSfx("jump");
  }
}

function updatePlatforms(level, time) {
  level.platforms.forEach((platform) => {
    platform.deltaX = 0;
    platform.deltaY = 0;
    if (platform.moving) {
      const prevX = platform.x;
      const prevY = platform.y;
      if (platform.axis === "x") {
        platform.x = platform.baseX + Math.sin(time * platform.speed + platform.phase) * platform.range;
      } else {
        platform.y = platform.baseY + Math.sin(time * platform.speed + platform.phase) * platform.range;
      }
      platform.deltaX = platform.x - prevX;
      platform.deltaY = platform.y - prevY;
    }
  });
}

function resolveCollisions(level, prevX, prevY) {
  state.player.onGround = false;
  state.player.onPlatform = null;

  for (const platform of level.platforms) {
    const closestX = clamp(state.player.x, platform.x, platform.x + platform.width);
    const closestY = clamp(state.player.y, platform.y, platform.y + platform.height);
    const dx = state.player.x - closestX;
    const dy = state.player.y - closestY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared < BALL_RADIUS * BALL_RADIUS) {
      const overlapX = BALL_RADIUS - Math.abs(dx);
      const overlapY = BALL_RADIUS - Math.abs(dy);

      if (Math.abs(overlapX) < Math.abs(overlapY)) {
        state.player.x += dx > 0 ? overlapX : -overlapX;
        state.player.vx = 0;
      } else {
        if (prevY + BALL_RADIUS <= platform.y) {
          state.player.y = platform.y - BALL_RADIUS;
          state.player.vy = 0;
          state.player.onGround = true;
          state.player.coyoteTime = 0.1;
          state.player.onPlatform = platform.moving ? platform : null;
        } else if (prevY - BALL_RADIUS >= platform.y + platform.height) {
          state.player.y = platform.y + platform.height + BALL_RADIUS;
          state.player.vy = 0;
        } else {
          state.player.y += dy > 0 ? overlapY : -overlapY;
          state.player.vy = 0;
        }
      }
    }
  }
}

function checkHazards(level) {
  for (const hazard of level.hazards) {
    const inX = state.player.x + BALL_RADIUS > hazard.x &&
      state.player.x - BALL_RADIUS < hazard.x + hazard.width;
    const inY = state.player.y + BALL_RADIUS > hazard.y &&
      state.player.y - BALL_RADIUS < hazard.y + hazard.height;
    if (inX && inY) {
      playSfx("fail");
      setLevel(state.levelIndex);
      return;
    }
  }
}

function checkPortal(level) {
  const portal = level.portal;
  const inX = state.player.x + BALL_RADIUS > portal.x &&
    state.player.x - BALL_RADIUS < portal.x + portal.width;
  const inY = state.player.y + BALL_RADIUS > portal.y &&
    state.player.y - BALL_RADIUS < portal.y + portal.height;
  if (inX && inY) {
    playSfx("portal");
    if (state.levelIndex + 1 < LEVEL_COUNT) {
      setLevel(state.levelIndex + 1);
    } else {
      state.gameWon = true;
      showOverlay("You Win!", "Boll zipped through all 10 procedurally generated levels.");
    }
  }
}

function updateTextureState(dt) {
  const speed = Math.abs(state.player.vx);
  if (speed > SHAKE_SPEED) {
    state.player.textureState = "shook";
    state.player.wasShook = true;
    state.player.dizzyTimer = 0;
  } else if (state.player.wasShook && speed < CALM_SPEED) {
    if (state.player.textureState !== "dizzy") {
      state.player.textureState = "dizzy";
      state.player.dizzyTimer = 2;
    }
  }

  if (state.player.textureState === "dizzy") {
    state.player.dizzyTimer -= dt;
    if (state.player.dizzyTimer <= 0) {
      state.player.textureState = "normal";
      state.player.wasShook = false;
    }
  }

  if (state.player.textureState === "shook" && speed < CALM_SPEED) {
    state.player.textureState = "dizzy";
    state.player.dizzyTimer = 2;
  }
}

function update(dt, time) {
  const level = state.levels[state.levelIndex];
  updatePlatforms(level, time);

  if (state.player.onPlatform) {
    state.player.x += state.player.onPlatform.deltaX;
    state.player.y += state.player.onPlatform.deltaY;
  }

  handleInput(dt);

  const prevX = state.player.x;
  const prevY = state.player.y;

  state.player.vy += GRAVITY * dt;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;

  resolveCollisions(level, prevX, prevY);
  checkHazards(level);
  checkPortal(level);

  if (state.player.y > WORLD_HEIGHT + 200) {
    playSfx("fail");
    setLevel(state.levelIndex);
  }

  const rotationSpeed = state.player.vx / BALL_RADIUS;
  state.player.angle += rotationSpeed * dt;

  updateTextureState(dt);

  state.camera.x = clamp(state.player.x - canvas.width * 0.35, 0, level.length - canvas.width);
  state.camera.y = clamp(state.player.y - canvas.height * 0.55, 0, WORLD_HEIGHT - canvas.height);
}

function drawBackground() {
  if (!state.background.complete) return;
  const parallaxX = state.camera.x * 0.2;
  const img = state.background;
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const offsetX = -parallaxX % drawWidth;

  for (let x = offsetX - drawWidth; x < canvas.width + drawWidth; x += drawWidth) {
    ctx.drawImage(img, x, 0, drawWidth, drawHeight);
  }
}

function drawLevel(level) {
  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);

  ctx.fillStyle = "#1d2a47";
  ctx.fillRect(0, WORLD_HEIGHT - 60, level.length, 100);

  ctx.fillStyle = "#4d6b8f";
  level.platforms.forEach((platform) => {
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  });

  ctx.fillStyle = "#d44a4a";
  level.hazards.forEach((hazard) => {
    ctx.beginPath();
    ctx.moveTo(hazard.x, hazard.y + hazard.height);
    ctx.lineTo(hazard.x + hazard.width / 2, hazard.y);
    ctx.lineTo(hazard.x + hazard.width, hazard.y + hazard.height);
    ctx.closePath();
    ctx.fill();
  });

  const portal = level.portal;
  ctx.fillStyle = "rgba(120, 255, 250, 0.45)";
  ctx.fillRect(portal.x, portal.y, portal.width, portal.height);
  ctx.strokeStyle = "rgba(120, 255, 250, 0.95)";
  ctx.lineWidth = 4;
  ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);

  ctx.restore();
}

function drawPlayer() {
  const texture = ballTextures[state.player.textureState] || ballTextures.normal;

  ctx.save();
  ctx.translate(state.player.x - state.camera.x, state.player.y - state.camera.y);
  ctx.rotate(state.player.angle);
  if (texture.complete && texture.naturalWidth > 0) {
    ctx.drawImage(texture, -BALL_RADIUS, -BALL_RADIUS, BALL_RADIUS * 2, BALL_RADIUS * 2);
  } else {
    ctx.fillStyle = "#d7d7d7";
    ctx.beginPath();
    ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawLevel(state.levels[state.levelIndex]);
  drawPlayer();
}

function showOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.add("active");
  state.paused = true;
}

function hideOverlay() {
  overlay.classList.remove("active");
  state.paused = false;
}

function togglePause() {
  if (state.gameWon) return;
  if (state.paused) {
    hideOverlay();
  } else {
    showOverlay("Paused", "Press Esc to resume.");
  }
}

function updateSkinUI() {
  const total = state.skins.length;
  const current = state.selectedSkin;
  const prev = (current - 1 + total) % total;
  const next = (current + 1) % total;

  const skin = state.skins[current];
  skinName.textContent = skin.name;
  skinDesc.textContent = skin.description;

  setPreviewState(skinPreview, skinBadge, current, true);
  setPreviewState(skinPrevPreview, skinPrevPreview.querySelector(".skin-preview__badge"), prev, false);
  setPreviewState(skinNextPreview, skinNextPreview.querySelector(".skin-preview__badge"), next, false);
}

function setPreviewState(element, badge, index, focused) {
  const skin = state.skins[index];
  const isUnlocked = state.unlockedLevels >= skin.unlockLevel;
  element.classList.remove("locked", "unlocked", "focused");
  element.classList.add(isUnlocked ? "unlocked" : "locked");
  if (focused) {
    element.classList.add("focused");
  }
  badge.innerHTML = isUnlocked
    ? '<i class="fa-solid fa-unlock"></i>'
    : '<i class="fa-solid fa-lock"></i>';
}

function cycleSkin(direction) {
  const total = state.skins.length;
  state.selectedSkin = (state.selectedSkin + direction + total) % total;
  updateSkinUI();
}

function loop(timestamp) {
  const dt = clamp((timestamp - state.lastTime) / 1000, 0, 0.033);
  state.lastTime = timestamp;

  if (!state.paused) {
    update(dt, timestamp / 1000);
  }

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", " ", "a", "d", "escape"].includes(key)) {
    event.preventDefault();
  }
  if (key === "escape") {
    togglePause();
    return;
  }
  if (key === " ") {
    jump();
  }
  state.keys.add(key);
  initAudio();
  ensureAudioContext();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  state.keys.delete(key);
});

resumeButton.addEventListener("click", () => {
  hideOverlay();
  initAudio();
  ensureAudioContext();
});

restartButton.addEventListener("click", () => {
  setLevel(state.levelIndex);
  hideOverlay();
});

musicSlider.addEventListener("input", () => {
  const volume = Number(musicSlider.value);
  musicPlaylist.forEach((track) => {
    track.volume = volume;
  });
});

sfxSlider.addEventListener("input", () => {
  if (audioContext) {
    audioContext.resume();
  }
});

skinPrev.addEventListener("click", () => cycleSkin(-1));
skinNext.addEventListener("click", () => cycleSkin(1));

initLevels();
updateSkinUI();
showOverlay("Paused", "Press Esc or Resume to begin rolling.");
requestAnimationFrame(loop);
