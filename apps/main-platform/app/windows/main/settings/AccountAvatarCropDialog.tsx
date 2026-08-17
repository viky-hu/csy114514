"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Crop, LoaderCircle, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  AVATAR_PREVIEW_SIZE,
  cropAvatarImageToDataUrl,
  cropAvatarImageToFile,
} from "./avatar-image";

type AccountAvatarCropDialogProps = {
  sourceName: string;
  sourceUrl: string;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
};

export function AccountAvatarCropDialog({
  sourceName,
  sourceUrl,
  onCancel,
  onConfirm,
}: AccountAvatarCropDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    busyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled])",
      ));
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
        : currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
      event.preventDefault();
      focusable[nextIndex]?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCropPixels(areaPixels);
    setError(null);
  }, []);

  useEffect(() => {
    if (!cropPixels) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void cropAvatarImageToDataUrl(sourceUrl, cropPixels, AVATAR_PREVIEW_SIZE)
        .then((value) => {
          if (active) setPreviewUrl(value);
        })
        .catch((caught) => {
          if (active) setError(caught instanceof Error ? caught.message : "头像预览生成失败");
        });
    }, 80);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cropPixels, sourceUrl]);

  const confirmCrop = async () => {
    if (!cropPixels || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const [file, finalPreviewUrl] = await Promise.all([
        cropAvatarImageToFile(sourceUrl, cropPixels, sourceName),
        cropAvatarImageToDataUrl(sourceUrl, cropPixels, AVATAR_PREVIEW_SIZE),
      ]);
      onConfirm(file, finalPreviewUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "头像裁剪失败，请重试");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="account-settings-dialog-layer account-avatar-crop-layer" role="presentation">
      <button
        aria-label="关闭头像裁剪窗口"
        className="account-settings-dialog-backdrop"
        onClick={() => { if (!isBusy) onCancel(); }}
        type="button"
      />
      <div
        ref={dialogRef}
        aria-labelledby="account-avatar-crop-title"
        aria-modal="true"
        className="account-settings-dialog account-avatar-crop-dialog"
        role="dialog"
      >
        <header className="account-settings-dialog-header">
          <div>
            <span className="account-settings-dialog-eyebrow">PROFILE IMAGE</span>
            <h2 id="account-avatar-crop-title"><Crop size={17} /> 调整头像</h2>
          </div>
          <button ref={closeButtonRef} aria-label="关闭头像裁剪窗口" className="account-settings-dialog-close" disabled={isBusy} onClick={onCancel} title="关闭" type="button"><X size={17} /></button>
        </header>

        <div className="account-avatar-crop-body">
          <div className="account-avatar-crop-editor">
            <div className="account-avatar-crop-stage">
              <Cropper
                aspect={1}
                crop={crop}
                image={sourceUrl}
                maxZoom={3.2}
                minZoom={1}
                restrictPosition
                showGrid={false}
                zoom={zoom}
                zoomWithScroll
                onCropChange={setCrop}
                onCropComplete={handleCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <label className="account-avatar-zoom-control">
              <ZoomOut aria-hidden="true" size={15} />
              <span className="account-settings-visually-hidden">头像缩放</span>
              <input aria-label="头像缩放" disabled={isBusy} max={3.2} min={1} onChange={(event) => setZoom(Number(event.target.value))} step={0.05} type="range" value={zoom} />
              <ZoomIn aria-hidden="true" size={15} />
            </label>
          </div>
          <aside className="account-avatar-crop-preview" aria-label="头像裁剪预览">
            <span>实时预览</span>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previewUrl ? <img alt="裁剪后的头像预览" src={previewUrl} /> : <LoaderCircle aria-hidden="true" className="is-spinning" size={18} />}
            </div>
            <small>512 × 512 PNG</small>
          </aside>
        </div>

        {error ? <p className="account-settings-inline-error account-avatar-crop-error" role="alert">{error}</p> : null}
        <div className="account-settings-dialog-actions account-avatar-crop-actions">
          <button className="account-settings-secondary-button" disabled={isBusy} onClick={onCancel} type="button">取消</button>
          <button className="account-settings-primary-button" disabled={!cropPixels || isBusy} onClick={() => void confirmCrop()} type="button">
            {isBusy ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} /> : <Crop aria-hidden="true" size={16} />}
            {isBusy ? "处理中" : "确认裁剪"}
          </button>
        </div>
      </div>
    </div>
  );
}
