/**
 * Worker DOM & Canvas Shims for lottie-web
 *
 * Provides the global window, document, and 2D canvas context shims
 * needed by lottie-web's CanvasRenderer in Web Worker environments.
 */

if (typeof self !== "undefined") {
  const g = self as any;

  if (typeof g.window === "undefined") {
    g.window = self;
  }

  if (typeof g.navigator === "undefined") {
    g.navigator = { userAgent: "worker" };
  }

  const dummyElement = {
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    style: {},
  };

  const dummyCtx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    transform: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    scale: () => {},
    translate: () => {},
    rotate: () => {},
    arc: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => {},
    measureText: () => ({ width: 0 }),
    fillText: () => {},
    strokeText: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    canvas: { width: 1, height: 1 },
  };

  if (typeof g.document === "undefined") {
    g.document = {
      createElement: (tag: string) => {
        if (tag === "canvas" && typeof OffscreenCanvas !== "undefined") {
          try {
            return new OffscreenCanvas(1, 1);
          } catch {
            // fall through
          }
        }
        return {
          ...dummyElement,
          getContext: () => dummyCtx,
        };
      },
      getElementsByTagName: () => [],
      querySelectorAll: () => [],
      body: {
        ...dummyElement,
      },
    };
  }
}

export {};
