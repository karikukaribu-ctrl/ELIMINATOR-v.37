/* =========================================================
   THEME, MODES & VARIABLES CSS (design v1.33)
========================================================= */

import { $ } from "../core/dom.js";
import { getState } from "../core/store.js";
import { seasonLabel } from "../core/constants.js";

const THEME_CLASSES = [
  "theme--printemps", "theme--ete", "theme--automne", "theme--hiver", "theme--noirblanc",
  "mode--clair", "mode--sombre",
];

export function setRootCssVars() {
  // La v1.33 n'expose pas de taille UI / largeurs de panneaux : rien a faire.
}

export function applyTheme() {
  const { ui } = getState();
  const body = document.body;

  body.classList.remove(...THEME_CLASSES);
  body.classList.add(`theme--${ui.season}`, `mode--${ui.mode}`);
  body.classList.toggle("is-serious", !!ui.serious);
  body.classList.toggle("is-focus", !!ui.focus);

  const modeBtn = $("modeToggle");
  if (modeBtn) {
    modeBtn.textContent = ui.mode === "sombre" ? "SOMBRE" : "CLAIR";
    modeBtn.setAttribute("aria-pressed", ui.mode === "sombre" ? "true" : "false");
  }
  if ($("seasonCycle")) $("seasonCycle").textContent = seasonLabel(ui.season).toUpperCase();

  const seriousBtn = $("seriousToggle");
  if (seriousBtn) {
    seriousBtn.textContent = ui.serious ? "SERIEUX ON" : "SERIEUX";
    seriousBtn.setAttribute("aria-pressed", ui.serious ? "true" : "false");
  }
  const focusBtn = $("focusBtn");
  if (focusBtn) {
    focusBtn.textContent = ui.focus ? "FOCUS ON" : "FOCUS";
    focusBtn.setAttribute("aria-pressed", ui.focus ? "true" : "false");
  }
}
