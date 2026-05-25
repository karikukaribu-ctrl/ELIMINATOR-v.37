/* =========================================================
   MODALS (design v1.33)
   Plus de panneaux lateraux : seulement deux modals (Pomodoro, Filtres).
========================================================= */

import { $, setHidden } from "../core/dom.js";
import { getState } from "../core/store.js";

export function openModal(id) {
  setHidden($(id), false);
}

export function closeModal(id) {
  setHidden($(id), true);
}

export function closeAllModals() {
  setHidden($("pomoModal"), true);
  setHidden($("filterModal"), true);
}

export function openPomoModal() {
  const p = getState().pomodoro;
  if ($("pomoMinutes")) $("pomoMinutes").value = p.workMin;
  if ($("breakMinutes")) $("breakMinutes").value = p.breakMin;
  if ($("autoStartSel")) $("autoStartSel").value = p.autoStart;
  openModal("pomoModal");
}

export function bindModalsOutsideClose() {
  // Clic sur le fond (hors .modal-box) ferme.
  ["pomoModal", "filterModal"].forEach((id) => {
    $(id)?.addEventListener("mousedown", (e) => {
      if (e.target === $(id)) closeModal(id);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });
}
