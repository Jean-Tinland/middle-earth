const styles = /* css */ `
:host {
  --vertical-padding: 26px;

  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  padding: var(--vertical-padding) 12px;
  box-sizing: border-box;
  font-family: var(--content-font);
  font-weight: 400;
  color: var(--primary);
  overflow: auto;
  animation: modal-fade-in 240ms var(--transition-easing);
}

@keyframes modal-fade-in {
  0% {
    opacity: 0;
  }
}

:host([closing]) {
  animation: modal-fade-out 240ms var(--transition-easing);
}

@keyframes modal-fade-out {
  100% {
    opacity: 0;
  }
}

.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--overlay-backdrop);
}

.modal {
  position: relative;
  width: min(920px, 100%);
  max-width: 100%;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  margin: auto;
  box-sizing: border-box;
  background-color: var(--paper);
  border: 1px solid var(--primary);
  border-radius: var(--radius);
  box-shadow: var(--shadow-200), var(--surface-inset-shadow) inset;
  animation: modal-inner-appearance 240ms var(--transition-easing);
  z-index: 1;
}

.modal::before {
  content: "";
  position: absolute;
  inset: var(--surface-inner-frame-inset);
  border: 1px solid var(--surface-inner-frame-color);
  border-radius: calc(var(--radius) - 1px);
  pointer-events: none;
}

@keyframes modal-inner-appearance {
  from {
    opacity: 0;
  }
}

:host([closing]) .modal {
  animation: modal-inner-disappearance 240ms
    var(--transition-easing);
}

@keyframes modal-inner-disappearance {
  100% {
    opacity: 0;
  }
}

.modal__header {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 54px;
}

.modal__close-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border-radius: var(--radius);
  border: 0;
  cursor: pointer;
  box-shadow: 0 0 0 1px transparent;
  z-index: 1;
  transition: background-color 160ms var(--transition-easing), box-shadow 160ms var(--transition-easing);
}

.modal__close-button:hover {
  background-color: var(--interactive-hover-color);
}

.modal__close-button:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

.modal__close-button-icon {
  width: 20px;
  height: 20px;
  fill: var(--primary);
}

.modal__title {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  padding: 14px 42px 10px 16px;
  box-sizing: border-box;
  font-size: 1.35em;
  line-height: 1.3;
  font-weight: 700;
}

.modal__title-icon {
  flex: 0 0 18px;
  height: 18px;
  margin-right: 1ch;
  fill: currentcolor;
}

.modal__content {
  position: relative;
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 10px 16px 16px;
  font-size: 17px;
  border-top: 0;
  border-radius: 0 0 calc(var(--radius) - 1px) calc(var(--radius) - 1px);
}

.modal__content::before {
  content: "";
  position: absolute;
  top: 0;
  left: var(--surface-inner-frame-inset);
  right: var(--surface-inner-frame-inset);
  border-top: 1px solid var(--surface-divider-color);
  pointer-events: none;
}

@media (pointer: coarse) {
  :host {
    --vertical-padding: 16px;
  }

  .modal {
    min-height: 120px;
  }

  .modal__close-button {
    width: 34px;
    height: 34px;
  }

  .modal__close-button-icon {
    width: 20px;
    height: 20px;
  }
}
`;

export default styles;
