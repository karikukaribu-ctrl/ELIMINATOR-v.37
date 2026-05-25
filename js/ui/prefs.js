/* =========================================================
   PREFERENCES & FLOW (design v1.33)
   La v1.33 pilote le mode/theme par boutons ; le flow par ranges.
========================================================= */

import { $ } from "../core/dom.js";
import { getState, save, emit } from "../core/store.js";
import { clamp } from "../core/utils.js";
import { status } from "./status.js";

export function syncFlowPanel() {
  const s = getState();
  if ($("fatigueInline")) $("fatigueInline").value = s.settings.fatigue;
  if ($("motivationInline")) $("motivationInline").value = s.settings.motivation;
  if ($("celeChanceInline")) $("celeChanceInline").value = s.settings.celebrationChance;
  if ($("tipsChanceInline")) $("tipsChanceInline").value = s.settings.tipsChance;
}

export function saveFlow() {
  const s = getState();
  s.settings.fatigue = clamp(parseInt($("fatigueInline")?.value, 10) || s.settings.fatigue, 0, 4);
  s.settings.motivation = clamp(parseInt($("motivationInline")?.value, 10) || s.settings.motivation, 0, 4);
  s.settings.celebrationChance = clamp(Number($("celeChanceInline")?.value) || s.settings.celebrationChance, 0, 1);
  s.settings.tipsChance = clamp(Number($("tipsChanceInline")?.value) || s.settings.tipsChance, 0, 1);
  save();
  emit("hub", "stats");
  status("Flow sauve.");
}
