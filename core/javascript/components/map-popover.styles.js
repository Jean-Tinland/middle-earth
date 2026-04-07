const styles = /* css */ `
  :host {
    position: fixed;
    z-index: 1000;
    font-family: var(--content-font);
    color: var(--primary);
    animation: popover-appear 240ms var(--transition-easing);
  }

  @keyframes popover-appear {
    from {
      opacity: 0;
      transform: scale(var(--surface-appear-scale));
    }
  }

  :host([closing]) {
    animation: popover-disappear 240ms var(--transition-easing)
      forwards;
    pointer-events: none;
  }

  @keyframes popover-disappear {
    to {
      opacity: 0;
      transform: scale(var(--surface-appear-scale));
    }
  }

  .popover {
    position: relative;
    min-width: 220px;
    max-width: min(320px, calc(100vw - 24px));
    padding: 14px 16px;
    background-color: var(--paper);
    border: 1px solid var(--primary);
    border-radius: var(--radius);
    box-shadow: var(--shadow-200), var(--surface-inset-shadow) inset;
  }

  .popover::before {
    content: '';
    position: absolute;
    inset: var(--surface-inner-frame-inset);
    border: 1px solid var(--surface-inner-frame-color);
    border-radius: calc(var(--radius) - 1px);
    pointer-events: none;
  }

  .close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    border-radius: var(--radius);
    cursor: pointer;
    color: var(--primary);
    transition: background-color 150ms var(--transition-easing);
  }

  .close-button:hover {
    background-color: var(--interactive-hover-color);
  }

  .close-button:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--radius);
  }

  .close-button-icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  .name {
    font-size: 1.1em;
    font-weight: 700;
    line-height: 1.3;
    padding-right: 28px;
    margin-bottom: 4px;
  }

  .source {
    font-size: 0.85em;
    font-style: italic;
    margin-bottom: 10px;
  }

  .search-label {
    font-size: 0.82em;
    line-height: 1.8;
    border-top: 1px solid var(--surface-divider-color);
    padding-top: 8px;
  }

  .search-link {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: var(--interactive-link-color);
  }

  .search-link:hover {
    text-decoration-color: var(--primary);
  }

  .search-link:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: 2px;
  }
`;

export default styles;
