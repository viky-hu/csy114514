import assert from "node:assert/strict";
import test from "node:test";

import {
  AVATAR_EXPORT_SIZE,
  AVATAR_PREVIEW_SIZE,
  avatarCanvasToFile,
  createAvatarCanvas,
  loadImageFromSource,
  normalizeCropArea,
  renderAvatarCropToCanvas,
} from "./avatar-image.ts";

test("normalizeCropArea clamps crop pixels to the decoded image bounds", () => {
  assert.deepEqual(
    normalizeCropArea({ x: -12, y: 80, width: 140, height: 60 }, 100, 100),
    { x: 0, y: 80, width: 100, height: 20 },
  );
  assert.deepEqual(
    normalizeCropArea({ x: 20.8, y: 10.2, width: 40.4, height: 40.4 }, 100, 100),
    { x: 20, y: 10, width: 40, height: 40 },
  );
});

test("normalizeCropArea rejects zero-sized images and crop regions", () => {
  assert.equal(normalizeCropArea({ x: 0, y: 0, width: 0, height: 20 }, 100, 100), null);
  assert.equal(normalizeCropArea({ x: 0, y: 0, width: 20, height: 20 }, 0, 100), null);
});

test("avatar crop rendering uses fixed output sizes and high-quality smoothing", () => {
  const drawCalls: unknown[][] = [];
  const context = {
    drawImage: (...args: unknown[]) => drawCalls.push(args),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  };
  const canvas = {
    getContext: () => context,
    height: 0,
    width: 0,
  };
  const image = { naturalHeight: 800, naturalWidth: 1200 };

  const result = renderAvatarCropToCanvas(
    image as never,
    { x: 100, y: 50, width: 400, height: 400 },
    AVATAR_PREVIEW_SIZE,
    () => canvas as never,
  );

  assert.equal(AVATAR_PREVIEW_SIZE, 256);
  assert.equal(AVATAR_EXPORT_SIZE, 512);
  assert.equal(result, canvas);
  assert.equal(canvas.width, 256);
  assert.equal(canvas.height, 256);
  assert.equal(context.imageSmoothingEnabled, true);
  assert.equal(context.imageSmoothingQuality, "high");
  assert.deepEqual(drawCalls[0]?.slice(1), [100, 50, 400, 400, 0, 0, 256, 256]);
});

test("createAvatarCanvas reports missing browser Canvas support", () => {
  assert.throws(() => createAvatarCanvas(256), /当前浏览器不支持头像裁剪/);
});

test("loadImageFromSource reports missing browser image decoding support", async () => {
  await assert.rejects(loadImageFromSource("blob:avatar-source"), /当前浏览器不支持头像裁剪/);
});

test("avatarCanvasToFile rejects failed and oversized PNG exports", async () => {
  const failedCanvas = { toBlob: (callback: BlobCallback) => callback(null) };
  await assert.rejects(
    avatarCanvasToFile(failedCanvas as HTMLCanvasElement, "portrait.jpg"),
    /头像导出失败/,
  );

  const oversizedBlob = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" });
  const oversizedCanvas = { toBlob: (callback: BlobCallback) => callback(oversizedBlob) };
  await assert.rejects(
    avatarCanvasToFile(oversizedCanvas as HTMLCanvasElement, "portrait.jpg"),
    /超过 2MB/,
  );
});

test("avatarCanvasToFile normalizes the exported file name and type", async () => {
  const pngBlob = new Blob(["avatar"], { type: "image/png" });
  const canvas = { toBlob: (callback: BlobCallback) => callback(pngBlob) };
  const file = await avatarCanvasToFile(canvas as HTMLCanvasElement, "portrait.webp");

  assert.equal(file.name, "portrait.png");
  assert.equal(file.type, "image/png");
});
