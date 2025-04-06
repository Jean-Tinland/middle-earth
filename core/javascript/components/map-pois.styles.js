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

  @supports (-webkit-touch-callout: none) {
    :host {
      --font-size: calc(var(--font-size-ref) / 2);
    }
  }

  .poi {
    --shadow: var(--paper);
    --top-shadow: calc(var(--font-size) * 0.015);
    --bottom-shadow: calc(0px - calc(var(--font-size) * 0.015));

    position: absolute;
    transform: translate(-50%, -50%);
  }

  .poi[data-kind="region"],
  .poi[data-kind="forest"],
  .poi[data-kind="mountain"],
  .poi[data-kind="sea"]:not([data-size="1"]) {
    font-family: var(--title-font);
    text-transform: uppercase;
  }

  .poi[data-kind="city"] {
    font-weight: 700;
  }

  .poi[data-kind="region"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.45);
    text-transform: none;
  }

  .poi[data-kind="region"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.7);
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
    font-size: calc(var(--font-size) * 0.55);
    font-weight: 700;
  }

  .poi[data-kind="common-place"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.65);
  }

  .poi[data-kind="common-place"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.75);
  }

  .poi[data-kind="sea"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.55);
  }

  .poi[data-kind="sea"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.5);
  }

  .poi[data-kind="sea"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.6);
  }

  .poi[data-kind="city"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.45);
  }

  .poi[data-kind="city"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.55);
  }

  .poi[data-kind="city"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.65);
  }

  .poi[data-kind="river"][data-size="1"] {
    font-size: calc(var(--font-size) * 0.55);
  }

  .poi[data-kind="river"][data-size="2"] {
    font-size: calc(var(--font-size) * 0.65);
  }

  .poi[data-kind="river"][data-size="3"] {
    font-size: calc(var(--font-size) * 0.75);
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

  .poi[data-kind="mountain"] .name,
  .poi[data-kind="common-place"][data-size="1"] .name {
    color: var(--black);
  }

  .poi[data-kind="sea"] .name,
  .poi[data-kind="river"] .name {
    color: var(--water-label);
  }

  .poi[data-kind="river"] .name {
    font-style: italic;
  }

  .poi[data-kind="city"] .name {
    position: absolute;
    top: calc(100% + 1px);
    left: 50%;
    transform: translateX(-50%);
  }

  .poi[data-kind="city"] .dot {
    position: relative;
    background-color: var(--primary);
    width: calc(var(--font-size-ref) * var(--multiplier));
    height: calc(var(--font-size-ref) * var(--multiplier));
    border-radius: 50%;
    box-shadow: 0 0 0 calc(var(--font-size-ref) / 15) white inset;
  }

  .poi[data-kind="city"][data-size="1"] .dot {
    --multiplier: 0.35;
  }

  .poi[data-kind="city"][data-size="2"] .dot {
    --multiplier: 0.45;
  }

  .poi[data-kind="city"][data-size="3"] .dot {
    --multiplier: 0.55;

    border-radius: 0;
  }

  .poi[data-kind="city"][data-size="4"] .dot {
    --multiplier: 0.65;

    border-radius: 0;
  }
`;

export default styles;
