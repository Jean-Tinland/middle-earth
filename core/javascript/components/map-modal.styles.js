const styles = /* css */ `
:host {
  --vertical-padding: 40px;

  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  padding: var(--vertical-padding) 16px;
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
  background-color: rgba(0, 0, 0, 0.65);
}
.modal {
  position: relative;
  max-width: 95%;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  margin: auto;
  box-sizing: border-box;
  background-color: var(--paper);
  border-radius: var(--radius);
  box-shadow: var(--shadow-100), 0 0 8px var(--primary) inset;
  animation: modal-inner-appearance 240ms var(--transition-easing);
  z-index: 1;
}
@keyframes modal-inner-appearance {
  0% {
    opacity: 0;
  }
}
:host([closing]) .modal {
  animation: modal-inner-disappearance 240ms var(--transition-easing);
}
@keyframes modal-inner-disappearance {
  100% {
    opacity: 0;
  }
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
  background-color: rgba(0, 0, 0, 0.05);
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
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 14px 70px 14px 10px;
  box-sizing: border-box;
  font-size: 22px;
  line-height: 1;
  font-weight: 700;
  border-radius: var(--radius) var(--radius) 0 0;
  border-bottom: 1px solid var(--primary);
}
.modal__title-icon {
  flex: 0 0 22px;
  height: 22px;
  margin-right: 1ch;
  fill: currentcolor;
}
.modal__content {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 18px;
  font-size: 17px;
  border-radius: 0 0 var(--radius) var(--radius);
}
`;

export default styles;
