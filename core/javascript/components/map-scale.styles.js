const styles = /* css */ `
:host {
  position: absolute;
  bottom: 26px;
  left: 26px;
  display: flex;
  align-items: center;
}

@media (pointer: coarse) {
  :host {
    top: 16px;
    bottom: unset;
    right: 16px;
    left: unset;
  }
}

.scale {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: var(--primary);
  background-color: var(--paper);
  box-shadow: var(--shadow-100), 0 0 8px var(--primary) inset;
  border: 1px solid var(--primary);
  border-radius: var(--radius);
  padding: 6px 10px;
  font-family: var(--content-font);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  min-width: 80px;
}

.bar-row {
  display: flex;
  align-items: flex-end;
  gap: 0;
  width: 100%;
}

.bar {
  flex: 1 1 auto;
  height: 6px;
  border: 1px solid currentcolor;
  border-top: none;
  border-left: none;
  box-sizing: border-box;
}

.bar:nth-child(odd) {
  background-color: currentcolor;
}

.labels {
  display: flex;
  justify-content: space-between;
  width: calc(100% + 0px);
  pointer-events: none;
}

.label {
  font-size: 10px;
  line-height: 1;
  color: currentcolor;
}

.unit {
  text-align: right;
  font-size: 12px;
  line-height: 1;
}
`;

export default styles;
