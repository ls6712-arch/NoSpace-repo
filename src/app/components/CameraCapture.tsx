import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Camera as CameraIcon,
  Images,
  PenLine,
  Play,
  Sparkles,
  SwitchCamera,
  Type,
  X,
} from "lucide-react";
import { Project } from "../lib/journal";
import { addRecentCapture, useRecentCaptures } from "../lib/recentCaptures";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

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
 * The camera-first entry screen: a live viewfinder, not a menu, matching
 * what every other camera-first app (Instagram, TikTok, Snapchat) already
 * trained people to expect. Falls back to a plain "pick a file" screen
 * wherever a live camera genuinely can't work — no camera hardware, denied
 * permission, or an insecure context (getUserMedia requires https or
 * localhost; this app can also be opened straight from file://, which has
 * neither) — rather than showing a broken black box.
 */
export function CameraCapture({
  onCaptured,
  onTextOnly,
  onStartPursuit,
  onAddUpdate,
  openProjects,
}: {
  onCaptured: (file: File, type: "photo" | "video") => void;
  onTextOnly: () => void;
  onStartPursuit: () => void;
  onAddUpdate: (projectId: string) => void;
  openProjects: Project[];
}) {
  const navigate = useNavigate();
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

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
      setCameraError("Camera isn't available in this browser.");
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
        if (!cancelled) setCameraError("Camera access isn't available — pick a photo or video instead.");
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

  const pickFromLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const type = picked.type.startsWith("video") ? "video" : "photo";
    addRecentCapture(picked, type);
    onCaptured(picked, type);
  };

  const timeLabel = `0:${String(elapsed).padStart(2, "0")}`;
  const cameraAvailable = !cameraError;

  return (
    <div>
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={pickFromLibrary}
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-black">
        {cameraAvailable ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-muted px-6 text-center">
            <CameraIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">{cameraError}</p>
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
            className="bg-black/40 text-white hover:bg-black/60"
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
              className="bg-black/40 text-white hover:bg-black/60"
            >
              <SwitchCamera className="size-4" />
            </Button>
          )}
          {recording && (
            <span className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
              <span className="size-2 rounded-full bg-[var(--coral)] animate-pulse" />
              {timeLabel}
            </span>
          )}
        </div>

        {/* Bottom overlay: mode pill + capture row */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-4 pt-10">
          {cameraAvailable && (
            <div className="mb-4 flex justify-center">
              <div className="flex rounded-full bg-black/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => !recording && setCaptureMode("photo")}
                  className={`rounded-full px-3.5 py-1.5 transition-colors ${
                    captureMode === "photo" ? "bg-white text-black" : "text-white/80"
                  }`}
                >
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => !recording && setCaptureMode("video")}
                  className={`rounded-full px-3.5 py-1.5 transition-colors ${
                    captureMode === "video" ? "bg-white text-black" : "text-white/80"
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
              className="flex size-11 flex-col items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
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
                className="flex size-16 items-center justify-center rounded-full border-4 border-white/90 transition-transform active:scale-95"
              >
                <span
                  className={`transition-all ${
                    recording
                      ? "size-6 rounded-md bg-[var(--coral)]"
                      : captureMode === "video"
                        ? "size-12 rounded-full bg-[var(--coral)]"
                        : "size-12 rounded-full bg-white"
                  }`}
                />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Choose from library"
                onClick={() => libraryInputRef.current?.click()}
                className="flex size-16 items-center justify-center rounded-full border-4 border-white/90"
              >
                <Images className="size-6 text-white" />
              </button>
            )}

            <button
              type="button"
              aria-label="Choose from library"
              onClick={() => libraryInputRef.current?.click()}
              className="flex size-11 flex-col items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
            >
              <Images className="size-4" />
            </button>
          </div>

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
                  className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-white/30"
                >
                  {r.type === "video" ? (
                    <>
                      <video src={r.url} muted className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Play className="size-3.5 fill-white text-white" />
                      </span>
                    </>
                  ) : (
                    <img src={r.url} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deliberate, non-quick-capture actions — their own entry points
          rather than another tap behind a menu. Both route straight into
          already-built, separately-scoped flows. */}
      <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2.5">
        <Button type="button" variant="outline" size="sm" onClick={onStartPursuit}>
          <Sparkles className="size-3.5" />
          Start a Pursuit
        </Button>

        {openProjects.length > 0 ? (
          <Select onValueChange={onAddUpdate}>
            <SelectTrigger
              className="h-8 w-auto gap-1.5 rounded-md border border-input bg-[color-mix(in_srgb,var(--void)_35%,transparent)] px-3 text-sm text-foreground hover:bg-accent/10"
              aria-label="Add an update to a Pursuit"
            >
              <PenLine className="size-3.5" />
              <SelectValue placeholder="Add an update" />
            </SelectTrigger>
            <SelectContent>
              {openProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled title="Start a Pursuit first">
            <PenLine className="size-3.5" />
            Add an update
          </Button>
        )}
      </div>
    </div>
  );
}
