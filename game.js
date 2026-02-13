const frogs = [
  { id: "irina", name: "Жаба Ирина", foodId: "shashlik" },
  { id: "katya", name: "Жаба Катя", foodId: "blini" },
  { id: "dasha", name: "Жаба Даша", foodId: "pelmeni" },
  { id: "sasha", name: "Жаба Саша", foodId: "pasta" },
  { id: "veronika", name: "Жаба Вероника", foodId: "wine" },
  { id: "olya", name: "Жаба Оля", foodId: "posikunchiki" }
];

const foods = [
  { id: "shashlik", label: "Шашлык", emoji: "🍖" },
  { id: "wine", label: "Винишко", emoji: "🍷" },
  { id: "pelmeni", label: "Пельмешки", emoji: "🥟" },
  { id: "posikunchiki", label: "Посикунчики", emoji: "🥟" },
  { id: "pasta", label: "Паста", emoji: "🍝" },
  { id: "blini", label: "Блины", emoji: "🥞" }
];

const GAME_SECONDS = 60;

const ringEl = document.getElementById("ring");
const centerBoxEl = document.getElementById("center-box");
const fedCountEl = document.getElementById("fed-count");
const mistakesEl = document.getElementById("mistakes");
const timeEl = document.getElementById("time");
const messageEl = document.getElementById("message");
const foodEmojiEl = document.getElementById("food-emoji");
const foodLabelEl = document.getElementById("food-label");
const nextFoodBtn = document.getElementById("next-food-btn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

let running = false;
let timeLeft = GAME_SECONDS;
let mistakes = 0;
let timerId = null;
let fedSet = new Set();
let currentFoodId = null;
let isAnimating = false;
let isRevealing = false;

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

function setCenterFood(foodId) {
  currentFoodId = foodId;
  const food = foods.find((item) => item.id === foodId);

  if (!food) {
    foodEmojiEl.textContent = "❔";
    foodLabelEl.textContent = "Нет еды";
    return;
  }

  foodEmojiEl.textContent = food.emoji;
  foodLabelEl.textContent = food.label;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function revealFood(foodId) {
  if (!foodId) {
    setCenterFood(null);
    return;
  }

  const food = foods.find((item) => item.id === foodId);
  if (!food) {
    return;
  }

  isRevealing = true;
  nextFoodBtn.disabled = true;
  centerBoxEl.classList.remove("reveal-done", "lid-fly");
  centerBoxEl.classList.add("lid-shake");
  setCenterFood(null);

  await wait(430);
  centerBoxEl.classList.remove("lid-shake");
  centerBoxEl.classList.add("lid-fly");
  setCenterFood(foodId);

  await wait(510);
  centerBoxEl.classList.add("reveal-done");
  nextFoodBtn.disabled = false;
  isRevealing = false;
}

function rollFood() {
  if (!running || isAnimating || isRevealing) {
    return;
  }

  revealFood(randomAvailableFoodId());
  messageEl.textContent = "Поднос открылся. Накорми жабу.";
}

function markFrogFed(frogId) {
  const frogEl = document.querySelector(`[data-frog-id="${frogId}"]`);
  if (!frogEl) {
    return;
  }

  frogEl.classList.add("fed");
  const stateEl = frogEl.querySelector(".frog-state");
  if (stateEl) {
    stateEl.textContent = "Сытая";
  }
}

function getElementCenterInRing(element) {
  const ringRect = ringEl.getBoundingClientRect();
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left - ringRect.left + rect.width / 2,
    y: rect.top - ringRect.top + rect.height / 2
  };
}

function animateFoodFlight(food, frogId) {
  const frogEl = document.querySelector(`[data-frog-id="${frogId}"]`);
  if (!frogEl || !food) {
    return Promise.resolve();
  }

  const start = getElementCenterInRing(centerBoxEl);
  const end = getElementCenterInRing(frogEl);

  const flyingFoodEl = document.createElement("div");
  flyingFoodEl.className = "flying-food";
  flyingFoodEl.textContent = food.emoji;
  flyingFoodEl.style.left = `${start.x}px`;
  flyingFoodEl.style.top = `${start.y}px`;
  ringEl.appendChild(flyingFoodEl);

  return new Promise((resolve) => {
    const cleanup = () => {
      flyingFoodEl.removeEventListener("transitionend", onDone);
      flyingFoodEl.remove();
      resolve();
    };

    const onDone = () => {
      cleanup();
    };

    flyingFoodEl.addEventListener("transitionend", onDone, { once: true });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flyingFoodEl.style.left = `${end.x}px`;
        flyingFoodEl.style.top = `${end.y}px`;
      });
    });

    setTimeout(cleanup, 700);
  });
}

