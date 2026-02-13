const frogs = [
  { id: "irina", name: "Жаба Ирина", foodId: "prosciutto" },
  { id: "katya", name: "Жаба Катя", foodId: "blini" },
  { id: "dasha", name: "Жаба Даша", foodId: "pelmeni" },
  { id: "sasha", name: "Жаба Саша", foodId: "pasta" },
  { id: "veronika", name: "Жаба Вероника", foodId: "wine" },
  { id: "olya", name: "Жаба Оля", foodId: "posikunchiki" }
];

const foods = [
  { id: "prosciutto", label: "Прошутто", emoji: "🥓" },
  { id: "wine", label: "Винишко", emoji: "🍷" },
  { id: "pelmeni", label: "Пельмешки", emoji: "🥟" },
  { id: "posikunchiki", label: "Посикунчики", emoji: "🥟" },
  { id: "pasta", label: "Паста", emoji: "🍝" },
  { id: "blini", label: "Блины", emoji: "🥞" }
];

const GAME_SECONDS = 60;
const MUSIC_STORAGE_KEY = "frog_game_music_on";
const MUSIC_VOLUME_STORAGE_KEY = "frog_game_music_volume";

const boardEl = document.getElementById("board");
const centerPanelEl = document.getElementById("center-panel");
const fedCountEl = document.getElementById("fed-count");
const mistakesEl = document.getElementById("mistakes");
const timeEl = document.getElementById("time");
const messageEl = document.getElementById("message");
const liveAnnouncerEl = document.getElementById("live-announcer");
const foodEmojiEl = document.getElementById("food-emoji");
const foodLabelEl = document.getElementById("food-label");
const nextFoodBtn = document.getElementById("next-food-btn");
const newGameBtn = document.getElementById("new-game-btn");

const musicToggleEl = document.getElementById("music-toggle");
const musicVolumeEl = document.getElementById("music-volume");
const bgMusicEl = document.getElementById("bg-music");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const playAgainBtn = document.getElementById("play-again-btn");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let running = false;
let timeLeft = GAME_SECONDS;
let mistakes = 0;
let timerId = null;
let fedSet = new Set();
let currentFoodId = null;
let isAnimating = false;
let isRevealing = false;
let messageTimerId = null;
let musicState = "off"; // off | on | error

function announce(text) {
  if (!liveAnnouncerEl) {
    return;
  }
  liveAnnouncerEl.textContent = text;
}

function getFoodById(foodId) {
  return foods.find((food) => food.id === foodId) || null;
}

function getAvailableFoodIds() {
  return frogs
    .filter((frog) => !fedSet.has(frog.id))
    .map((frog) => frog.foodId);
}

function randomAvailableFoodId() {
  const availableFoodIds = getAvailableFoodIds();
  if (availableFoodIds.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * availableFoodIds.length);
  return availableFoodIds[index];
}

function updateHud() {
  fedCountEl.textContent = String(fedSet.size);
  mistakesEl.textContent = String(mistakes);
  timeEl.textContent = String(timeLeft);
}

function setMessage(text, tone = "normal") {
  messageEl.textContent = text;
  messageEl.classList.toggle("is-error", tone === "error");

  if (messageTimerId) {
    clearTimeout(messageTimerId);
    messageTimerId = null;
  }

  if (tone === "error") {
    messageTimerId = setTimeout(() => {
      messageEl.classList.remove("is-error");
      messageTimerId = null;
    }, 900);
  }
}

function setCenterFood(foodId) {
  currentFoodId = foodId;
  const food = getFoodById(foodId);

  if (!food) {
    foodEmojiEl.textContent = "❔";
    foodLabelEl.textContent = "нет еды";
    return;
  }

  foodEmojiEl.textContent = food.emoji;
  foodLabelEl.textContent = food.label;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function revealFood(foodId) {
  if (!foodId) {
    setCenterFood(null);
    return;
  }

  const food = getFoodById(foodId);
  if (!food) {
    return;
  }

  isRevealing = true;
  nextFoodBtn.disabled = true;

  if (reducedMotion) {
    setCenterFood(foodId);
    centerPanelEl.classList.add("reveal-done");
    nextFoodBtn.disabled = false;
    isRevealing = false;
    return;
  }

  centerPanelEl.classList.remove("reveal-done", "lid-fly");
  centerPanelEl.classList.add("lid-shake");
  setCenterFood(null);

  await wait(260);
  centerPanelEl.classList.remove("lid-shake");
  centerPanelEl.classList.add("lid-fly");
  setCenterFood(foodId);

  await wait(280);
  centerPanelEl.classList.add("reveal-done");
  nextFoodBtn.disabled = false;
  isRevealing = false;
}

function rollFood() {
  if (!running || isAnimating || isRevealing) {
    return;
  }

  revealFood(randomAvailableFoodId());
  setMessage("Поднос открыт. Теперь нажми на жабу.");
}

function markFrogFed(frogId) {
  const frogEl = document.querySelector(`[data-frog-id="${frogId}"]`);
  if (!frogEl) {
    return;
  }

  frogEl.classList.add("fed");
  const stateEl = frogEl.querySelector(".frog-state");
  if (stateEl) {
    stateEl.textContent = "Сытая жаба";
  }
}

function showWrongBadge(frogId) {
  const frogEl = document.querySelector(`[data-frog-id="${frogId}"]`);
  if (!frogEl) {
    return;
  }

  frogEl.classList.remove("is-wrong");
  const existing = frogEl.querySelector(".wrong-badge");
  if (existing) {
    existing.remove();
  }

  const badge = document.createElement("span");
  badge.className = "wrong-badge";
  badge.textContent = "Буэээ";
  frogEl.appendChild(badge);

  requestAnimationFrame(() => {
    frogEl.classList.add("is-wrong");
  });

  setTimeout(() => {
    frogEl.classList.remove("is-wrong");
    badge.remove();
  }, 900);
}

function showYumBadge(frogId) {
  const frogEl = document.querySelector(`[data-frog-id="${frogId}"]`);
  if (!frogEl) {
    return;
  }

  const existing = frogEl.querySelector(".yum-badge");
  if (existing) {
    existing.remove();
  }

  const badge = document.createElement("span");
  badge.className = "yum-badge";
  badge.textContent = "Омномном";
  frogEl.appendChild(badge);

  setTimeout(() => {
    badge.remove();
  }, 900);
}

function getElementCenterInBoard(element) {
  const boardRect = boardEl.getBoundingClientRect();
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left - boardRect.left + rect.width / 2,
    y: rect.top - boardRect.top + rect.height / 2
  };
}

