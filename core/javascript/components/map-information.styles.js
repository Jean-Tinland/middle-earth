const styles = /* css */ `
:host {
  --size: 36px;

  position: absolute;
  bottom: 26px;
  right: 26px;
}

@media (pointer: coarse) {
  :host {
    --size: 48px;

    bottom: 16px;
    left: 16px;
    right: unset;
  }
}

@supports (-webkit-touch-callout: none) {
  :host {
    top: calc(100vh - 150px);
    bottom: unset;
  }
}

.information {
  width: var(--size);
  height: var(--size);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  background-color: var(--paper);
  box-shadow: var(--shadow-100), 0 0 8px var(--primary) inset;
  border: 1px solid var(--primary);
  border-radius: var(--radius);
  outline: none;
  cursor: pointer;
  touch-action: manipulation;
}

.icon {
  flex: 0 0 18px;
  fill: currentcolor;
}
`;

export default styles;