function finishGame(win) {
  running = false;
  isAnimating = false;
  isRevealing = false;
  clearInterval(timerId);
  timerId = null;
  overlay.hidden = false;
  ringEl.style.pointerEvents = "none";
  startBtn.textContent = "Играть снова";

  if (win) {
    overlayTitle.textContent = "Победа!";
    overlayText.textContent = `Все жабы накормлены. Ошибок: ${mistakes}.`;
  } else {
    overlayTitle.textContent = "Время вышло";
    overlayText.textContent = `Накормлено: ${fedSet.size}/6. Ошибок: ${mistakes}.`;
  }
}

async function handleFrogClick(frogId) {
  if (!running || isAnimating || isRevealing) {
    return;
  }

  if (!currentFoodId) {
    messageEl.textContent = "Открой поднос и накорми жабу.";
    return;
  }

  if (fedSet.has(frogId)) {
    messageEl.textContent = "Эта жаба уже сытая.";
    return;
  }

  const frog = frogs.find((item) => item.id === frogId);
  if (!frog) {
    return;
  }

  const foodIdForThrow = currentFoodId;
  const foodForThrow = foods.find((item) => item.id === foodIdForThrow);
  if (!foodForThrow) {
    return;
  }

  isAnimating = true;
  nextFoodBtn.disabled = true;
  messageEl.textContent = `${foodForThrow.label} летит к ${frog.name}...`;
  await animateFoodFlight(foodForThrow, frogId);
  isAnimating = false;
  nextFoodBtn.disabled = false;

  if (!running) {
    return;
  }

  if (frog.foodId === foodIdForThrow) {
    fedSet.add(frogId);
    markFrogFed(frogId);
    messageEl.textContent = `${frog.name} получила ${foodForThrow.label}. Отлично.`;

    if (fedSet.size === frogs.length) {
      updateHud();
      finishGame(true);
      return;
    }
  } else {
    mistakes += 1;
    messageEl.textContent = `${frog.name} это не ест.`;
  }

  updateHud();
  await revealFood(randomAvailableFoodId());
}

function resetFrogs() {
  document.querySelectorAll(".frog").forEach((frogEl) => {
    frogEl.classList.remove("fed");
    const stateEl = frogEl.querySelector(".frog-state");
    if (stateEl) {
      stateEl.textContent = "Голодная";
    }
  });
}

function startGame() {
  running = true;
  isAnimating = false;
  timeLeft = GAME_SECONDS;
  mistakes = 0;
  fedSet = new Set();
  nextFoodBtn.disabled = false;

  resetFrogs();
  updateHud();
  setCenterFood(null);
  messageEl.textContent = "Накорми жабу.";
  overlay.hidden = true;
  ringEl.style.pointerEvents = "auto";
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

function ensureElements() {
  return Boolean(
    ringEl &&
      centerBoxEl &&
      fedCountEl &&
      mistakesEl &&
      timeEl &&
      messageEl &&
      foodEmojiEl &&
      foodLabelEl &&
      nextFoodBtn &&
      overlay &&
      overlayTitle &&
      overlayText &&
      startBtn
  );
}

function initGame() {
  if (!ensureElements()) {
    console.error("Не найдены обязательные элементы игры в HTML.");
    return;
  }

  document.querySelectorAll(".frog").forEach((frogEl) => {
    const frogId = frogEl.dataset.frogId;
    frogEl.addEventListener("click", () => {
      handleFrogClick(frogId);
    });
  });

  nextFoodBtn.addEventListener("click", rollFood);
  startBtn.addEventListener("click", startGame);

  ringEl.style.pointerEvents = "none";
  updateHud();
  setCenterFood(null);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}
