import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera as CameraIcon, Images, Play, SwitchCamera, Type, X } from "lucide-react";
import { addRecentCapture, useRecentCaptures } from "../lib/recentCaptures";
import { convertHeicFiles, isHeicFile } from "../lib/heicConversion";
import { Button } from "./ui/button";
import { UPLOAD_COPY } from "../lib/stateCopy";
import { ImageWithFallback } from "./ImageWithFallback";
import { withFirstFrame } from "../lib/mediaUrl";

/** Confirmed with product: 60s, matching Instagram-length clips — long enough
 * for a real moment, short enough that this stays a quick-capture tool
 * rather than growing into a video editor (explicitly out of scope). */
const MAX_VIDEO_SECONDS = 60;

type CaptureMode = "photo" | "video";

function pickMimeType(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of candidates) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // isTypeSupported itself can throw in some browsers — fall through
    }
  }
  return undefined;
}

function extFor(mimeType: string | undefined) {
  if (!mimeType) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
}

/**
 * The live viewfinder someone actually reaches once they've tapped "Photo
 * or video" on Log.tsx's "choose" screen — not the very first thing the
 * composer shows anymore (see that file's own doc comment for why). Falls
 * back to a plain "pick a file" screen wherever a live camera genuinely
 * can't work — no camera hardware, denied permission, or an insecure
 * context (getUserMedia requires https or localhost; this app can also be
 * opened straight from file://, which has neither) — rather than showing a
 * broken black box.
 *
 * "Start a Pursuit" and "Add an update" used to have their own row here;
 * both moved onto the "choose" screen as full entry points in their own
 * right, alongside — not behind — Photo/video and Write a moment.
 */
