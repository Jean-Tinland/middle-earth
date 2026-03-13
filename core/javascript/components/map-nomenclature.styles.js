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

      top: 16px;
      left: 16px;
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
    box-shadow: var(--shadow-100), 0 0 8px var(--primary) inset;
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
    min-width: 240px;
    max-height: 70vh;
    overflow-y: auto;
    display: none;
    background-color: var(--paper);
    box-shadow: var(--shadow-100), 0 0 8px var(--primary) inset;
    border: 1px solid var(--primary);
    border-radius: var(--radius);
    font-family: var(--content-font);
    color: var(--primary);
  }

  .panel[open] {
    display: block;
    animation: panel-appear 200ms var(--transition-easing);
  }

  @keyframes panel-appear {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  .panel__header {
    padding: 10px 14px 8px;
    border-bottom: 1px solid rgba(100, 51, 34, 0.2);
  }

  .panel__title {
    margin: 0;
    font-family: var(--title-font);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .panel__content {
    padding: 6px 0;
  }

  .group + .group {
    border-top: 1px solid rgba(100, 51, 34, 0.2);
  }

  .group__title {
    margin: 6px 0 2px;
    padding: 0 14px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.5;
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
    font-size: 12px;
    white-space: nowrap;
    opacity: 0.8;
  }

  /* City dot markers */

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
    box-shadow: 0 0 0 1.5px var(--paper) inset;
  }

  .city-dot--sm::before {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .city-dot--md::before {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .city-dot--lg::before {
    width: 13px;
    height: 13px;
    border-radius: 0;
  }

  /* Text samples */

  .text-sample {
    flex-shrink: 0;
    width: 80px;
    font-size: 9px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-rendering: geometricPrecision;
  }

  .text-sample--region {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--primary);
    text-shadow:
      0.5px 0.5px 0 var(--paper),
      0.5px -0.5px 0 var(--paper),
      -0.5px 0.5px 0 var(--paper),
      -0.5px -0.5px 0 var(--paper);
  }

  .text-sample--forest {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--white);
    background-color: #5d6328;
    border-radius: 2px;
    padding: 1px 3px;
    text-shadow:
      0.5px 0.5px 0 #1a1a00,
      0.5px -0.5px 0 #1a1a00,
      -0.5px 0.5px 0 #1a1a00,
      -0.5px -0.5px 0 #1a1a00;
  }

  .text-sample--mountain {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--black);
    text-shadow:
      0.5px 0.5px 0 var(--paper),
      0.5px -0.5px 0 var(--paper),
      -0.5px 0.5px 0 var(--paper),
      -0.5px -0.5px 0 var(--paper);
  }

  .text-sample--sea {
    font-family: var(--title-font);
    text-transform: uppercase;
    color: var(--water-label);
  }

  .text-sample--river {
    font-family: var(--content-font);
    font-size: 11px;
    font-style: italic;
    color: var(--water-label);
  }

  .text-sample--common-place {
    font-family: var(--content-font);
    font-size: 11px;
    font-weight: 700;
    color: var(--primary);
  }
`;

export default styles;
