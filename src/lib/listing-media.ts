"use client";

/**
 * Listing media rules shared by the property form: limits, client-side
 * checks and small display helpers.
 *
 * The backend enforces every rule again (type + file signature, size,
 * count, admin video limits); these checks exist so a provider gets a
 * friendly message *before* waiting for an upload that would fail.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// ------------------------------------------------------------- limits

/** Photo limits — kept in sync with the backend (MAX_IMAGE_BYTES, MAX_PHOTOS_PER_LISTING). */
export const MAX_PHOTO_MB = 5;
export const MAX_PHOTOS = 10;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");

export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const VIDEO_ACCEPT = VIDEO_TYPES.join(",");

/** Fallback video limits, used until (or if) the admin settings load. Match the backend defaults. */
export const DEFAULT_VIDEO_MAX_MB = 50;
export const DEFAULT_VIDEO_MAX_DURATION_SEC = 120;

/** How long to wait for the browser to read a video's length before giving up. */
const VIDEO_PROBE_TIMEOUT_MS = 15_000;

const BYTES_PER_MB = 1024 * 1024;
const SECONDS_PER_MINUTE = 60;

export type VideoLimits = { maxMb: number; maxDurationSec: number };

// ------------------------------------------------------------- photos

/** Number of leading bytes needed to recognise JPEG, PNG and WebP. */
const SIGNATURE_BYTES = 12;

/**
 * Check the file's first bytes, not just its name/type: a renamed file
 * would otherwise pass here and only fail after uploading.
 */
async function hasImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  const isWebp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  return isJpeg || isPng || isWebp;
}

/** Returns a friendly reason the photo cannot be used, or null when it is fine. */
export async function checkPhoto(file: File): Promise<string | null> {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} isn't a JPEG, PNG or WebP photo.`;
  }
  if (file.size > MAX_PHOTO_MB * BYTES_PER_MB) {
    return `${file.name} is ${formatBytes(file.size)} — photos must be ${MAX_PHOTO_MB} MB or smaller.`;
  }
  if (file.size === 0 || !(await hasImageSignature(file))) {
    return `${file.name} looks damaged or isn't really an image.`;
  }
  return null;
}

// -------------------------------------------------------------- video

/**
 * Read a video's length in seconds with a hidden <video> element.
 * Rejects when the browser cannot play the file or never reports a length.
 */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const finish = (outcome: () => void) => {
      window.clearTimeout(timer);
      probe.removeAttribute("src");
      URL.revokeObjectURL(objectUrl);
      outcome();
    };
    const timer = window.setTimeout(
      () => finish(() => reject(new Error("timeout"))),
      VIDEO_PROBE_TIMEOUT_MS,
    );
    probe.preload = "metadata";
    probe.muted = true;
    probe.onloadedmetadata = () => {
      const duration = probe.duration;
      // Some recordings (e.g. browser-made WebM) report Infinity/NaN.
      if (Number.isFinite(duration) && duration > 0) finish(() => resolve(duration));
      else finish(() => reject(new Error("unknown duration")));
    };
    probe.onerror = () => finish(() => reject(new Error("unplayable")));
    probe.src = objectUrl;
  });
}

/**
 * Check a video against the admin limits. Returns either the measured
 * duration (whole seconds, at least 1 — the API rejects 0) or a reason.
 */
export async function checkVideo(
  file: File,
  limits: VideoLimits,
): Promise<{ ok: true; durationSec: number } | { ok: false; reason: string }> {
  if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: `${file.name} isn't an MP4, WebM or MOV video.` };
  }
  if (file.size > limits.maxMb * BYTES_PER_MB) {
    return {
      ok: false,
      reason: `${file.name} is ${formatBytes(file.size)} — videos must be ${limits.maxMb} MB or smaller.`,
    };
  }
  let seconds: number;
  try {
    seconds = await readVideoDuration(file);
  } catch {
    return {
      ok: false,
      reason: `We couldn't read the length of ${file.name}. Try saving it as an MP4 and adding it again.`,
    };
  }
  const durationSec = Math.max(1, Math.round(seconds));
  if (durationSec > limits.maxDurationSec) {
    return {
      ok: false,
      reason: `${file.name} is ${formatDuration(durationSec)} long — videos can be up to ${formatDuration(limits.maxDurationSec)}.`,
    };
  }
  return { ok: true, durationSec };
}

/**
 * Admin-managed video limits from the public settings endpoint. The
 * defaults stay in place while loading or if the settings are unreachable
 * (the backend still enforces the real limits).
 */
export function useVideoLimits(): VideoLimits {
  const [limits, setLimits] = useState<VideoLimits>({
    maxMb: DEFAULT_VIDEO_MAX_MB,
    maxDurationSec: DEFAULT_VIDEO_MAX_DURATION_SEC,
  });

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ settings: Record<string, string> }>("/settings/public")
      .then((data) => {
        if (cancelled) return;
        setLimits({
          maxMb: positiveOr(Number(data.settings.videoMaxMb), DEFAULT_VIDEO_MAX_MB),
          maxDurationSec: positiveOr(Number(data.settings.videoMaxDurationSec), DEFAULT_VIDEO_MAX_DURATION_SEC),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return limits;
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// ------------------------------------------------------------ display

export function formatBytes(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** 95 → "1:35", 120 → "2 min", 45 → "45 sec". */
export function formatDuration(totalSec: number): string {
  if (totalSec < SECONDS_PER_MINUTE) return `${totalSec} sec`;
  const minutes = Math.floor(totalSec / SECONDS_PER_MINUTE);
  const seconds = totalSec % SECONDS_PER_MINUTE;
  return seconds === 0 ? `${minutes} min` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}
