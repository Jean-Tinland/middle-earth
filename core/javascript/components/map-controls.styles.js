const styles = /* css */ `
.controls {
  position: absolute;
  top: 26px;
  right: 26px;
  display: flex;
  flex-direction: column;
  color: var(--primary);
  background-color: var(--paper);
  box-shadow: var(--shadow-100), 0 0 8px var(--primary) inset;
  border: 1px solid var(--primary);
  border-radius: var(--radius);
}

@media (pointer: coarse) {
  .controls {
    top: unset;
    bottom: 16px;
    right: 16px;
    flex-direction: row-reverse;
  }
}

@supports (-webkit-touch-callout: none) {
  .controls {
    top: calc(100vh - 150px);
    bottom: unset;
  }
}

.control {
  --size: 36px;

  flex: 0 0 var(--size);
  width: var(--size);
  height: var(--size);
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  background-color: transparent;
  border: 0;
  outline: none;
  cursor: pointer;
  touch-action: manipulation;
}

@media (pointer: coarse) {
  .control {
    --size: 48px;
  }
}

.control:disabled {
  opacity: 40%;
  cursor: not-allowed;
}

.control:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

.separator {
  flex: 0 0 1px;
  width: 100%;
  margin: 0;
  background-color: currentcolor;
  border: 0;
  opacity: 40%;
}

.icon {
  flex: 0 0 18px;
  fill: currentcolor;
}
`;

export default styles;
