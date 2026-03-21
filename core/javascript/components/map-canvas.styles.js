const styles = /* css */ `
:host {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
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

.cover {
  display: none;
}

:host([ready]) .cover {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.left-cover,
.right-cover {
  position: relative;
  flex: 0 0 50%;
  background-color: var(--paper);
  overflow: hidden;
  box-shadow: var(--shadow-300);
  animation: cover-reveal 2560ms var(--transition-easing) forwards;
}

@keyframes cover-reveal {
  100% {
    transform: translateX(var(--translateX)) scaleX(0.1);
  }
}

.left-cover {
  --translateX: -100%;
}

.right-cover {
  --translateX: 100%;
}

.left-cover::before,
.right-cover::before {
  content: "";
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  background-image: url("./assets/images/paper-background.jpg");
  background-size: cover;
  opacity: 50%;
}


.left-cover::after,
.right-cover::after {
  content: "";
  position: absolute;
  top: 0;
  width: 10%;
  height: 100%;
  opacity: 50%;
  background-color: var(--paper);
  animation: loader-paper-growing 2560ms var(--transition-easing) forwards;
}

@keyframes loader-paper-growing {
  100% {
    transform: scaleX(30);
    box-shadow: 0 0 0px 0px rgba(0, 0, 0, 0.5);
  }
}

.left-cover::after {
  right: 0;
  box-shadow: 0 0 10px 10px rgba(0, 0, 0, 0.5);
}

.right-cover::after {
  left: 0;
  box-shadow: 0 0 10px 10px rgba(0, 0, 0, 0.5);
}

`;

export default styles;
