import { MAX_AVATAR_BYTES } from "./account-settings.ts";

export const AVATAR_PREVIEW_SIZE = 256;
export const AVATAR_EXPORT_SIZE = 512;

export type AvatarCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AvatarImage = CanvasImageSource & {
  naturalHeight: number;
  naturalWidth: number;
};

export function normalizeCropArea(
  area: AvatarCropArea,
  imageWidth: number,
  imageHeight: number,
): AvatarCropArea | null {
  const safeImageWidth = Math.floor(imageWidth);
  const safeImageHeight = Math.floor(imageHeight);
  const requestedWidth = Math.floor(area.width);
  const requestedHeight = Math.floor(area.height);
  if (safeImageWidth <= 0 || safeImageHeight <= 0 || requestedWidth <= 0 || requestedHeight <= 0) {
    return null;
  }

  const x = Math.max(0, Math.min(Math.floor(area.x), safeImageWidth - 1));
  const y = Math.max(0, Math.min(Math.floor(area.y), safeImageHeight - 1));
  const width = Math.min(requestedWidth, safeImageWidth - x);
  const height = Math.min(requestedHeight, safeImageHeight - y);
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export function loadImageFromSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("当前浏览器不支持头像裁剪"));
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，请重新选择"));
    image.src = source;
  });
}

export function createAvatarCanvas(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("头像输出尺寸无效");
  }
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new Error("当前浏览器不支持头像裁剪");
  }
  return document.createElement("canvas");
}

export function renderAvatarCropToCanvas(
  image: AvatarImage,
  area: AvatarCropArea,
  size: number,
  canvasFactory: (size: number) => HTMLCanvasElement = createAvatarCanvas,
) {
  const normalized = normalizeCropArea(area, image.naturalWidth, image.naturalHeight);
  if (!normalized) throw new Error("裁剪区域无效，请重新调整图片");

  const canvas = canvasFactory(size);
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器不支持头像裁剪");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    normalized.x,
    normalized.y,
    normalized.width,
    normalized.height,
    0,
    0,
    size,
    size,
  );
  return canvas;
}

export async function cropAvatarImageToDataUrl(
  source: string,
  area: AvatarCropArea,
  size = AVATAR_PREVIEW_SIZE,
) {
  const image = await loadImageFromSource(source);
  const canvas = renderAvatarCropToCanvas(image, area, size);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error("头像预览生成失败，请重新调整图片");
  }
}

export async function cropAvatarImageToFile(
  source: string,
  area: AvatarCropArea,
  sourceName = "avatar",
) {
  const image = await loadImageFromSource(source);
  const canvas = renderAvatarCropToCanvas(image, area, AVATAR_EXPORT_SIZE);
  return avatarCanvasToFile(canvas, sourceName);
}

export async function avatarCanvasToFile(
  canvas: HTMLCanvasElement,
  sourceName = "avatar",
) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") {
      reject(new Error("当前浏览器不支持头像导出"));
      return;
    }
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("头像导出失败，请重新调整图片"));
    }, "image/png");
  });
  if (blob.size > MAX_AVATAR_BYTES) {
    throw new Error("裁剪后的头像超过 2MB，请更换图片");
  }
  const safeStem = sourceName.replace(/\.[^.]+$/, "").trim() || "avatar";
  return new File([blob], `${safeStem}.png`, { type: "image/png" });
}
