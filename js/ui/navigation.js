/* =========================================================
   NAVIGATION (design v1.33)
   - Écrans plein écran (tasks / inbox / stats / notes / extra / settings)
   - Bottom-nav + header
   - Onglets haut (filtre rapide de vue) + sous-onglets stats
========================================================= */

import { $, $$ } from "../core/dom.js";
import { getState, save, emit } from "../core/store.js";

const SCREENS = ["tasks", "inbox", "stats", "notes", "extra", "settings"];

const SCREEN_TITLES = {
  tasks: "ELIMINATOR",
  inbox: "INBOX",
  stats: "STATS",
  notes: "NOTES",
  extra: "EXTRA",
  settings: "RÉGLAGES",
};

let currentScreen = "tasks";
let onScreenChange = null; // callback fourni par main pour déclencher les rendus

export function getCurrentScreen() {
  return currentScreen;
}

export function setScreen(screen) {
  if (!SCREENS.includes(screen)) return;
  currentScreen = screen;

  $$(".screen-page").forEach((p) => p.classList.remove("is-active"));
  $(`screen-${screen}`)?.classList.add("is-active");

  $$(".bottom-nav__item").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.screen === screen)
  );

  if ($("screenTitle")) $("screenTitle").textContent = SCREEN_TITLES[screen] || "ELIMINATOR";

  // Les onglets de filtre rapide n'ont de sens que sur l'écran tâches.
  const topTabs = $("topTabs");
  if (topTabs) topTabs.style.display = screen === "tasks" ? "" : "none";

  onScreenChange?.(screen);
  window.scrollTo(0, 0);
}

/* Onglets haut : filtre rapide ACTIVES / CE JOUR / FINIES / TOUTES.
   On mappe sur settings.listView (+ un filtre "today" géré au rendu). */
export function bindTopTabs(onChange) {
  $$(".top-tab[data-view-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".top-tab[data-view-tab]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const tab = btn.dataset.viewTab;
      const s = getState();
      if (tab === "today") {
        s.settings.listView = "active";
        s.settings.quickToday = true;
      } else {
        s.settings.listView = tab; // active | done | all
        s.settings.quickToday = false;
      }
      save();
      emit("tasks");
      onChange?.(tab);
    });
  });
}

export function syncTopTabs() {
  const s = getState();
  const tab = s.settings.quickToday ? "today" : s.settings.listView || "active";
  $$(".top-tab[data-view-tab]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.viewTab === tab)
  );
}

/* Sous-onglets de l'écran Stats : HISTOIRE / GRAPHIQUE */
export function bindStatsTabs(onChange) {
  $$(".subtab[data-stats-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".subtab[data-stats-tab]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const tab = btn.dataset.statsTab;
      $$(".stats-tab-page").forEach((p) => p.classList.remove("is-active"));
      $(`stats-${tab}-tab`)?.classList.add("is-active");
      onChange?.(tab);
    });
  });
}

export function bindNavigation(onChange) {
  onScreenChange = onChange;
  $$(".bottom-nav__item[data-screen]").forEach((btn) => {
    btn.addEventListener("click", () => setScreen(btn.dataset.screen));
  });
  // Header : ☰ ouvre les réglages, ⚙ aussi (raccourci).
  $("headerMenuBtn")?.addEventListener("click", () => setScreen("settings"));
  $("headerSettingsBtn")?.addEventListener("click", () => setScreen("settings"));
}
