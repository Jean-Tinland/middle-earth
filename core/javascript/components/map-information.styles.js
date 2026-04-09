const styles = /* css */ `
.information {
  --size: 36px;

  position: fixed;
  bottom: 26px;
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
  outline: none;
  cursor: pointer;
  touch-action: manipulation;
}

.information:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

@media (pointer: coarse) {
  .information {
    --size: 48px;

    top: unset;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    left: calc(16px + env(safe-area-inset-left, 0px));
    right: unset;
  }
}


.icon {
  flex: 0 0 18px;
  fill: currentcolor;
}
`;

export default styles;
