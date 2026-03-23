const styles = /* css */ `
.compass {
  --size: 38px;

  position: absolute;
  top: 109px;
  right: 26px;
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
  cursor: pointer;
  touch-action: manipulation;
  outline: none;
}

@media (pointer: coarse) {
  .compass {
    --size: 50px;

    position: fixed;
    top: unset;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    right: 130px;
  }
}

.compass:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

.rose {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  transform-origin: center;
}

.north {
  fill: var(--primary);
}

.south {
  fill: currentColor;
  opacity: 0.35;
}

.center-dot {
  fill: currentColor;
  opacity: 0.5;
}
`;

export default styles;
