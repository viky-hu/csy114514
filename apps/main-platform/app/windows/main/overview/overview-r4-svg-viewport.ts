export type R4ViewBox = {
  height: number;
  width: number;
};

export type SvgViewportMetrics = {
  height: number;
  offsetLeft: number;
  offsetTop: number;
  scale: number;
  width: number;
};

export type SvgUserRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type FrameRectStyle = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type MeetViewportInput = {
  frameHeight: number;
  frameWidth: number;
  viewBox: R4ViewBox;
};

export function calculateMeetViewport({
  frameHeight,
  frameWidth,
  viewBox,
}: MeetViewportInput): SvgViewportMetrics {
  if (
    frameHeight <= 0 ||
    frameWidth <= 0 ||
    viewBox.height <= 0 ||
    viewBox.width <= 0
  ) {
    return {
      height: 0,
      offsetLeft: 0,
      offsetTop: 0,
      scale: 0,
      width: 0,
    };
  }

  const scale = Math.min(frameWidth / viewBox.width, frameHeight / viewBox.height);
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;

  return {
    height,
    offsetLeft: (frameWidth - width) / 2,
    offsetTop: (frameHeight - height) / 2,
    scale,
    width,
  };
}

export function svgUserRectToFrameStyle(
  rect: SvgUserRect,
  metrics: SvgViewportMetrics,
): FrameRectStyle {
  return {
    height: (rect.bottom - rect.top) * metrics.scale,
    left: metrics.offsetLeft + rect.left * metrics.scale,
    top: metrics.offsetTop + rect.top * metrics.scale,
    width: (rect.right - rect.left) * metrics.scale,
  };
}

export function measureSvgViewportMetrics(
  svg: SVGSVGElement,
  frame: HTMLElement,
  viewBox: R4ViewBox,
): SvgViewportMetrics {
  const frameBounds = frame.getBoundingClientRect();
  const matrix = svg.getScreenCTM();

  if (!matrix) {
    return calculateMeetViewport({
      frameHeight: frameBounds.height,
      frameWidth: frameBounds.width,
      viewBox,
    });
  }

  const scale = Math.abs(matrix.a);

  return {
    height: viewBox.height * scale,
    offsetLeft: matrix.e - frameBounds.left,
    offsetTop: matrix.f - frameBounds.top,
    scale,
    width: viewBox.width * scale,
  };
}

export function clientPointToSvgUserPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
) {
  const matrix = svg.getScreenCTM()?.inverse();

  if (!matrix) {
    return null;
  }

  return new DOMPoint(clientX, clientY).matrixTransform(matrix);
}
