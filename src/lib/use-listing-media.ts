"use client";

/**
 * State and upload logic for a listing's photos and walkthrough video.
 *
 * How it fits the listing flow:
 * - Before the listing exists (new listing), added files are only checked
 *   and kept in the browser ("ready"). The form creates the listing as a
 *   draft on Save/Submit, then calls `uploadPending(id)` before submitting.
 * - Once the listing exists (edit, or a new listing already saved), added
 *   files upload straight away.
 *
 * Uploads run one at a time, in list order: the backend derives the cover
 * and sort order from the photo count, so parallel uploads to the same
 * listing could both be marked as cover. One photo per request also gives
 * each thumbnail its own progress bar and its own retry.
 *
 * The first photo in the list is the cover. The list is the source of
 * truth; `syncCover` brings the server in line whenever the first photo is
 * stored and differs from the server's cover.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiUpload, ApiRequestError } from "@/lib/api";
import { checkPhoto, checkVideo, MAX_PHOTOS, type VideoLimits } from "@/lib/listing-media";

export type MediaStatus = "ready" | "uploading" | "done" | "error";

export type PhotoItem = {
  /** Stable client-side key (server id for stored photos). */
  key: string;
  previewUrl: string;
  label: string;
  status: MediaStatus;
  /** Upload progress, 0..1. */
  progress: number;
  error?: string;
  /** Present until the photo is stored. */
  file?: File;
  /** Present once the photo is stored. */
  imageId?: string;
};

export type VideoItem = {
  previewUrl: string;
  status: MediaStatus;
  progress: number;
  error?: string;
  file?: File;
  durationSec: number | null;
  bytes: number | null;
};

export type StoredImage = { id: string; url: string; label: string; isCover?: boolean };
export type StoredVideo = { url: string; bytes?: number | null; durationSec?: number | null };

/** Same identity check browsers use for "the same file picked twice". */
function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function uploadErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `local-${keyCounter}`;
}

