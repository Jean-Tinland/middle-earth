const styles = /* css */ `
:host { 
  position: absolute;
  padding: 2px 12px;
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: normal;
  color: var(--primary);
  background: var(--paper);
  white-space: nowrap;
  box-shadow: var(--shadow-100), 0 0 5px var(--primary) inset;
  border: 1px solid var(--primary);
  z-index: 1;
  user-select: none;
  pointer-events: none;
  animation: show-tooltips 240ms var(--transition-easing);
}

@keyframes show-tooltips {
  0% {
    opacity: 0;
  }
  1% {
    transform: scale(0.95)
  }
}`;

export default styles;