function animateFoodFlight(food, frogId) {
  if (reducedMotion) {
    return Promise.resolve();
  }

  const frogEl = document.querySelector(`[data-frog-id="${frogId}"]`);
  if (!frogEl || !food) {
    return Promise.resolve();
  }

  const start = getElementCenterInBoard(centerPanelEl);
  const end = getElementCenterInBoard(frogEl);

  const flyingFoodEl = document.createElement("div");
  flyingFoodEl.className = "flying-food";
  flyingFoodEl.textContent = food.emoji;
  flyingFoodEl.style.left = `${start.x}px`;
  flyingFoodEl.style.top = `${start.y}px`;
  boardEl.appendChild(flyingFoodEl);

  return new Promise((resolve) => {
    const cleanup = () => {
      flyingFoodEl.removeEventListener("transitionend", onDone);
      flyingFoodEl.remove();
      resolve();
    };

    const onDone = () => cleanup();
    flyingFoodEl.addEventListener("transitionend", onDone, { once: true });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flyingFoodEl.style.left = `${end.x}px`;
        flyingFoodEl.style.top = `${end.y}px`;
      });
    });

    setTimeout(cleanup, 550);
  });
}

function finishGame(win) {
  running = false;
  isAnimating = false;
  isRevealing = false;
  clearInterval(timerId);
  timerId = null;
  overlay.hidden = false;
  startBtn.hidden = true;
  playAgainBtn.hidden = false;

  if (win) {
    overlayTitle.textContent = "Победа!";
    overlayText.textContent = `Все жабы накормлены. Ошибок: ${mistakes}.`;
    announce("Победа. Все жабы накормлены.");
  } else {
    overlayTitle.textContent = "Время вышло";
    overlayText.textContent = `Накормлено: ${fedSet.size}/6. Ошибок: ${mistakes}.`;
    announce("Время вышло.");
  }
}

async function handleFrogClick(frogId) {
  if (!running || isAnimating || isRevealing) {
    return;
  }

  if (!currentFoodId) {
    setMessage("Сначала открой поднос.");
    return;
  }

  if (fedSet.has(frogId)) {
    setMessage("Эта жаба уже сытая.");
    return;
  }

  const frog = frogs.find((item) => item.id === frogId);
  if (!frog) {
    return;
  }

  const foodIdForThrow = currentFoodId;
  const foodForThrow = getFoodById(foodIdForThrow);
  if (!foodForThrow) {
    return;
  }

  isAnimating = true;
  nextFoodBtn.disabled = true;
  setMessage(`${foodForThrow.label} летит к ${frog.name}...`);
  await animateFoodFlight(foodForThrow, frogId);
  isAnimating = false;
  nextFoodBtn.disabled = false;

  if (!running) {
    return;
  }

  if (frog.foodId === foodIdForThrow) {
    fedSet.add(frogId);
    markFrogFed(frogId);
    showYumBadge(frogId);
    setMessage(`${frog.name}: «Омномном!»`);
    announce(`${frog.name} сыта.`);

    if (fedSet.size === frogs.length) {
      updateHud();
      finishGame(true);
      return;
    }
  } else {
    mistakes += 1;
    showWrongBadge(frogId);
    setMessage("Эта жаба сказала вам: «Буэээ»", "error");
    announce("Ошибка: эта жаба не ест эту еду.");
  }

  updateHud();
  await revealFood(randomAvailableFoodId());
}