export function useListingMedia({
  propertyId,
  videoLimits,
}: {
  /** The listing's id once it exists; undefined for a new, unsaved listing. */
  propertyId: string | undefined;
  videoLimits: VideoLimits;
}) {
  // NON-STANDARD: state is mirrored in refs so the sequential upload queue
  // always reads the latest list (React state captured in an async loop
  // would be stale). Standard alternative: a reducer + effect-driven queue,
  // which is harder to follow for a one-at-a-time upload loop.
  const photosRef = useRef<PhotoItem[]>([]);
  const videoRef = useRef<VideoItem | null>(null);
  const [photos, setPhotosState] = useState<PhotoItem[]>([]);
  const [video, setVideoState] = useState<VideoItem | null>(null);
  /** Friendly messages about files that were not accepted. */
  const [messages, setMessages] = useState<string[]>([]);

  const serverCoverRef = useRef<string | null>(null);
  const propertyIdRef = useRef(propertyId);
  useEffect(() => {
    propertyIdRef.current = propertyId;
  }, [propertyId]);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const objectUrlsRef = useRef(new Set<string>());

  const setPhotos = useCallback((update: (prev: PhotoItem[]) => PhotoItem[]) => {
    photosRef.current = update(photosRef.current);
    setPhotosState(photosRef.current);
  }, []);
  const setVideo = useCallback((update: (prev: VideoItem | null) => VideoItem | null) => {
    videoRef.current = update(videoRef.current);
    setVideoState(videoRef.current);
  }, []);
  const patchPhoto = useCallback(
    (key: string, patch: Partial<PhotoItem>) =>
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p))),
    [setPhotos],
  );
  const patchVideo = useCallback(
    (patch: Partial<VideoItem>) => setVideo((prev) => (prev ? { ...prev, ...patch } : prev)),
    [setVideo],
  );

  const createPreview = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  }, []);
  const releasePreview = useCallback((url: string) => {
    if (objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  // Free every local preview when the form goes away.
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  /** Run upload work strictly one task after another. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  /** Load what the listing already has stored (edit mode). */
  const initialise = useCallback(
    (images: StoredImage[], storedVideo: StoredVideo | null) => {
      // The API lists the cover first; keep it first so it stays the cover.
      const ordered = [...images].sort((a, b) => Number(Boolean(b.isCover)) - Number(Boolean(a.isCover)));
      serverCoverRef.current = ordered.find((img) => img.isCover)?.id ?? null;
      setPhotos(() =>
        ordered.map((img) => ({
          key: img.id,
          imageId: img.id,
          previewUrl: img.url,
          label: img.label,
          status: "done",
          progress: 1,
        })),
      );
      setVideo(() =>
        storedVideo
          ? {
              previewUrl: storedVideo.url,
              status: "done",
              progress: 1,
              durationSec: storedVideo.durationSec ?? null,
              bytes: storedVideo.bytes ?? null,
            }
          : null,
      );
    },
    [setPhotos, setVideo],
  );

  /** Make the server's cover match the first stored photo in the list. */
  const syncCover = useCallback(async () => {
    const first = photosRef.current[0];
    if (!first?.imageId || first.imageId === serverCoverRef.current) return;
    try {
      await apiFetch(`/uploads/property-image/${first.imageId}/cover`, { method: "PATCH" });
      serverCoverRef.current = first.imageId;
    } catch (err) {
      setMessages((prev) => [...prev, uploadErrorMessage(err, "We couldn't update the cover photo. Try again.")]);
    }
  }, []);

  const uploadPhoto = useCallback(
    async (id: string, key: string): Promise<boolean> => {
      const item = photosRef.current.find((p) => p.key === key);
      if (!item?.file) return true; // removed meanwhile, or already stored
      patchPhoto(key, { status: "uploading", progress: 0, error: undefined });
      try {
        const formData = new FormData();
        formData.append("files", item.file);
        formData.append("propertyId", id);
        const data = await apiUpload<{ images: StoredImage[] }>("/uploads/property-image", formData, {
          onProgress: (fraction) => patchPhoto(key, { progress: fraction }),
        });
        const stored = data.images[0];
        if (stored.isCover) serverCoverRef.current = stored.id;
        patchPhoto(key, { status: "done", progress: 1, imageId: stored.id, file: undefined });
        return true;
      } catch (err) {
        patchPhoto(key, { status: "error", error: uploadErrorMessage(err, "Upload failed.") });
        return false;
      }
    },
    [patchPhoto],
  );

  const uploadVideo = useCallback(
    async (id: string): Promise<boolean> => {
      const item = videoRef.current;
      if (!item?.file || item.durationSec == null) return true;
      const file = item.file;
      patchVideo({ status: "uploading", progress: 0, error: undefined });
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("propertyId", id);
        formData.append("durationSec", String(item.durationSec));
        const data = await apiUpload<{ video: StoredVideo }>("/uploads/property-video", formData, {
          onProgress: (fraction) => patchVideo({ progress: fraction }),
        });
        // Only mark done if the provider hasn't swapped in another video meanwhile.
        if (videoRef.current?.file === file) {
          patchVideo({ status: "done", progress: 1, file: undefined, bytes: data.video.bytes ?? item.bytes });
        }
        return true;
      } catch (err) {
        if (videoRef.current?.file === file) {
          patchVideo({ status: "error", error: uploadErrorMessage(err, "Video upload failed.") });
        }
        return false;
      }
    },
    [patchVideo],
  );

  /**
   * Upload everything not yet stored (including earlier failures), then fix
   * the cover. Resolves with how many files still failed.
   */
  const uploadPending = useCallback(
    (id: string, { includeFailed }: { includeFailed: boolean } = { includeFailed: true }) =>
      enqueue(async () => {
        let failed = 0;
        const waiting = (status: MediaStatus) => status === "ready" || (includeFailed && status === "error");
        for (const photo of photosRef.current.filter((p) => p.file && waiting(p.status))) {
          if (!(await uploadPhoto(id, photo.key))) failed += 1;
        }
        const pendingVideo = videoRef.current;
        if (pendingVideo?.file && waiting(pendingVideo.status)) {
          if (!(await uploadVideo(id))) failed += 1;
        }
        await syncCover();
        return { failed };
      }),
    [enqueue, uploadPhoto, uploadVideo, syncCover],
  );

  /** Start uploading new files right away when the listing already exists. */
  const autoUpload = useCallback(() => {
    const id = propertyIdRef.current;
    if (id) void uploadPending(id, { includeFailed: false });
  }, [uploadPending]);

  const addPhotos = useCallback(
    async (files: File[]) => {
      const rejected: string[] = [];
      const accepted: File[] = [];
      for (const file of files) {
        const known = [...accepted, ...photosRef.current.flatMap((p) => (p.file ? [p.file] : []))];
        if (known.some((f) => sameFile(f, file))) {
          rejected.push(`${file.name} is already added.`);
          continue;
        }
        const reason = await checkPhoto(file);
        if (reason) rejected.push(reason);
        else accepted.push(file);
      }
      const room = MAX_PHOTOS - photosRef.current.length;
      if (accepted.length > room) {
        const skipped = accepted.length - Math.max(room, 0);
        rejected.push(
          `A listing can have up to ${MAX_PHOTOS} photos, so ${skipped} ${skipped === 1 ? "photo was" : "photos were"} not added.`,
        );
        accepted.splice(Math.max(room, 0));
      }
      setMessages(rejected);
      if (accepted.length === 0) return;
      setPhotos((prev) => [
        ...prev,
        ...accepted.map((file) => ({
          key: nextKey(),
          file,
          previewUrl: createPreview(file),
          label: file.name.replace(/\.[a-z0-9]+$/i, "") || "Photo",
          status: "ready" as const,
          progress: 0,
        })),
      ]);
      autoUpload();
    },
    [setPhotos, createPreview, autoUpload],
  );

  const removePhoto = useCallback(
    async (key: string) => {
      const item = photosRef.current.find((p) => p.key === key);
      // An in-flight upload cannot be cancelled cleanly; the button is
      // disabled meanwhile, and this guard backs that up.
      if (!item || item.status === "uploading") return;
      if (item.imageId) {
        const imageId = item.imageId;
        try {
          // Queued with uploads and cover changes: a delete racing a cover
          // change let the server promote a second cover photo.
          await enqueue(() => apiFetch(`/uploads/property-image/${imageId}`, { method: "DELETE" }));
        } catch (err) {
          setMessages([uploadErrorMessage(err, "We couldn't remove that photo. Try again.")]);
          return;
        }
        // The server promotes another photo when the cover is deleted; we
        // no longer know which, so let syncCover set the one we show first.
        if (item.imageId === serverCoverRef.current) serverCoverRef.current = null;
      }
      releasePreview(item.previewUrl);
      setPhotos((prev) => prev.filter((p) => p.key !== key));
      if (propertyIdRef.current) void enqueue(syncCover);
    },
    [setPhotos, releasePreview, enqueue, syncCover],
  );

  const setCover = useCallback(
    (key: string) => {
      setPhotos((prev) => {
        const chosen = prev.find((p) => p.key === key);
        return chosen ? [chosen, ...prev.filter((p) => p.key !== key)] : prev;
      });
      // A photo still waiting to upload becomes the cover once it is stored.
      if (propertyIdRef.current) void enqueue(syncCover);
    },
    [setPhotos, enqueue, syncCover],
  );

  const retryPhoto = useCallback(
    (key: string) => {
      const id = propertyIdRef.current;
      if (!id) return;
      void enqueue(async () => {
        await uploadPhoto(id, key);
        await syncCover();
      });
    },
    [enqueue, uploadPhoto, syncCover],
  );

  const addVideo = useCallback(
    async (file: File) => {
      if (videoRef.current?.status === "uploading") {
        setMessages(["Wait for the current video to finish uploading before replacing it."]);
        return;
      }
      const result = await checkVideo(file, videoLimits);
      if (!result.ok) {
        setMessages([result.reason]);
        return;
      }
      setMessages([]);
      setVideo((prev) => {
        if (prev) releasePreview(prev.previewUrl);
        return {
          file,
          previewUrl: createPreview(file),
          status: "ready",
          progress: 0,
          durationSec: result.durationSec,
          bytes: file.size,
        };
      });
      autoUpload();
    },
    [videoLimits, setVideo, releasePreview, createPreview, autoUpload],
  );

  const removeVideo = useCallback(async () => {
    const item = videoRef.current;
    if (!item || item.status === "uploading") return;
    // Once the listing exists, always clear the server copy: a not-yet-
    // uploaded replacement may be hiding a stored video. The endpoint is
    // safe to call when nothing is stored.
    const id = propertyIdRef.current;
    if (id) {
      try {
        await enqueue(() => apiFetch("/uploads/property-video", { method: "DELETE", body: { propertyId: id } }));
      } catch (err) {
        setMessages([uploadErrorMessage(err, "We couldn't remove the video. Try again.")]);
        return;
      }
    }
    releasePreview(item.previewUrl);
    setVideo(() => null);
  }, [setVideo, releasePreview, enqueue]);

  const retryVideo = useCallback(() => {
    const id = propertyIdRef.current;
    if (id) void enqueue(() => uploadVideo(id));
  }, [enqueue, uploadVideo]);

  const uploading = photos.some((p) => p.status === "uploading") || video?.status === "uploading";
  const failedCount = photos.filter((p) => p.status === "error").length + (video?.status === "error" ? 1 : 0);
  const unsavedCount =
    photos.filter((p) => p.status !== "done").length + (video && video.status !== "done" ? 1 : 0);

  return {
    photos,
    video,
    messages,
    dismissMessages: () => setMessages([]),
    uploading,
    failedCount,
    /** Files not yet stored on the server (ready, uploading or failed). */
    unsavedCount,
    initialise,
    addPhotos,
    removePhoto,
    setCover,
    retryPhoto,
    addVideo,
    removeVideo,
    retryVideo,
    uploadPending,
  };
}

export type ListingMedia = ReturnType<typeof useListingMedia>;
