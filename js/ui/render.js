/* =========================================================
   RENDU (design v1.33)
   Chaque section s'abonne a son/ses topic(s) via store.on(...).
   Delegation d'evenements (un listener par conteneur).
========================================================= */

import { $, delegate } from "../core/dom.js";
import { getState, on } from "../core/store.js";
import { clamp, escapeHTML, dayKey } from "../core/utils.js";
import { applyTheme } from "./theme.js";
import { status } from "./status.js";
import { syncTopTabs } from "./navigation.js";

import {
  activeTasks, doneTasks, sortTasks, categories, computeProgress, dopamineScore,
  ensureCurrentTask, getTask, selectTask, toggleTodayTask, togglePinTask,
  moveTask, editTask, deleteTask, completeTask, restoreTask,
} from "../features/tasks.js";
import { habitProgress, toggleHabitCheck, resetHabit, deleteHabit } from "../features/habits.js";
import { initSetsChecksForToday, setKeyItem, toggleSetCheck, renameSetPatient } from "../features/sets.js";
import { toggleTyphonse, deleteTyphonse } from "../features/notes.js";
import { suggestKiffance } from "../features/kiffance.js";
import { restoreInboxHistoryItem, deleteInboxHistoryItem } from "../features/inbox.js";
import { statsSeries, calendarSeries } from "../features/stats.js";

let subtitleLocked = "";
export function setSubtitle(text) { subtitleLocked = text; }

function visibleTaskList() {
  const { settings } = getState();
  const view = settings.listView || "active";
  let list = getState().tasks.slice();
  if (view === "active") list = list.filter((t) => !t.done);
  else if (view === "done") list = list.filter((t) => t.done);
  if (settings.quickToday) list = list.filter((t) => t.today && !t.done);
  const included = settings.includedCats || [];
  if (included.length > 0) {
    list = list.filter((t) => {
      if (included.includes("CE JOUR") && t.today) return true;
      return included.includes(t.cat);
    });
  }
  return sortTasks(list);
}

function renderProgress() {
  const p = computeProgress();
  if ($("progressFill")) $("progressFill").style.width = `${p.pct}%`;
  if ($("progressPctLabel")) $("progressPctLabel").textContent = `${p.pct}%`;
  if ($("progressBar")) $("progressBar").setAttribute("aria-valuenow", String(p.pct));
}

function renderHub() {
  ensureCurrentTask();
  const state = getState();
  const act = activeTasks();
  const done = doneTasks();
  const p = computeProgress();

  if ($("statActiveMain")) $("statActiveMain").textContent = String(act.length);
  if ($("statDoneMain")) $("statDoneMain").textContent = String(done.length);
  if ($("statEtorionsMain")) $("statEtorionsMain").textContent = String(p.remE);

  if ($("pillTasks")) $("pillTasks").textContent = `${p.remT}/${p.baseTasks || 0} taches`;
  if ($("pillEto")) $("pillEto").textContent = `${p.remE}/${p.baseEtorions || 0} etorions`;
  if ($("pillDone")) $("pillDone").textContent = `${done.length} ${done.length > 1 ? "faites" : "faite"}`;
  if ($("pillMode")) {
    const label = state.ui.focus ? "focus" : state.ui.serious ? "serieux" : "normal";
    $("pillMode").textContent = `mode: ${label}`;
  }
  if ($("pillFlow")) {
    const { fatigue: f, motivation: m } = state.settings;
    const flow = m >= 3 && f <= 2 ? "fort" : m <= 1 && f >= 3 ? "fragile" : "stable";
    $("pillFlow").textContent = `flow: ${flow}`;
  }

  const task = getTask(state.currentTaskId);
  if (!task) {
    if ($("taskTitle")) $("taskTitle").textContent = "Aucune tache selectionnee";
    if ($("metaCat")) $("metaCat").textContent = "—";
    if ($("metaEt")) $("metaEt").textContent = "—";
    if ($("metaTimer")) $("metaTimer").textContent = "00:00";
  } else {
    if ($("taskTitle")) $("taskTitle").textContent = task.title;
    if ($("metaCat")) $("metaCat").textContent = task.cat || "Inbox";
    if ($("metaEt")) $("metaEt").textContent = `${task.etorionsLeft}/${task.etorionsTotal}`;
  }
}

