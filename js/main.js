(function () {
  const STORAGE_KEY = "util-rate-calculator:months:v1";

  const scoreDisplay = document.getElementById("scoreDisplay");
  const panel = document.getElementById("app");
  if (!scoreDisplay || !panel) return;

  const inputs = Array.from(
    panel.querySelectorAll('input[type="number"][data-month]')
  ).sort(
    (a, b) => Number(a.dataset.month) - Number(b.dataset.month)
  );

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length !== 12) return;
      inputs.forEach((el, i) => {
        const v = arr[i];
        if (typeof v === "string" || typeof v === "number") {
          el.value = String(v);
        }
      });
    } catch {
      /* ignore corrupt or missing storage */
    }
  }

  function saveState() {
    const payload = inputs.map((el) => el.value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota, private mode, or disabled storage */
    }
  }

  function parseMonthValue(el) {
    const raw = el.value.trim();
    if (raw === "") return 0;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  }

  function formatScore(mean) {
    return `${mean.toFixed(1)}%`;
  }

  const scoreBands = ["score__value--high", "score__value--mid", "score__value--low"];

  function setScoreBand(mean) {
    scoreDisplay.classList.remove(...scoreBands);
    if (mean >= 86) scoreDisplay.classList.add("score__value--high");
    else if (mean >= 60) scoreDisplay.classList.add("score__value--mid");
    else scoreDisplay.classList.add("score__value--low");
  }

  function updateScore() {
    let sum = 0;
    for (const el of inputs) {
      sum += parseMonthValue(el);
    }
    const mean = sum / 12;
    scoreDisplay.textContent = formatScore(mean);
    setScoreBand(mean);
  }

  function onFieldUpdate() {
    updateScore();
    saveState();
  }

  loadState();

  for (const el of inputs) {
    el.addEventListener("input", onFieldUpdate);
    el.addEventListener("change", onFieldUpdate);
  }

  updateScore();
})();
