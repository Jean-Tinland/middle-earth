const styles = /* css */ `
  :host {
    --size: 36px;

    position: absolute;
    top: 26px;
    left: 26px;
  }

  @media (pointer: coarse) {
    :host {
      --size: 48px;

      top: calc(16px + env(safe-area-inset-top, 0px));
      left: calc(16px + env(safe-area-inset-left, 0px));
    }
  }

  .nomenclature-button {
    width: var(--size);
    height: var(--size);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
    background-color: var(--paper);
    box-shadow: var(--shadow-200), var(--surface-inset-shadow) inset;
    border: 1px solid var(--primary);
    border-radius: var(--radius);
    outline: none;
    cursor: pointer;
    touch-action: manipulation;
  }

  .nomenclature-button:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .icon {
    flex: 0 0 18px;
    fill: currentcolor;
  }

  .panel {
    position: absolute;
    top: calc(var(--size) + 8px);
    left: 0;
    min-width: 250px;
    max-height: 70vh;
    overflow-y: auto;
    display: none;
    background-color: var(--paper);
    box-shadow: var(--shadow-200), var(--surface-inset-shadow) inset;
    border: 1px solid var(--primary);
    border-radius: var(--radius);
    color: inherit;
  }

  .panel::before {
    content: "";
    position: absolute;
    inset: var(--surface-inner-frame-inset);
    border: 1px solid var(--surface-inner-frame-color);
    border-radius: calc(var(--radius) - 1px);
    pointer-events: none;
  }

  .panel[open] {
    display: block;
    animation: panel-appear 240ms var(--transition-easing);
  }

  @keyframes panel-appear {
    from {
      opacity: 0;
      transform: scale(var(--surface-appear-scale));
    }
  }

  .panel__content {
    position: relative;
    z-index: 1;
    padding: 6px 0;
  }

  .group + .group {
    position: relative;
  }

  .group + .group::before {
    content: "";
    position: absolute;
    top: calc(0px - var(--surface-inner-frame-inset) * 2);
    left: calc(var(--surface-inner-frame-inset) * 3);
    right: calc(var(--surface-inner-frame-inset) * 3);
    border-top: 1px solid var(--surface-divider-soft-color);
    pointer-events: none;
  }

  .group__title {
    margin: 6px 0 2px;
    padding: 0 14px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.7;
  }

  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 14px;
    min-height: 22px;
  }

  .entry__label {
    font-size: 13px;
    white-space: nowrap;
    opacity: 0.8;
  }

  .city-dot {
    flex-shrink: 0;
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .city-dot::before {
    content: "";
    display: block;
    background-color: var(--primary);
    border: 2px solid var(--white);
    border-radius: 50%;
  }

  .city-dot--xs::before {
    width: 5px;
    height: 5px;
    border: none;
  }

  .city-dot--sm::before {
    width: 7px;
    height: 7px;
  }

  .city-dot--md::before {
    width: 10px;
    height: 10px;
  }

  .city-dot--lg::before {
    width: 13px;
    height: 13px;
  }

  .text-sample {
    flex-shrink: 0;
    width: 80px;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-rendering: geometricPrecision;
  }

  .text-sample--region {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--primary);
  }

  .text-sample--forest {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--white);
    background-color: #5d6328;
    border-radius: 2px;
    padding: 1px 3px;
  }

  .text-sample--mountain {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--black);
  }

  .text-sample--sea {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--water-label);
  }

  .text-sample--river {
    font-family: var(--content-font);
    font-size: 12px;
    font-style: italic;
    color: var(--water-label);
  }

  .text-sample--common-place {
    font-family: var(--content-font);
    font-size: 12px;
    font-weight: 700;
    color: var(--primary);
  }

  .preference__label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    user-select: none;
    opacity: 0.8;
    transition: opacity 100ms;
  }

  .preference__label:hover {
    opacity: 1;
  }

  .preference__checkbox {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .preference__check {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    border: 1px solid var(--primary);
    border-radius: 2px;
    background-color: var(--paper);
    box-shadow: 0 0 6px var(--interactive-link-color) inset;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preference__check::after {
    content: "";
    display: block;
    width: 4px;
    height: 7px;
    border-right: 2px solid var(--primary);
    border-bottom: 2px solid var(--primary);
    transform: rotate(45deg) translateY(-1px);
    opacity: 0;
    transition: opacity 120ms;
  }

  .preference__checkbox:checked + .preference__check::after {
    opacity: 1;
  }

  .preference__checkbox:focus-visible + .preference__check {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

export default styles;
