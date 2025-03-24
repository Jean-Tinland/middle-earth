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
    position: absolute;
    transform: translate(-50%, -50%);
  }

  .poi[data-kind="region"],
  .poi[data-kind="forest"],
  .poi[data-kind="mountain"] {
    font-family: var(--title-font);
    text-transform: uppercase;
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

  .name {
    --shadow: var(--paper);
    --top-shadow: calc(var(--font-size) * 0.02);
    --bottom-shadow: calc(0px - calc(var(--font-size) * 0.02));

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
`;

export default styles;
