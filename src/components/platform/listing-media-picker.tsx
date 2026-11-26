"use client";

/**
 * Photo + video picker used inside the listing form. Purely presentational:
 * all state and uploads live in `useListingMedia`.
 *
 * Works the same on phones and desktops: every drop area is also a
 * tap-to-choose button (a <label> around a hidden file input), and all
 * thumbnail controls are visible without hover.
 */
import { useId, useState, type ReactNode } from "react";
import type { ListingMedia, MediaStatus, PhotoItem } from "@/lib/use-listing-media";
import {
  formatBytes,
  formatDuration,
  MAX_PHOTO_MB,
  MAX_PHOTOS,
  PHOTO_ACCEPT,
  VIDEO_ACCEPT,
  type VideoLimits,
} from "@/lib/listing-media";
import { Alert, Button } from "@/components/platform/ui-bits";

export function ListingMediaPicker({
  media,
  videoLimits,
  listingSaved,
  disabled = false,
}: {
  media: ListingMedia;
  videoLimits: VideoLimits;
  /** True once the listing exists, so files upload as soon as they are added. */
  listingSaved: boolean;
  disabled?: boolean;
}) {
  const { photos, video } = media;
  const roomLeft = MAX_PHOTOS - photos.length;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ photos */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-ink-strong">Photos</h3>
          <span className="text-xs font-medium text-ink-muted" aria-live="polite">
            {photos.length} of {MAX_PHOTOS} added
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">
          Up to {MAX_PHOTOS} photos · JPEG, PNG or WebP · {MAX_PHOTO_MB} MB each. The first photo is the cover.
        </p>

        {photos.length === 0 ? (
          <DropZone
            label="Add photos"
            accept={PHOTO_ACCEPT}
            multiple
            disabled={disabled}
            onFiles={(files) => void media.addPhotos(files)}
            className="mt-3 px-6 py-10"
          >
            <UploadIcon />
            <span className="text-sm font-semibold text-ink-strong">Add photos</span>
            <span className="text-xs text-ink-muted">Tap to choose, or drag them here</span>
          </DropZone>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo.key}
                photo={photo}
                isCover={index === 0}
                listingSaved={listingSaved}
                disabled={disabled}
                onRemove={() => void media.removePhoto(photo.key)}
                onCover={() => media.setCover(photo.key)}
                onRetry={() => media.retryPhoto(photo.key)}
              />
            ))}
            {roomLeft > 0 && (
              <li>
                <DropZone
                  label="Add more photos"
                  accept={PHOTO_ACCEPT}
                  multiple
                  disabled={disabled}
                  onFiles={(files) => void media.addPhotos(files)}
                  className="aspect-[4/3] h-full w-full"
                >
                  <UploadIcon />
                  <span className="text-xs font-semibold text-ink-strong">Add more</span>
                  <span className="text-[11px] text-ink-muted">{roomLeft} left</span>
                </DropZone>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------- video */}
      <div>
        <h3 className="font-semibold text-ink-strong">
          Video tour <span className="text-sm font-normal text-ink-muted">(optional)</span>
        </h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          One video · MP4, WebM or MOV · up to {videoLimits.maxMb} MB and {formatDuration(videoLimits.maxDurationSec)}.
        </p>

        {video ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-brand-100">
            <video
              src={video.previewUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-72 w-full bg-black"
              data-testid="listing-video"
            />
            <div className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-muted">
                  {[
                    video.durationSec ? formatDuration(video.durationSec) : null,
                    video.bytes ? formatBytes(video.bytes) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <StatusText status={video.status} listingSaved={listingSaved} />
              </div>
              {video.status === "uploading" && <ProgressBar value={video.progress} label="Video upload progress" />}
              {video.status === "error" && (
                <p className="text-xs font-medium text-red-600">{video.error}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {video.status === "error" && listingSaved && (
                  <Button type="button" size="sm" onClick={media.retryVideo} disabled={disabled}>
                    Try again
                  </Button>
                )}
                <DropZone
                  label="Replace video"
                  accept={VIDEO_ACCEPT}
                  disabled={disabled || video.status === "uploading"}
                  onFiles={(files) => files[0] && void media.addVideo(files[0])}
                  className="px-3 py-1.5"
                  compact
                >
                  <span className="text-xs font-semibold text-brand-700">Replace video</span>
                </DropZone>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void media.removeVideo()}
                  disabled={disabled || video.status === "uploading"}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <DropZone
            label="Add a video tour"
            accept={VIDEO_ACCEPT}
            disabled={disabled}
            onFiles={(files) => files[0] && void media.addVideo(files[0])}
            className="mt-3 px-6 py-6"
          >
            <VideoIcon />
            <span className="text-sm font-semibold text-ink-strong">Add a video tour</span>
            <span className="text-xs text-ink-muted">Tap to choose, or drag it here</span>
          </DropZone>
        )}
      </div>

      {media.messages.length > 0 && (
        <div aria-live="polite">
          <Alert tone="error">
            <span className="flex items-start justify-between gap-3">
              <span className="space-y-1">
                {media.messages.map((message) => (
                  <span key={message} className="block">{message}</span>
                ))}
              </span>
              <button type="button" onClick={media.dismissMessages} className="shrink-0 text-xs font-semibold underline">
                OK
              </button>
            </span>
          </Alert>
        </div>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  isCover,
  listingSaved,
  disabled,
  onRemove,
  onCover,
  onRetry,
}: {
  photo: PhotoItem;
  isCover: boolean;
  listingSaved: boolean;
  disabled: boolean;
  onRemove: () => void;
  onCover: () => void;
  onRetry: () => void;
}) {
  const busy = photo.status === "uploading";
  return (
    <li className="overflow-hidden rounded-xl border border-brand-100 bg-white">
      <div className="relative">
        { }
        <img
          src={photo.previewUrl}
          alt={photo.label}
          className={`aspect-[4/3] w-full object-cover ${photo.status === "error" ? "opacity-50" : ""}`}
        />
        {isCover && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Cover
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || busy}
          aria-label={`Remove ${photo.label}`}
          className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink-soft shadow hover:text-red-600 disabled:opacity-40"
        >
          ✕
        </button>
        {busy && (
          <div className="absolute inset-x-2 bottom-2">
            <ProgressBar value={photo.progress} label={`Uploading ${photo.label}`} />
          </div>
        )}
      </div>
      <div className="flex min-h-10 items-center justify-between gap-2 px-2 py-1.5">
        {photo.status === "error" ? (
          <>
            <span className="truncate text-[11px] font-medium text-red-600" title={photo.error}>
              {photo.error}
            </span>
            {listingSaved && (
              <button
                type="button"
                onClick={onRetry}
                disabled={disabled}
                className="shrink-0 text-xs font-semibold text-brand-700 underline"
              >
                Retry
              </button>
            )}
          </>
        ) : (
          <>
            <StatusText status={photo.status} listingSaved={listingSaved} />
            {!isCover && (
              <button
                type="button"
                onClick={onCover}
                disabled={disabled}
                className="shrink-0 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                Make cover
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function StatusText({ status, listingSaved }: { status: MediaStatus; listingSaved: boolean }) {
  const text: Record<MediaStatus, string> = {
    // Before the listing exists, files wait for the Save/Submit button.
    ready: listingSaved ? "Waiting…" : "Ready",
    uploading: "Uploading…",
    done: "Uploaded",
    error: "Not uploaded",
  };
  const tone = status === "done" ? "text-emerald-700" : status === "error" ? "text-red-600" : "text-ink-muted";
  return <span className={`whitespace-nowrap text-[11px] font-medium ${tone}`}>{text[status]}</span>;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/80 ring-1 ring-brand-100"
    >
      <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * Click/tap to choose, or drop files. Every dropped file is passed on
 * (even wrong types) so the checks can explain why one was refused.
 */
function DropZone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  className,
  compact = false,
  label,
  children,
}: {
  /** Accessible name for the hidden file input. */
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  /** Small inline button style instead of a dashed drop area. */
  compact?: boolean;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const look = compact
    ? "rounded-lg ring-1 ring-brand-200 hover:bg-brand-50"
    : `flex-col gap-1.5 rounded-xl border-2 border-dashed ${
        dragging ? "border-brand-600 bg-brand-50" : "border-brand-200 hover:border-brand-400 hover:bg-brand-50/40"
      }`;

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={`flex cursor-pointer items-center justify-center text-center transition-colors focus-within:ring-2 focus-within:ring-brand-500 ${look} ${
        disabled ? "pointer-events-none opacity-50" : ""
      } ${className ?? ""}`}
    >
      {children}
      <input
        id={inputId}
        type="file"
        aria-label={label}
        accept={accept}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // allow choosing the same file again later
          if (files.length > 0) onFiles(files);
        }}
      />
    </label>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" strokeLinejoin="round" />
    </svg>
  );
}
