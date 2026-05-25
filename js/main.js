/* =========================================================
   POINT D'ENTREE (design v1.33)
========================================================= */

import { $ } from "./core/dom.js";
import { getState, save, emit, replaceState } from "./core/store.js";
import { SEASONS, SUBLINES } from "./core/constants.js";
import { clamp, pickRandom } from "./core/utils.js";
import { doUndo } from "./core/undo.js";

import { applyTheme } from "./ui/theme.js";
import { openModal, closeModal, closeAllModals, openPomoModal, bindModalsOutsideClose } from "./ui/panels.js";
import {
  setupRendering, renderEverything, renderMetaTimer, applyBelowListVisibility, setSubtitle, renderers,
} from "./ui/render.js";
import { syncFlowPanel, saveFlow } from "./ui/prefs.js";
import { status } from "./ui/status.js";
import { setScreen, bindNavigation, bindTopTabs, bindStatsTabs, syncTopTabs } from "./ui/navigation.js";

import { spinRoulette, degommeEtorion, completeTask, editTask, getTask } from "./features/tasks.js";
import { importFromInbox, saveInboxDraft } from "./features/inbox.js";
import { addNoteEntry, scheduleNotesSave, addTyphonse } from "./features/notes.js";
import { suggestKiffance, addKiffance, addKiffanceAsTask } from "./features/kiffance.js";
import { addHabit } from "./features/habits.js";
import { updateSetPatientCount, resetSetToday } from "./features/sets.js";
import { exportTodayText } from "./features/stats.js";
import { maybeShowTip } from "./features/tips.js";
import { maybeShowCelebration } from "./features/celebrations.js";
import { renderPomodoro, resetPhase, togglePomo, applyPomoSettings } from "./features/pomodoro.js";

let taskTimerLoop = null;
function startTaskTimerLoop() {
  if (taskTimerLoop) clearInterval(taskTimerLoop);
  taskTimerLoop = setInterval(renderMetaTimer, 500);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); status("Copie."); }
  catch (_) { status("Impossible de copier."); }
}

function resetDay() {
  const s = getState();
  s.tasks = [];
  s.baseline = { totalTasks: 0, totalEtorions: 0 };
  s.currentTaskId = null;
  s.currentTaskStart = null;
  s.stats.sessions += 1;
  s.stats.tasksCompleted = 0;
  s.stats.etorionsDone = 0;
  save();
  emit("*");
  status("Reset total. Terrain nettoye.");
}

function toggleBelowList() {
  getState().ui.showBelowList = !getState().ui.showBelowList;
  save();
  applyBelowListVisibility();
}

/* Met a jour les deux affichages du temps pomodoro (carte + reglages). */
function refreshPomoDisplays() {
  renderPomodoro(); // #pomoTime
  const settings = $("pomoTimeSettings");
  const live = $("pomoTime");
  if (settings && live) settings.textContent = live.textContent;
}

