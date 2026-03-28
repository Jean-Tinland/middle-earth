const styles = /* css */ `
:host {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100svh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--black);
  user-select: none;
  opacity: 0;
}

:host([ready]) {
  opacity: 1;
}

.canvas {
  --padding: 10px;

  position: relative;
  width: auto;
  max-width: 100vw;
  height: auto;
  max-height: 100vh;
  max-height: 100svh;
  display: flex;
  cursor: grab;
  touch-action: none;
  transform-origin: center center;
}

@supports (-webkit-touch-callout: none) {
  .canvas {
    --padding: 6px;
  }
}

.canvas::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background-image: url("./assets/images/paper-background.jpg");
  background-size: cover;
  opacity: 30%;
  mix-blend-mode: multiply;
  z-index: 1;
}

@supports (-webkit-touch-callout: none) {
  .canvas::after {
    mix-blend-mode: normal;
  }
}

.map {
  position: relative;
  aspect-ratio: 3600 / 2600;
  width: inherit;
  max-width: inherit;
  height: inherit;
  max-height: inherit;
  display: flex;
  pointer-events: none;
}

.map > svg {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

:host([ready]) map-pois {
  display: flex !important;
}

map-pois {
  display: none;
  z-index: 1;
}
`;

export default styles;