export function renderMetaTimer() {
  const state = getState();
  const task = getTask(state.currentTaskId);
  const el = $("metaTimer");
  if (!el) return;
  if (!task || !state.currentTaskStart) { el.textContent = "00:00"; return; }
  const s = Math.max(0, Math.floor((Date.now() - state.currentTaskStart) / 1000));
  el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function applyBelowListVisibility() {
  const list = $("belowList");
  if (!list) return;
  const { ui, settings } = getState();
  const visible = ui.showBelowList && (!ui.focus || settings.keepListInFocus);
  list.hidden = !visible;
  const btn = $("belowListToggleBtn");
  if (btn) btn.textContent = visible ? "MASQUER" : "LISTE";
}

function renderBelowList() {
  const root = $("belowTasks");
  if (!root) return;
  const state = getState();
  const list = sortTasks(activeTasks());
  if (list.length === 0) { root.innerHTML = `<div class="muted small">Aucune tache.</div>`; return; }
  root.innerHTML = list.slice(0, 30).map((task) => {
    const current = task.id === state.currentTaskId;
    return `
      <div class="task-card" ${current ? 'style="outline:3px solid var(--black);outline-offset:-3px;"' : ""}>
        <div class="task-card__left">
          <div class="task-card__title">${task.today ? "\u25C6 " : ""}${escapeHTML(task.title)}</div>
          <div class="task-card__sub">${escapeHTML(task.cat)} \u00B7 ${task.etorionsLeft}/${task.etorionsTotal}</div>
        </div>
        <div class="task-card__actions">
          <button class="task-icon-btn" data-below-act="up" data-id="${task.id}" title="Monter">\u2191</button>
          <button class="task-icon-btn" data-below-act="down" data-id="${task.id}" title="Descendre">\u2193</button>
          <button class="task-icon-btn ${task.today ? "task-icon-btn--filled" : ""}" data-below-act="today" data-id="${task.id}" title="CE JOUR">\u25C6</button>
          <button class="task-icon-btn" data-below-act="sel" data-id="${task.id}" title="Selectionner">\u25B6</button>
          <button class="task-icon-btn" data-below-act="done" data-id="${task.id}" title="Terminer">\u2713</button>
        </div>
      </div>`;
  }).join("");
}

function renderCatFilter() {
  const select = $("catFilter");
  if (!select) return;
  const selected = getState().settings.includedCats || [];
  select.innerHTML = categories().map((cat) =>
    `<option value="${escapeHTML(cat)}" ${selected.includes(cat) ? "selected" : ""}>${escapeHTML(cat)}</option>`
  ).join("");
}

function taskCardHTML(task, currentId) {
  return `
    <div class="task-card">
      <div class="task-card__left">
        <div class="task-card__title">${task.today ? "\u25C6 " : ""}${escapeHTML(task.title)}</div>
        <div class="task-card__sub">${escapeHTML(task.cat)} \u00B7 ${task.etorionsLeft}/${task.etorionsTotal}${task.done ? " \u00B7 FINIE" : ""}</div>
      </div>
      <div class="task-card__actions">
        ${!task.done ? `<button class="task-icon-btn ${task.id === currentId ? "task-icon-btn--filled" : ""}" data-task-act="sel" data-id="${task.id}" title="Selectionner">${task.id === currentId ? "\u2605" : "\u25B6"}</button>` : ""}
        ${!task.done ? `<button class="task-icon-btn ${task.today ? "task-icon-btn--filled" : ""}" data-task-act="today" data-id="${task.id}" title="CE JOUR">\u25C6</button>` : ""}
        ${!task.done ? `<button class="task-icon-btn" data-task-act="done" data-id="${task.id}" title="Terminer">\u2713</button>` : `<button class="task-icon-btn" data-task-act="restore" data-id="${task.id}" title="Restaurer">\u21A9</button>`}
        <button class="task-icon-btn" data-task-act="edit" data-id="${task.id}" title="Editer">\u270E</button>
        <button class="task-icon-btn" data-task-act="del" data-id="${task.id}" title="Supprimer">\u2715</button>
      </div>
    </div>`;
}

function renderTasksPanel() {
  renderCatFilter();
  const root = $("taskList");
  if (!root) return;
  const list = visibleTaskList();
  if (list.length === 0) { root.innerHTML = `<div class="muted small">Rien ici.</div>`; return; }
  const currentId = getState().currentTaskId;
  root.innerHTML = list.map((t) => taskCardHTML(t, currentId)).join("");
}

function syncInboxUI() {
  const { inbox } = getState();
  if ($("inboxText") && document.activeElement !== $("inboxText")) $("inboxText").value = inbox.draft || "";
  const toggle = $("inboxEditableToggle");
  if (toggle) {
    toggle.textContent = inbox.keepEditableAfterImport ? "EDITION ON" : "EDITION OFF";
    toggle.setAttribute("aria-pressed", inbox.keepEditableAfterImport ? "true" : "false");
  }
  renderInboxHistory();
  const act = activeTasks();
  const done = doneTasks();
  const remE = act.reduce((s, t) => s + (t.etorionsLeft || 0), 0);
  if ($("statActive")) $("statActive").textContent = String(act.length);
  if ($("statDone")) $("statDone").textContent = String(done.length);
  if ($("statEtorions")) $("statEtorions").textContent = String(remE);
}

function renderInboxHistory() {
  const root = $("inboxHistoryList");
  if (!root) return;
  const list = getState().inbox.history || [];
  if (list.length === 0) { root.innerHTML = `<div class="muted small">Aucune liste validee archivee.</div>`; return; }
  root.innerHTML = list.map((item) => {
    const stamp = new Date(item.at).toLocaleString("fr-BE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const preview = item.text.split(/\r?\n/).filter(Boolean).slice(0, 2).join(" \u00B7 ");
    return `
      <div class="task-card">
        <div class="task-card__left">
          <div class="task-card__sub">${stamp}</div>
          <div class="task-card__title">${escapeHTML(preview || "LISTE VIDE")}</div>
        </div>
        <div class="task-card__actions">
          <button class="mini-btn" type="button" data-inbox-act="open" data-id="${item.id}">OUVRIR</button>
          <button class="task-icon-btn" type="button" data-inbox-act="del" data-id="${item.id}" title="Supprimer">\u2715</button>
        </div>
      </div>`;
  }).join("");
}

function renderNotesPanel() {
  const { notes } = getState();
  if ($("notesArea") && document.activeElement !== $("notesArea")) $("notesArea").value = notes.text || "";
  if ($("remindersArea") && document.activeElement !== $("remindersArea")) $("remindersArea").value = notes.reminders || "";
  renderNotesEntries();
}
export function renderNotesOverlay() { renderNotesPanel(); }

function renderNotesEntries() {
  const root = $("notesEntriesList");
  if (!root) return;
  const entries = getState().notes.entries || [];
  if (entries.length === 0) { root.innerHTML = `<div class="muted small">Aucune note horodatee.</div>`; return; }
  root.innerHTML = entries.slice(0, 30).map((e) => {
    const stamp = new Date(e.at).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return `
      <div class="task-card">
        <div class="task-card__left">
          <div class="task-card__sub">${stamp}</div>
          <div class="task-card__title">${escapeHTML(e.text)}</div>
        </div>
      </div>`;
  }).join("");
}

export function renderTyphonse() {
  const root = $("typhonseList");
  if (!root) return;
  const list = getState().notes.typhonse || [];
  if (list.length === 0) { root.innerHTML = `<div class="muted small">Typhonse est vide. Suspect, mais acceptable.</div>`; return; }
  root.innerHTML = list.map((item) => `
    <div class="task-card">
      <div class="task-card__left">
        <div class="task-card__title">${item.done ? "\u2713 " : ""}${escapeHTML(item.label)}</div>
        <div class="task-card__sub">${item.done ? "FAIT" : "EN ATTENTE"}</div>
      </div>
      <div class="task-card__actions">
        <button class="task-icon-btn ${item.done ? "task-icon-btn--filled" : ""}" data-ty-act="toggle" data-id="${item.id}" title="Cocher">${item.done ? "\u21A9" : "\u2713"}</button>
        <button class="task-icon-btn" data-ty-act="del" data-id="${item.id}" title="Supprimer">\u2715</button>
      </div>
    </div>`).join("");
}

function renderHabitsPanel() {
  const root = $("habitsContent");
  if (!root) return;
  const habits = getState().habits;
  if (habits.length === 0) { root.innerHTML = `<div class="muted small">Aucune habitude.</div>`; return; }
  root.innerHTML = habits.map((habit) => {
    const p = habitProgress(habit);
    const cells = habit.checks.map((checked, idx) =>
      `<button class="task-icon-btn ${checked ? "task-icon-btn--filled" : ""}" data-habit-id="${habit.id}" data-habit-index="${idx}" title="Case">${checked ? "\u2713" : "\u00B7"}</button>`
    ).join("");
    return `
      <div class="task-card">
        <div class="task-card__left">
          <div class="task-card__title">${escapeHTML(habit.name)} (${p.done}/${p.total})</div>
          <div class="row" style="margin-top:8px;">${cells}</div>
        </div>
        <div class="task-card__actions">
          <button class="mini-btn" data-habit-act="reset" data-habit="${habit.id}" type="button">RESET</button>
          <button class="mini-btn" data-habit-act="del" data-habit="${habit.id}" type="button">SUPPR</button>
        </div>
      </div>`;
  }).join("");
}

function renderSetsPanel() {
  const root = $("setsContent");
  if (!root) return;
  initSetsChecksForToday();
  const dk = dayKey();
  const state = getState();
  const buildSet = (setKey, title) => {
    const set = state.sets[setKey];
    const checks = set.checks?.[dk] || {};
    let html = `
      <div class="task-card">
        <div class="task-card__left">
          <div class="task-card__title">${title}</div>
          <div class="task-card__sub">${Object.values(checks).filter(Boolean).length}/${set.patients.length * set.itemsPerPatient.length}</div>`;
    set.patients.forEach((patient, idx) => {
      html += `
        <div class="soft-sep"></div>
        <label class="range-label">PATIENT ${idx + 1}</label>
        <input class="mono-input" data-patient-rename="${setKey}|${patient.id}" value="${escapeHTML(patient.name)}">
        <div class="row" style="margin-top:8px;">`;
      set.itemsPerPatient.forEach((item) => {
        const checked = !!checks[setKeyItem(setKey, patient.id, item)];
        html += `<button class="mini-btn ${checked ? "task-icon-btn--filled" : ""}" type="button" data-set-click="${setKey}|${patient.id}|${encodeURIComponent(item)}">${escapeHTML(item)}</button>`;
      });
      html += `</div>`;
    });
    html += `</div></div>`;
    return html;
  };
  root.innerHTML = buildSet("hospital", "HOSPITALIER") + buildSet("consult", "CONSULTATION");
}

function renderHistoryPanel() {
  const root = $("historyContent");
  const state = getState();
  if (root) {
    if (state.history.length === 0) {
      root.innerHTML = `<div class="muted small">Pas encore d'historique.</div>`;
    } else {
      root.innerHTML = state.history.slice(0, 14).map((e) => `
        <div class="task-card">
          <div class="task-card__left">
            <div class="task-card__sub">${e.day}</div>
            <div class="task-card__title">FAITES ${e.doneTasks} \u00B7 RESTANTES ${e.remainingTasks} \u00B7 ETO ${e.doneEtorions}</div>
          </div>
        </div>`).join("");
    }
  }
  const grid = $("calendarGrid");
  if (grid) {
    const series = calendarSeries(30);
    const max = Math.max(1, ...series.map((s) => s.value));
    grid.innerHTML = series.map(({ day, value }) => {
      const opacity = value === 0 ? 0 : 0.25 + clamp(value / max, 0, 1) * 0.75;
      return `
        <div class="calendar-cell" title="${day} — ${value} tache(s)">
          <div class="calendar-cell__fill" style="opacity:${opacity}"></div>
          <div class="calendar-cell__label">${day.slice(8, 10)}</div>
        </div>`;
    }).join("");
  }
}

function renderMiniBars(series, key, maxValue) {
  return series.map((row) => {
    const v = row[key];
    const width = maxValue <= 0 ? 0 : Math.max(4, Math.round((v / maxValue) * 100));
    return `
      <div class="stat-row">
        <div class="task-card__sub">${row.day.slice(8, 10)}</div>
        <div class="stat-row__bartrack"><div class="stat-row__barfill" style="width:${width}%"></div></div>
        <div class="stat-row__num">${v}</div>
      </div>`;
  }).join("");
}

function renderStatsPanel() {
  const progress = computeProgress();
  const dopamine = dopamineScore();
  const series = statsSeries();
  const maxTasks = Math.max(1, ...series.map((s) => s.tasks));
  const maxEto = Math.max(1, ...series.map((s) => s.etorions));
  const stats = getState().stats;
  const html = `
    <div class="setting-card setting-card--inner">
      <div class="setting-card__title">VUE D'ENSEMBLE</div>
      <div class="setting-card__desc">
        PROGRESSION RESTANTE ${progress.pct}% \u00B7 DOPAMINE ${dopamine}%<br>
        TACHES COMPLETEES ${stats.tasksCompleted} \u00B7 ETORIONS ${stats.etorionsDone}<br>
        SESSIONS ${stats.sessions} \u00B7 CELEBRATIONS ${stats.celebrationsShown}
      </div>
    </div>
    <div class="setting-card setting-card--inner">
      <div class="setting-card__title">TACHES / JOUR</div>
      <div style="margin-top:12px;">${renderMiniBars(series, "tasks", maxTasks)}</div>
    </div>
    <div class="setting-card setting-card--inner">
      <div class="setting-card__title">ETORIONS / JOUR</div>
      <div style="margin-top:12px;">${renderMiniBars(series, "etorions", maxEto)}</div>
    </div>`;
  if ($("statsContent")) $("statsContent").innerHTML = html;
}

function renderExport() {
  const out = $("exportOut");
  if (out) out.value = JSON.stringify(getState(), null, 2);
}

function renderKiffance() { suggestKiffance(); }

export function setupRendering() {
  on("theme", applyTheme);
  on("hub", () => { renderHub(); renderProgress(); });
  on("tasks", () => { renderTasksPanel(); renderBelowList(); syncTopTabs(); });
  on("inbox", syncInboxUI);
  on("notes", renderNotesPanel);
  on("typhonse", renderTyphonse);
  on("habits", renderHabitsPanel);
  on("sets", renderSetsPanel);
  on("history", renderHistoryPanel);
  on("stats", () => { renderStatsPanel(); renderExport(); });
  on("*", renderEverything);

  delegate($("belowTasks"), "click", "[data-below-act]", (btn) => {
    const id = btn.dataset.id, act = btn.dataset.belowAct;
    if (act === "up") moveTask(id, -1);
    else if (act === "down") moveTask(id, 1);
    else if (act === "today") toggleTodayTask(id);
    else if (act === "sel") selectTask(id);
    else if (act === "done") completeTask(id);
  });

  delegate($("taskList"), "click", "[data-task-act]", (btn) => {
    const id = btn.dataset.id, act = btn.dataset.taskAct;
    if (act === "sel") selectTask(id);
    else if (act === "done") completeTask(id);
    else if (act === "today") toggleTodayTask(id);
    else if (act === "restore") restoreTask(id);
    else if (act === "del") deleteTask(id);
    else if (act === "edit") {
      const task = getTask(id);
      const next = prompt("Editer la tache", task?.title || "");
      if (next !== null) editTask(id, next);
    }
  });

  delegate($("typhonseList"), "click", "[data-ty-act]", (btn) => {
    if (btn.dataset.tyAct === "toggle") toggleTyphonse(btn.dataset.id);
    else if (btn.dataset.tyAct === "del") deleteTyphonse(btn.dataset.id);
  });

  delegate($("habitsContent"), "click", "[data-habit-id]", (btn) => {
    toggleHabitCheck(btn.dataset.habitId, parseInt(btn.dataset.habitIndex, 10));
  });
  delegate($("habitsContent"), "click", "[data-habit-act]", (btn) => {
    if (btn.dataset.habitAct === "reset") resetHabit(btn.dataset.habit);
    else if (btn.dataset.habitAct === "del") deleteHabit(btn.dataset.habit);
  });

  delegate($("setsContent"), "click", "[data-set-click]", (btn) => {
    const [setName, patientId, itemEnc] = btn.dataset.setClick.split("|");
    toggleSetCheck(setName, patientId, decodeURIComponent(itemEnc));
  });
  delegate($("setsContent"), "change", "[data-patient-rename]", (input) => {
    const [setName, patientId] = input.dataset.patientRename.split("|");
    renameSetPatient(setName, patientId, input.value);
  });

  delegate($("inboxHistoryList"), "click", "[data-inbox-act]", (btn) => {
    const id = btn.dataset.id;
    if (btn.dataset.inboxAct === "open") {
      const text = restoreInboxHistoryItem(id);
      if (text != null && $("inboxText")) $("inboxText").value = text;
      status("Liste restauree dans l'Inbox.");
    } else if (btn.dataset.inboxAct === "del") {
      deleteInboxHistoryItem(id);
    }
  });
}

export function renderEverything() {
  applyTheme();
  renderProgress();
  renderHub();
  renderMetaTimer();
  syncInboxUI();
  renderTasksPanel();
  renderBelowList();
  applyBelowListVisibility();
  syncTopTabs();
  renderNotesPanel();
  renderTyphonse();
  renderHabitsPanel();
  renderSetsPanel();
  renderHistoryPanel();
  renderStatsPanel();
  renderExport();
  renderKiffance();
}

export const renderers = {
  inbox: syncInboxUI,
  tasks: renderTasksPanel,
  kiffance: renderKiffance,
  notes: renderNotesPanel,
  notesOverlay: renderNotesPanel,
  typhonse: renderTyphonse,
  habits: renderHabitsPanel,
  sets: renderSetsPanel,
  history: renderHistoryPanel,
  stats: renderStatsPanel,
  export: renderExport,
};