function bindUI() {
  /* ---- Theme / modes ---- */
  $("modeToggle")?.addEventListener("click", () => {
    getState().ui.mode = getState().ui.mode === "sombre" ? "clair" : "sombre";
    save(); emit("theme");
  });
  $("seasonCycle")?.addEventListener("click", () => {
    const ui = getState().ui;
    ui.season = SEASONS[(SEASONS.indexOf(ui.season) + 1) % SEASONS.length];
    save(); emit("theme");
  });
  $("seriousToggle")?.addEventListener("click", () => {
    getState().ui.serious = !getState().ui.serious;
    save(); emit("theme", "hub");
  });
  $("focusBtn")?.addEventListener("click", () => {
    getState().ui.focus = !getState().ui.focus;
    save(); emit("theme", "hub");
    applyBelowListVisibility();
  });

  /* ---- Actions centrales ---- */
  $("undoBtn")?.addEventListener("click", () => {
    status(doUndo() ? "Retour arriere." : "Rien a annuler.");
  });
  $("rouletteBtn")?.addEventListener("click", () => spinRoulette());
  $("bombBtn")?.addEventListener("click", degommeEtorion);
  $("doneTaskBtn")?.addEventListener("click", () => completeTask());
  $("editTaskBtn")?.addEventListener("click", () => {
    const id = getState().currentTaskId;
    const task = getTask(id);
    if (!task) return;
    const next = prompt("Editer la tache", task.title);
    if (next !== null) editTask(id, next);
  });
  $("taskInfoBtn")?.addEventListener("click", () => {
    const meta = $("taskMetaDetails");
    if (meta) meta.hidden = !meta.hidden;
  });
  $("belowListToggleBtn")?.addEventListener("click", toggleBelowList);
  $("btnHideBelow")?.addEventListener("click", () => {
    getState().ui.showBelowList = false;
    save(); applyBelowListVisibility();
  });

  /* ---- Liste : tri rapide + modal filtres ---- */
  $("sortCycleBtn")?.addEventListener("click", () => {
    const order = ["roulette", "ordre", "alpha", "cat"];
    const s = getState().settings;
    s.listSort = order[(order.indexOf(s.listSort) + 1) % order.length];
    save(); emit("tasks");
    status(`Tri : ${s.listSort}`);
  });
  $("filterBtn")?.addEventListener("click", () => {
    const s = getState().settings;
    if ($("viewFilter")) $("viewFilter").value = s.listView || "active";
    if ($("sortFilter")) $("sortFilter").value = s.listSort || "roulette";
    renderers.tasks(); // remplit #catFilter
    openModal("filterModal");
  });
  $("filterCloseBtn")?.addEventListener("click", () => closeModal("filterModal"));
  $("catFilter")?.addEventListener("change", (e) => {
    getState().settings.includedCats = Array.from(e.target.selectedOptions)
      .map((o) => o.value).filter((v) => v !== "Toutes");
    save(); emit("tasks", "hub");
  });
  $("viewFilter")?.addEventListener("change", (e) => {
    getState().settings.listView = e.target.value;
    getState().settings.quickToday = false;
    save(); emit("tasks");
  });
  $("sortFilter")?.addEventListener("change", (e) => {
    getState().settings.listSort = e.target.value;
    save(); emit("tasks");
  });

  /* ---- Inbox ---- */
  $("inboxAdd")?.addEventListener("click", () => {
    const text = $("inboxText")?.value || "";
    const count = importFromInbox(text);
    if (count > 0) {
      addNoteEntry(`Import de ${count} tache(s).`);
      const s = getState();
      if (!s.inbox.keepEditableAfterImport) {
        s.inbox.draft = "";
        if ($("inboxText")) $("inboxText").value = "";
      } else {
        s.inbox.draft = text;
      }
      save(); emit("inbox");
      status(`${count} tache(s) importee(s).`);
      setScreen("tasks");
    } else {
      status("Rien importe.");
    }
  });
  $("inboxClear")?.addEventListener("click", () => {
    getState().inbox.draft = "";
    if ($("inboxText")) $("inboxText").value = "";
    save(); status("Inbox effacee.");
  });
  $("inboxText")?.addEventListener("input", (e) => saveInboxDraft(e.target.value));
  $("inboxEditableToggle")?.addEventListener("click", () => {
    getState().inbox.keepEditableAfterImport = !getState().inbox.keepEditableAfterImport;
    save(); emit("inbox");
  });

  /* ---- Kiffance ---- */
  $("kiffAdd")?.addEventListener("click", () => {
    addKiffance($("kiffNew")?.value);
    if ($("kiffNew")) $("kiffNew").value = "";
  });
  $("kiffSuggest")?.addEventListener("click", suggestKiffance);
  $("kiffToTask")?.addEventListener("click", addKiffanceAsTask);

  /* ---- Typhonse / Habitudes / Sets ---- */
  $("btnAddTyphonse")?.addEventListener("click", () => {
    addTyphonse($("typhonseInput")?.value);
    if ($("typhonseInput")) $("typhonseInput").value = "";
  });
  $("habitAddBtn")?.addEventListener("click", () => {
    addHabit($("habitName")?.value, $("habitSlots")?.value);
    if ($("habitName")) $("habitName").value = "";
  });
  $("hospPatients")?.addEventListener("change", (e) => updateSetPatientCount("hospital", e.target.value));
  $("consPatients")?.addEventListener("change", (e) => updateSetPatientCount("consult", e.target.value));
  $("hospResetToday")?.addEventListener("click", () => resetSetToday("hospital"));
  $("consResetToday")?.addEventListener("click", () => resetSetToday("consult"));

  /* ---- Flow ---- */
  $("saveFlowBtn")?.addEventListener("click", saveFlow);
  $("testTipBtn")?.addEventListener("click", () => maybeShowTip(true));
  $("testCeleBtn")?.addEventListener("click", () => maybeShowCelebration(true));

  /* ---- Export ---- */
  $("exportBtn")?.addEventListener("click", () => {
    renderers.export();
    copyText(JSON.stringify(getState(), null, 2));
  });
  $("reportBtn")?.addEventListener("click", () => copyText(exportTodayText()));
  $("wipeBtn")?.addEventListener("click", () => {
    if (!confirm("RESET TOTAL — Effacer toutes les tâches et données ?\nCette action est irréversible.")) return;
    resetDay();
  });

  /* ---- Notes ---- */
  ["notesArea", "remindersArea"].forEach((id) =>
    $(id)?.addEventListener("input", scheduleNotesSave)
  );

  /* ---- Ajout rapide (écran tâches) ---- */
  function quickAdd() {
    const input = $("quickAddInput");
    const text = (input?.value || "").trim();
    if (!text) return;
    const count = importFromInbox(text);
    if (count > 0) {
      input.value = "";
      status("Tâche ajoutée.");
      addNoteEntry(`Ajout rapide : ${text}`);
    } else {
      status("Format : Nom de tâche - 2");
    }
  }
  $("quickAddBtn")?.addEventListener("click", quickAdd);
  $("quickAddInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") quickAdd();
  });

  /* ---- Entrée de note manuelle ---- */
  function addNoteManual() {
    const input = $("noteEntryInput");
    const text = (input?.value || "").trim();
    if (!text) return;
    addNoteEntry(text);
    input.value = "";
    status("Note ajoutée.");
  }
  $("noteEntryAddBtn")?.addEventListener("click", addNoteManual);
  $("noteEntryInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addNoteManual();
  });

  /* ---- Import JSON ---- */
  $("importBtn")?.addEventListener("click", () => {
    const raw = ($("exportOut")?.value || "").trim();
    if (!raw) { status("Colle un JSON dans la zone de texte."); return; }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.tasks) { status("JSON invalide — clé 'tasks' manquante."); return; }
      if (!confirm("Importer ce JSON ? L'état actuel sera remplacé.")) return;
      replaceState(parsed);
      status("Import réussi.");
    } catch (_) {
      status("JSON invalide — impossible à parser.");
    }
  });

  /* ---- Touches Entrée sur les champs de saisie ---- */
  $("kiffNew")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    addKiffance($("kiffNew").value);
    $("kiffNew").value = "";
  });
  $("typhonseInput")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    addTyphonse($("typhonseInput").value);
    $("typhonseInput").value = "";
  });
  $("habitName")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    addHabit($("habitName").value, $("habitSlots")?.value);
    $("habitName").value = "";
  });
  $("inboxText")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("inboxAdd")?.click();
  });

  /* ---- Pomodoro ---- */
  $("pomoTime")?.addEventListener("click", () => { togglePomo(); refreshPomoDisplays(); });
  $("pomoEdit")?.addEventListener("click", openPomoModal);
  $("pomoMinusBtn")?.addEventListener("click", () => adjustPomo(-5));
  $("pomoPlusBtn")?.addEventListener("click", () => adjustPomo(5));
  $("pomoReset")?.addEventListener("click", () => { resetPhase(); refreshPomoDisplays(); });
  $("pomoResetModal")?.addEventListener("click", () => { resetPhase(); refreshPomoDisplays(); });
  $("modalClose")?.addEventListener("click", () => closeModal("pomoModal"));
  $("pomoApply")?.addEventListener("click", () => {
    applyPomoSettings({
      workMin: $("pomoMinutes")?.value,
      breakMin: $("breakMinutes")?.value,
      autoStart: $("autoStartSel")?.value,
    });
    refreshPomoDisplays();
    closeModal("pomoModal");
  });
}

