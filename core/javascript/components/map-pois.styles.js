const styles = /* css */ `
  :host {
    --font-size: var(--font-size-ref);

    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  @media (max-width: 700px) {
    :host {
      --font-size: calc(var(--font-size-ref) * 1.3);
    }
  }

  .poi {
    --shadow: var(--paper);
    --top-shadow: calc(var(--font-size) * 0.02);
    --bottom-shadow: calc(0px - calc(var(--font-size) * 0.02));

    position: absolute;
    transform: translate(-50%, -50%);
  }

  .poi[data-kind="region"],
  .poi[data-kind="forest"],
  .poi[data-kind="mountain"],
  .poi[data-kind="sea"] {
    font-family: var(--title-font);
    text-transform: uppercase;
  }

  .poi[data-kind="city"] {
    font-weight: 700;
  }

  .poi[data-kind="region"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.55);
    text-transform: none;
  }
  
  .poi[data-kind="region"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.6);
  }

  .poi[data-kind="region"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.85);
    font-weight: 700;
  }

  .poi[data-kind="forest"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.3);
  }

  .poi[data-kind="forest"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.45);
  }

  .poi[data-kind="forest"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.55);
  }

  .poi[data-kind="mountain"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.3);
  }

  .poi[data-kind="mountain"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.45);
  }

  .poi[data-kind="mountain"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.55);
  }

  .poi[data-kind="common-place"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.6);
    text-transform: uppercase;
  }

  .poi[data-kind="common-place"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.7);
  }

  .poi[data-kind="common-place"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.8);
  }

  .poi[data-kind="sea"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.4);
  }

  .poi[data-kind="sea"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.5);
  }

  .poi[data-kind="sea"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.6);
  }

  .poi[data-kind="city"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.6);
  }

  .poi[data-kind="city"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.7);
  }

  .poi[data-kind="city"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.8);
  }

  .name {
    color: var(--primary);
    white-space: nowrap;
    text-shadow: var(--top-shadow) var(--top-shadow) 0px var(--shadow), 
      var(--top-shadow) var(--bottom-shadow) 0px var(--shadow), 
      var(--bottom-shadow) var(--top-shadow) 0px var(--shadow),
      var(--bottom-shadow) var(--bottom-shadow) 0px var(--shadow);
  }

  .poi[data-kind="forest"] .name {
    --shadow: var(--black);

    color: var(--white);
  }

  .poi[data-kind="mountain"] .name {
    color: var(--black);
  }

  .poi[data-kind="sea"] .name {
    color: var(--sea-label);
  }

  .poi[data-kind="city"] .name {
    position: absolute;
    top: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
  }

  .poi[data-kind="city"] .dot {
    position: absolute;
    border-radius: 50%;
    background-color: var(--primary);
    transform: translate(-50%, -50%);
    box-shadow: 0px 0px 0px calc(var(--top-shadow) * 2) var(--shadow);
  }

  .poi[data-kind="city"][data-size="1"] .dot {
    width: calc(var(--font-size-ref) * 0.4);
    height: calc(var(--font-size-ref) * 0.4);
  }

  .poi[data-kind="city"][data-size="2"] .dot {
    width: calc(var(--font-size-ref) * 0.5);
    height: calc(var(--font-size-ref) * 0.5);
  }

  .poi[data-kind="city"][data-size="3"] .dot {
    width: calc(var(--font-size-ref) * 0.6);
    height: calc(var(--font-size-ref) * 0.6);
  }
`;

export default styles;