function resetFrogs() {
  document.querySelectorAll(".frog").forEach((frogEl) => {
    frogEl.classList.remove("fed", "is-wrong");
    frogEl.querySelectorAll(".wrong-badge, .yum-badge").forEach((badge) => badge.remove());

    const stateEl = frogEl.querySelector(".frog-state");
    if (stateEl) {
      stateEl.textContent = "Голодная жаба";
    }
  });
}

function startGame() {
  running = true;
  isAnimating = false;
  isRevealing = false;
  timeLeft = GAME_SECONDS;
  mistakes = 0;
  fedSet = new Set();

  resetFrogs();
  updateHud();
  setCenterFood(null);
  setMessage("Накорми жабу.");
  overlay.hidden = true;
  startBtn.hidden = true;
  playAgainBtn.hidden = true;
  nextFoodBtn.disabled = false;

  // Browsers block autoplay without user gesture, so start music on Start click.
  if (musicState !== "on") {
    setMusicState("on");
  }

  revealFood("wine");

  clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft -= 1;
    updateHud();

    if (timeLeft <= 0) {
      finishGame(false);
    }
  }, 1000);
}

function prepareStartOverlay() {
  running = false;
  overlay.hidden = false;
  overlayTitle.textContent = "Готова кормить жаб?";
  overlayText.textContent = "Накорми всех жаб правильной едой до конца таймера.";
  startBtn.hidden = false;
  playAgainBtn.hidden = true;
}

function updateMusicButton() {
  if (musicState === "on") {
    musicToggleEl.textContent = "Музыка: вкл";
  } else if (musicState === "error") {
    musicToggleEl.textContent = "Музыка: ошибка";
  } else {
    musicToggleEl.textContent = "Музыка: выкл";
  }
}

async function setMusicState(nextState) {
  if (!bgMusicEl) {
    return;
  }

  if (nextState === "off") {
    musicState = "off";
    bgMusicEl.pause();
    localStorage.setItem(MUSIC_STORAGE_KEY, "off");
    updateMusicButton();
    return;
  }

  try {
    bgMusicEl.volume = Number(musicVolumeEl.value) / 100;
    await bgMusicEl.play();
    musicState = "on";
    localStorage.setItem(MUSIC_STORAGE_KEY, "on");
  } catch (_error) {
    musicState = "error";
    localStorage.setItem(MUSIC_STORAGE_KEY, "error");
    setMessage("Не удалось включить музыку. Проверь файл audio/bg.mp3.");
    announce("Ошибка загрузки музыки.");
  }

  updateMusicButton();
}

function toggleMusic() {
  if (musicState === "on") {
    setMusicState("off");
  } else {
    setMusicState("on");
  }
}

function updateVolume() {
  if (!bgMusicEl || !musicVolumeEl) {
    return;
  }

  const volume = Number(musicVolumeEl.value) / 100;
  bgMusicEl.volume = volume;
  localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(musicVolumeEl.value));
}

function ensureElements() {
  return Boolean(
    boardEl &&
      centerPanelEl &&
      fedCountEl &&
      mistakesEl &&
      timeEl &&
      messageEl &&
      liveAnnouncerEl &&
      foodEmojiEl &&
      foodLabelEl &&
      nextFoodBtn &&
      newGameBtn &&
      musicToggleEl &&
      musicVolumeEl &&
      bgMusicEl &&
      overlay &&
      overlayTitle &&
      overlayText &&
      startBtn &&
      playAgainBtn
  );
}

function initEvents() {
  document.querySelectorAll(".frog").forEach((frogEl) => {
    const frogId = frogEl.dataset.frogId;
    frogEl.addEventListener("click", () => {
      handleFrogClick(frogId);
    });
  });

  nextFoodBtn.addEventListener("click", rollFood);
  startBtn.addEventListener("click", startGame);
  playAgainBtn.addEventListener("click", startGame);
  newGameBtn.addEventListener("click", () => {
    clearInterval(timerId);
    resetFrogs();
    fedSet = new Set();
    mistakes = 0;
    timeLeft = GAME_SECONDS;
    updateHud();
    setCenterFood(null);
    setMessage("Накорми жабу.");
    prepareStartOverlay();
  });

  musicToggleEl.addEventListener("click", toggleMusic);
  musicVolumeEl.addEventListener("input", updateVolume);
}

function initMusicState() {
  const savedVolume = localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
  if (savedVolume && musicVolumeEl) {
    musicVolumeEl.value = savedVolume;
  }
  updateVolume();

  const savedState = localStorage.getItem(MUSIC_STORAGE_KEY);
  if (savedState === "on") {
    musicState = "on";
  } else if (savedState === "error") {
    musicState = "error";
  } else {
    // Default intent: music enabled; actual playback begins on first user click.
    musicState = "on";
  }

  updateMusicButton();
}

function initGame() {
  if (!ensureElements()) {
    console.error("Не найдены обязательные элементы игры в HTML.");
    return;
  }

  initEvents();
  initMusicState();
  resetFrogs();
  updateHud();
  setCenterFood(null);
  setMessage("Накорми жабу.");
  prepareStartOverlay();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}