function adjustPomo(deltaMin) {
  const p = getState().pomodoro;
  p.workMin = clamp(p.workMin + deltaMin, 5, 90);
  save();
  resetPhase();
  refreshPomoDisplays();
}

/* Rendus a la demande selon l'ecran actif. */
function onScreen(screen) {
  if (screen === "inbox") renderers.inbox();
  else if (screen === "stats") { renderers.history(); renderers.stats(); }
  else if (screen === "notes") renderers.notes();
  else if (screen === "extra") { renderers.kiffance(); renderers.typhonse(); renderers.habits(); renderers.sets(); }
  else if (screen === "settings") { syncFlowPanel(); refreshPomoDisplays(); }
  else if (screen === "tasks") { renderers.tasks(); syncTopTabs(); }
}

function init() {
  setSubtitle(pickRandom(SUBLINES));

  applyTheme();
  bindUI();
  bindNavigation(onScreen);
  bindTopTabs();
  bindStatsTabs((tab) => { if (tab === "graph") renderers.stats(); else renderers.history(); });
  bindModalsOutsideClose();

  setupRendering();

  syncFlowPanel();
  suggestKiffance();
  renderEverything();
  resetPhase();
  refreshPomoDisplays();
  startTaskTimerLoop();

  if ($("hospPatients")) $("hospPatients").value = getState().sets.hospital.patients.length;
  if ($("consPatients")) $("consPatients").value = getState().sets.consult.patients.length;

  setScreen("tasks");

  window.addEventListener("beforeunload", () => save({ immediate: true }));
}

document.addEventListener("DOMContentLoaded", init);
