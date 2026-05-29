const styles = /* css */ `
  :host {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  .poi {
    --shadow: var(--paper);

    position: absolute;
    transform: translate(-50%, -50%) rotate(var(--poi-rotation, 0deg));
    pointer-events: auto;
    cursor: pointer;
  }

  .poi[hidden] {
    display: none;
  }

  .poi[data-kind="region"],
  .poi[data-kind="forest"],
  .poi[data-kind="mountain"],
  .poi[data-kind="sea"]:not([data-size="3"]) {
    font-family: var(--title-font);
    text-transform: uppercase;
  }

  .poi:is([data-kind="city"], [data-kind="hamlet"], [data-kind="fortress"]) {
    font-weight: 700;
  }

  .poi[data-kind="region"][data-size="3"] {
    text-transform: none;
  }

  .poi[data-kind="region"][data-size="1"] {
    font-weight: 700;
  }

  .poi[data-kind="common-place"][data-size="3"] {
    font-weight: 700;
  }

  .name {
    color: var(--primary);
    text-align: center;
    white-space: nowrap;
    text-shadow: 0 0 2px var(--shadow), 
      0 0 2px var(--shadow),
      0 0 2px var(--shadow),
      0 0 2px var(--shadow);
  }


  .poi[data-kind="forest"] .name {
    --shadow: var(--black);

    color: var(--white);
  }

  .poi[data-kind="mountain"] .name,
  .poi[data-kind="common-place"]:is([data-size="3"], [data-size="4"]) .name {
    color: var(--black);
  }

  .poi[data-kind="sea"] .name,
  .poi[data-kind="river"] .name {
    color: var(--water-label);
  }

  .poi[data-kind="river"] .name {
    font-style: italic;
  }

  .poi:is([data-kind="city"], [data-kind="hamlet"], [data-kind="fortress"]) .name {
    position: absolute;
    top: calc(100% + 1px);
    left: 50%;
    transform: translateX(-50%);
  }

  .poi:is([data-kind="city"], [data-kind="hamlet"], [data-kind="fortress"]) .dot {
    position: relative;
    background-color: var(--primary);
    aspect-ratio: 1;
    border: 2px solid var(--white);
    border-radius: 50%;
  }

  .poi[data-kind="fortress"] .dot {
    border-radius: 1px;
  }

  .poi[data-kind="hamlet"] .dot {
    border: none;
    transform: scale(0.7);
  }

  .illustration {
    display: block;
    height: auto;
    margin: 0 auto;
    transform: rotate(var(--illustration-rotation, 0deg));
    filter: drop-shadow(2px 2px 6px var(--shadow));
  }

  .illustration[hidden] {
    display: none;
  }
`;

export default styles;