export function CameraCapture({
  onCaptured,
  onPickedLibrary,
  onTextOnly,
}: {
  onCaptured: (file: File, type: "photo" | "video") => void;
  /** A library pick carrying more than one file — routed here instead of
   * onCaptured, which stays single-file for the shutter, a recorded video,
   * and a recent-capture tap. */
  onPickedLibrary: (files: File[]) => void;
  onTextOnly: () => void;
}) {
  const navigate = useNavigate();
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Only HEIC/HEIF picks actually wait on this (see convertHeicFiles) — a
  // JPEG/PNG/video pick resolves synchronously-fast and this never visibly
  // flips true for it. Disables the library buttons for that window so a
  // second tap mid-decode can't start a race between two picks.
  const [converting, setConverting] = useState(false);
  // Set only when convertHeicFiles hands back a file that's still
  // HEIC-shaped — i.e. conversion silently failed (see heicConversion.ts's
  // own comment on why that's worth surfacing rather than uploading a photo
  // nothing but Safari can ever display).
  const [heicWarning, setHeicWarning] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const recents = useRecentCaptures();

  // Live camera, requested once on mount and again whenever the person flips
  // front/back. Audio is requested up front too, even in Photo mode, so
  // switching to Video never needs a second permission prompt mid-flow.
  useEffect(() => {
    let cancelled = false;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera isn’t available in this browser.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraError(null);
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setCameraError("Camera access isn’t available. Pick a photo or video instead.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "video/webm" });
      const file = new File([blob], `video-${Date.now()}.${extFor(recorder.mimeType || mimeType)}`, {
        type: blob.type,
      });
      addRecentCapture(file, "video");
      onCaptured(file, "video");
      setRecording(false);
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_VIDEO_SECONDS) stopRecording();
        return next;
      });
    }, 1000);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        addRecentCapture(file, "photo");
        onCaptured(file, "photo");
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleCapturePress = () => {
    if (captureMode === "photo") {
      takePhoto();
    } else if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const pickFromLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawPicked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (rawPicked.length === 0) return;

    setHeicWarning(null);
    setConverting(true);
    // iOS hands the picker .heic by default — nothing downstream (preview,
    // upload, Discover's own cards) can render that, so it's normalized to
    // a real JPEG right here, before a single video among the picks (never
    // HEIC) or anything else sees it.
    const converted = await convertHeicFiles(rawPicked);
    setConverting(false);

    // isHeicFile() true after conversion means conversion failed and handed
    // the original, still-unrenderable file back — don't let that go on to
    // become a Moment nobody can ever see; drop it and say so.
    const picked = converted.filter((f) => !isHeicFile(f));
    const failedCount = converted.length - picked.length;
    if (failedCount > 0) {
      setHeicWarning(
        failedCount === 1
          ? UPLOAD_COPY.heicMany(1)
          : UPLOAD_COPY.heicMany(failedCount),
      );
    }
    if (picked.length === 0) return;

    if (picked.length === 1) {
      const type = picked[0].type.startsWith("video") ? "video" : "photo";
      addRecentCapture(picked[0], type);
      onCaptured(picked[0], type);
      return;
    }
    onPickedLibrary(picked);
  };

  const timeLabel = `0:${String(elapsed).padStart(2, "0")}`;
  const cameraAvailable = !cameraError;

  return (
    <div>
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={pickFromLibrary}
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-card border border-border bg-media-base">
        {cameraAvailable ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-muted px-6 text-center">
            <CameraIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-small text-muted-foreground">{cameraError}</p>
          </div>
        )}

        {/* Top overlay */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close"
            onClick={() => navigate(-1)}
            className="bg-scrim-solid/40 text-on-media hover:bg-scrim-solid/60"
          >
            <X className="size-4" />
          </Button>
          {cameraAvailable && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Flip camera"
              onClick={() => setFacingMode((f) => (f === "user" ? "environment" : "user"))}
              className="bg-scrim-solid/40 text-on-media hover:bg-scrim-solid/60"
            >
              <SwitchCamera className="size-4" />
            </Button>
          )}
          {recording && (
            <span className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-control bg-scrim-solid/50 px-2.5 py-1 text-caption text-on-media tabular-nums">
              <span className="size-2 rounded-full bg-[var(--coral)] animate-pulse" />
              {timeLabel}
            </span>
          )}
        </div>

        {/* Bottom overlay: mode pill + capture row */}
        <div className="absolute inset-x-0 bottom-0 bg-scrim px-4 pb-4 pt-10">
          {cameraAvailable && (
            <div className="mb-4 flex justify-center">
              <div className="flex rounded-control bg-scrim-solid/40 p-1 text-caption">
                <button
                  type="button"
                  onClick={() => !recording && setCaptureMode("photo")}
                  className={`rounded-control px-3.5 py-1.5 transition-colors ${
                    captureMode === "photo" ? "bg-coral-deep text-on-brand" : "text-on-media/90"
                  }`}
                >
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => !recording && setCaptureMode("video")}
                  className={`rounded-control px-3.5 py-1.5 transition-colors ${
                    captureMode === "video" ? "bg-coral-deep text-on-brand" : "text-on-media/90"
                  }`}
                >
                  Video
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              aria-label="Text only, no photo or video"
              onClick={onTextOnly}
              className="flex size-11 flex-col items-center justify-center rounded-control bg-scrim-solid/40 text-on-media transition-colors hover:bg-scrim-solid/60"
            >
              <Type className="size-4" />
            </button>

            {cameraAvailable ? (
              <button
                type="button"
                aria-label={
                  captureMode === "photo" ? "Take a photo" : recording ? "Stop recording" : "Start recording"
                }
                onClick={handleCapturePress}
                // design-token-ignore: camera shutter, universal affordance
                className="flex size-16 items-center justify-center rounded-full border-4 border-on-media/90 transition-transform active:scale-95"
              >
                <span
                  // Always 48px and scaled down while recording, so the change
                  // animates on the compositor instead of re-laying out.
                  className={`size-12 transition-[transform,border-radius,background-color] ${
                    recording
                      ? "scale-50 rounded-card bg-[var(--coral)]"
                      : captureMode === "video"
                        ? "rounded-full bg-[var(--coral)]"
                        : "rounded-full bg-coral-deep"
                  }`}
                />
              </button>
            ) : (
              <button
                type="button"
                aria-label={converting ? "Preparing your photo…" : "Choose from library"}
                aria-busy={converting}
                disabled={converting}
                onClick={() => libraryInputRef.current?.click()}
                // design-token-ignore: camera shutter, universal affordance
                className="flex size-16 items-center justify-center rounded-full border-4 border-on-media/90 disabled:opacity-50"
              >
                <Images className="size-6 text-on-media" />
              </button>
            )}

            <button
              type="button"
              aria-label={converting ? "Preparing your photo…" : "Choose from library"}
              aria-busy={converting}
              disabled={converting}
              onClick={() => libraryInputRef.current?.click()}
              className="flex size-11 flex-col items-center justify-center rounded-control bg-scrim-solid/40 text-on-media transition-colors hover:bg-scrim-solid/60 disabled:opacity-50"
            >
              <Images className="size-4" />
            </button>
          </div>

          {heicWarning && (
            <p className="mt-3 rounded-control bg-[var(--coral-deep)]/90 px-3 py-1.5 text-center text-caption text-on-brand">
              {heicWarning}
            </p>
          )}

          {/* Recent picks from this visit — tapping one skips straight past
              the picker. Browsers don't expose a real photo-library listing
              to a web page, so this can only ever remember what's already
              been picked or captured here, not the device's actual camera
              roll. */}
          {recents.length > 0 && (
            <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 [scrollbar-width:thin]">
              {recents.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onCaptured(r.file, r.type)}
                  className="relative size-12 shrink-0 overflow-hidden rounded-control border border-on-media/30"
                >
                  {r.type === "video" ? (
                    <>
                      <video src={withFirstFrame(r.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-scrim-solid/25">
                        <Play className="size-3.5 fill-on-media text-on-media" />
                      </span>
                    </>
                  ) : (
                    <ImageWithFallback src={r.url} alt="" className="h-full w-full" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
