const styles = /* css */ `
  :host {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .poi {
    position: absolute;
    transform: translate(-50%, -50%);
  }

  .poi[data-kind="region"],
  .poi[data-kind="sub-region"] {
    font-family: var(--title-font);
    text-transform: uppercase;
  }

  .poi[data-kind="region"] {
    font-size: var(--font-size-ref);
    font-weight: 600;
  }

  .poi[data-kind="sub-region"] {
    font-size: calc(var(--font-size-ref) * 0.7);
    font-weight: 500;
  }

  .name {
    color: var(--primary);
    text-shadow: 0.02rem 0.02rem 0px var(--paper), 0.02rem -0.02rem 0px var(--paper), 
      -0.02rem 0.02rem 0px var(--paper), -0.02rem -0.02rem 0px var(--paper);
  }
`;

export default styles;
