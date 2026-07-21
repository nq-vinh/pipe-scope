export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number | undefined,
): number {
  const dpr = Math.max(1, devicePixelRatio || 1);
  const pixelWidth = Math.round(cssWidth * dpr);
  const pixelHeight = Math.round(cssHeight * dpr);

  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth;
  }

  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
}
