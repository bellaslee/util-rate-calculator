(function () {
  const STORAGE_KEY = "util-rate-calculator:months:v1";
  const PTO_DAYS_STORAGE_KEY = "util-rate-calculator:ptoDays:v1";
  const PTO_ENTRIES_LEGACY_KEY = "util-rate-calculator:ptoEntries:v1";
  const WORK_HOURS_YEAR = 2000;
  const HOURS_PER_PTO_DAY = 8;
  /** Hours below this cap drive the utilization adjustment (exclusive upper bound on scale). */
  const MAX_IMPACTING_PTO_HOURS = 2000 - 1e-6;

  const scoreDisplay = document.getElementById("scoreDisplay");
  const panel = document.getElementById("app");
  if (!scoreDisplay || !panel) return;

  const inputs = Array.from(
    panel.querySelectorAll('input[type="number"][data-month]')
  ).sort(
    (a, b) => Number(a.dataset.month) - Number(b.dataset.month)
  );

  const ptoDaysInput = document.getElementById("ptoDays");
  const ptoBenchDaysInput = document.getElementById("ptoBenchDays");
  const ptoNotesInput = document.getElementById("ptoNotes");
  const ptoTotalHoursEl = document.getElementById("ptoTotalHours");
  const ptoImpactHoursEl = document.getElementById("ptoImpactHours");
  const ptoPctYearEl = document.getElementById("ptoPctYear");
  const ptoDeltaUtilEl = document.getElementById("ptoDeltaUtil");

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

  function parsePtoDaysFromString(raw) {
    const t = String(raw).trim();
    if (t === "") return 0;
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  }

  function getPtoTotalDays() {
    if (!(ptoDaysInput instanceof HTMLInputElement)) return 0;
    return parsePtoDaysFromString(ptoDaysInput.value);
  }

  function getPtoBenchDays() {
    if (!(ptoBenchDaysInput instanceof HTMLInputElement)) return 0;
    return parsePtoDaysFromString(ptoBenchDaysInput.value);
  }

  /** Bench days capped so they never exceed total PTO days. */
  function effectiveBenchDays(total, bench) {
    return Math.min(Math.max(0, bench), Math.max(0, total));
  }

  function impactingPtoDays() {
    const total = getPtoTotalDays();
    const bench = effectiveBenchDays(total, getPtoBenchDays());
    return Math.max(0, total - bench);
  }

  const MAX_PTO_NOTES_CHARS = 5000;

  function getPtoNotes() {
    if (!(ptoNotesInput instanceof HTMLTextAreaElement)) return "";
    return ptoNotesInput.value.slice(0, MAX_PTO_NOTES_CHARS);
  }

  function setPtoInputs(total, bench) {
    if (ptoDaysInput instanceof HTMLInputElement) {
      ptoDaysInput.value = total === 0 ? "" : String(total);
    }
    if (ptoBenchDaysInput instanceof HTMLInputElement) {
      ptoBenchDaysInput.value = bench === 0 ? "" : String(bench);
    }
  }

  function setPtoNotes(value) {
    if (!(ptoNotesInput instanceof HTMLTextAreaElement)) return;
    const s = typeof value === "string" ? value : "";
    ptoNotesInput.value = s.slice(0, MAX_PTO_NOTES_CHARS);
  }

  function loadPtoDaysState() {
    try {
      const raw = localStorage.getItem(PTO_DAYS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0) {
          setPtoInputs(parsed, 0);
          setPtoNotes("");
          savePtoDaysState();
          return;
        }
        if (parsed && typeof parsed === "object") {
          const t = Number(parsed.total);
          const b = Number(parsed.bench);
          const total = Number.isFinite(t) ? Math.max(0, t) : 0;
          const bench = Number.isFinite(b) ? Math.max(0, b) : 0;
          setPtoInputs(total, bench);
          setPtoNotes(typeof parsed.notes === "string" ? parsed.notes : "");
          return;
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const legacy = localStorage.getItem(PTO_ENTRIES_LEGACY_KEY);
      if (!legacy) return;
      const arr = JSON.parse(legacy);
      if (!Array.isArray(arr)) return;
      let sum = 0;
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const d = Number(item.days);
        if (Number.isFinite(d)) sum += Math.max(0, d);
      }
      setPtoInputs(sum, 0);
      setPtoNotes("");
      savePtoDaysState();
    } catch {
      /* ignore */
    }
  }

  function savePtoDaysState() {
    const total = getPtoTotalDays();
    const bench = getPtoBenchDays();
    const notes = getPtoNotes();
    try {
      localStorage.setItem(
        PTO_DAYS_STORAGE_KEY,
        JSON.stringify({ total, bench, notes })
      );
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

  function formatHours(n) {
    if (!Number.isFinite(n)) return "0";
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  const scoreBands = ["score__value--high", "score__value--mid", "score__value--low"];

  function setScoreBand(mean) {
    scoreDisplay.classList.remove(...scoreBands);
    if (mean >= 86) scoreDisplay.classList.add("score__value--high");
    else if (mean >= 60) scoreDisplay.classList.add("score__value--mid");
    else scoreDisplay.classList.add("score__value--low");
  }

  function ptoTotalHours() {
    return HOURS_PER_PTO_DAY * getPtoTotalDays();
  }

  function ptoImpactingHours() {
    const raw = HOURS_PER_PTO_DAY * impactingPtoDays();
    return Math.min(Math.max(0, raw), MAX_IMPACTING_PTO_HOURS);
  }

  /** Monthly mean scaled by impacting PTO hours vs. 2,000 h baseline. */
  function utilizationWithPto(monthlyMeanPct) {
    const h = ptoImpactingHours();
    return (
      monthlyMeanPct * (WORK_HOURS_YEAR - h) / WORK_HOURS_YEAR
    );
  }

  function updatePtoSummary(monthlyMeanPct, displayedPct) {
    if (!ptoTotalHoursEl || !ptoImpactHoursEl || !ptoPctYearEl || !ptoDeltaUtilEl) {
      return;
    }

    const totalHours = ptoTotalHours();
    const impactingHours = ptoImpactingHours();
    const pctOfYear = (impactingHours / WORK_HOURS_YEAR) * 100;
    const deltaPct = displayedPct - monthlyMeanPct;

    ptoTotalHoursEl.textContent = formatHours(totalHours);
    ptoImpactHoursEl.textContent = formatHours(impactingHours);
    ptoPctYearEl.textContent = `${pctOfYear.toFixed(1)}%`;
    ptoDeltaUtilEl.textContent = `${deltaPct.toFixed(1)} pts`;
  }

  function readBaselinePct() {
    let sum = 0;
    for (const el of inputs) {
      sum += parseMonthValue(el);
    }
    return sum / 12;
  }

  function updateScore() {
    const monthlyMean = readBaselinePct();
    const displayed = utilizationWithPto(monthlyMean);
    scoreDisplay.textContent = formatScore(displayed);
    setScoreBand(displayed);
    updatePtoSummary(monthlyMean, displayed);
  }

  function onFieldUpdate() {
    updateScore();
    saveState();
  }

  function onPtoInputsUpdate() {
    savePtoDaysState();
    updateScore();
  }

  function onPtoNotesUpdate() {
    savePtoDaysState();
  }

  loadState();
  loadPtoDaysState();

  if (ptoDaysInput instanceof HTMLInputElement) {
    ptoDaysInput.addEventListener("input", onPtoInputsUpdate);
    ptoDaysInput.addEventListener("change", onPtoInputsUpdate);
  }
  if (ptoBenchDaysInput instanceof HTMLInputElement) {
    ptoBenchDaysInput.addEventListener("input", onPtoInputsUpdate);
    ptoBenchDaysInput.addEventListener("change", onPtoInputsUpdate);
  }
  if (ptoNotesInput instanceof HTMLTextAreaElement) {
    ptoNotesInput.addEventListener("input", onPtoNotesUpdate);
    ptoNotesInput.addEventListener("change", onPtoNotesUpdate);
  }

  for (const el of inputs) {
    el.addEventListener("input", onFieldUpdate);
    el.addEventListener("change", onFieldUpdate);
  }

  updateScore();
})();
