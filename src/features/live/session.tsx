"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { drawPose } from "./overlay";
import {
  createRepState,
  liveCue,
  sampleFrame,
  scoreMovement,
  updateRep,
  type MovementSample,
  type RepState,
} from "@/services/live/geometry";
import { LIVE_EXERCISES, PLACEHOLDER_FORM, POSE_MODEL_NAME, UnavailablePoseEstimator, type PoseEstimator } from "@/services/live/pose";
import { saveLiveSession } from "@/server/actions";

const SAMPLE_CAP = 3600;

export function LiveSession({
  slug,
  prescription,
}: {
  slug: string;
  prescription?: { workoutTitle: string; name: string; sets: number; reps: string };
}) {
  const exercise = LIVE_EXERCISES.find((item) => item.slug === slug);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<MovementSample[]>([]);
  const repRef = useRef<RepState>(createRepState());
  const setBaselineRef = useRef(0);
  const adjustRef = useRef(0);
  const committedRef = useRef(0);
  const modelReadyRef = useRef(false);
  const pausedRef = useRef(false);
  const [camera, setCamera] = useState<"starting" | "live" | "denied" | "missing">("starting");
  const [model, setModel] = useState<"loading" | "tracking" | "missing" | "failed">("loading");
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [setCount, setSetCount] = useState(1);
  const [setReps, setSetReps] = useState(0);
  const [cue, setCue] = useState("Step into frame so the pose model can see you.");
  const [formScore, setFormScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const video = videoRef.current;
    let estimator: PoseEstimator = new UnavailablePoseEstimator();
    let stream: MediaStream | null = null;
    let active = true;
    let unsubscribe: () => void = () => undefined;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("missing");
        setModel("failed");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCamera("live");
        try {
          const loaded = await import("@/services/live/mediapipe-estimator");
          estimator = loaded.createPoseEstimator();
          await estimator.start(video);
          if (!active) {
            estimator.stop();
            return;
          }
          modelReadyRef.current = true;
          let lastUi = 0;
          unsubscribe = estimator.subscribe((frame) => {
            drawPose(canvasRef.current, video, frame);
            if (pausedRef.current) return;
            const sample = sampleFrame(frame);
            if (samplesRef.current.length < SAMPLE_CAP) samplesRef.current.push(sample);
            repRef.current = updateRep(slug, repRef.current, sample);
            const now = performance.now();
            if (now - lastUi < 200) return;
            lastUi = now;
            const reading = scoreMovement(slug, samplesRef.current);
            const current = Math.max(0, repRef.current.count - setBaselineRef.current + adjustRef.current);
            setSetReps(current);
            setCue(reading.cue || liveCue(slug, repRef.current.phase, reading.inFrame));
            setFormScore(reading.overall);
            setModel(reading.inFrame ? "tracking" : "missing");
          });
        } catch {
          modelReadyRef.current = false;
          setModel("failed");
          setCue("The pose model did not load. Count the reps yourself. No form score will be saved.");
        }
      } catch {
        setCamera("denied");
        setModel("failed");
      }
    }
    void start();
    return () => {
      active = false;
      unsubscribe();
      estimator.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [slug]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (paused || camera === "starting") return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [paused, camera]);

  if (!exercise) {
    return <p>That exercise is not in the live library.</p>;
  }

  function currentSetReps() {
    return Math.max(0, repRef.current.count - setBaselineRef.current + adjustRef.current);
  }

  function bump(direction: 1 | -1) {
    adjustRef.current += direction;
    setSetReps(currentSetReps());
  }

  function nextSet() {
    committedRef.current += currentSetReps();
    setBaselineRef.current = repRef.current.count;
    adjustRef.current = 0;
    setSetReps(0);
    setSetCount((value) => value + 1);
  }

  async function finish(formData: FormData) {
    setSaving(true);
    setError(null);
    const reading = scoreMovement(slug, samplesRef.current);
    const totalReps = committedRef.current + currentSetReps();
    const modelPayload = modelReadyRef.current && reading.trackedFrames >= 12
      ? {
          frameCount: reading.trackedFrames,
          modelName: POSE_MODEL_NAME,
          reps: reading.reps,
          overall: reading.overall,
          metrics: reading.metrics,
          best: reading.best,
          improve: reading.improve,
        }
      : null;
    try {
      const saved = await saveLiveSession({
        exerciseSlug: exercise!.slug,
        durationSeconds: seconds,
        manualReps: totalReps,
        manualSets: setCount,
        cameraUsed: camera === "live",
        savePlaceholder: formData.get("placeholder") === "on",
        notes: String(formData.get("notes") || ""),
        model: modelPayload,
      });
      router.push(`/live/report/${saved.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The session was not saved.");
      setSaving(false);
    }
  }

  const status = camera === "starting"
    ? "Opening the camera"
    : camera === "denied"
      ? "Camera denied"
      : camera === "missing"
        ? "No camera"
        : model === "loading"
          ? "Loading pose model"
          : model === "failed"
            ? "Model unavailable"
            : model === "missing"
              ? "Not in frame"
              : "Tracking";

  return (
    <div className="grid min-h-[100dvh] gap-0 bg-black text-white md:min-h-0 md:gap-4 md:bg-transparent md:text-ink">
      <section className="relative min-h-[100dvh] overflow-hidden bg-black text-white md:min-h-0 md:rounded-[var(--radius-lg)] md:aspect-video">
        <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
          <video ref={videoRef} className="h-full w-full object-cover md:object-contain" muted playsInline />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">{status}</p>
            <h1 className="truncate text-lg font-bold">{prescription?.name ?? exercise.name}</h1>
            {prescription ? (
              <p className="text-xs text-white/70">{prescription.sets} × {prescription.reps}</p>
            ) : null}
          </div>
          <button className="btn btn-on-dark btn-sm" type="button" onClick={() => setPaused((value) => !value)}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>

        {camera !== "live" ? (
          <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center">
            <div>
              <h2 className="text-xl font-bold">
                {camera === "starting" ? "Opening camera…" : camera === "denied" ? "Camera permission denied" : "No camera on this device"}
              </h2>
              <p className="mt-2 text-sm text-white/70">You can still count reps manually. Form is not scored without a visible body.</p>
            </div>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 grid gap-3 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="text-center text-sm font-semibold text-white/95">{cue}</p>
          <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2 text-center">
            <Stat label="Rep" value={String(setReps)} />
            <Stat label="Set" value={String(setCount)} />
            <Stat label="Time" value={`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`} />
            <Stat label="Form" value={formScore == null ? "—" : String(formScore)} />
          </div>
          {formScore != null ? <p className="text-center text-[11px] text-white/55">2D camera estimate — not a lab measurement</p> : null}
          <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-2">
            <button className="btn btn-on-dark" type="button" onClick={() => bump(-1)}>Undo</button>
            <button className="btn btn-primary" type="button" onClick={() => bump(1)}>Count</button>
            <button className="btn btn-on-dark" type="button" onClick={nextSet}>Next set</button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 bg-paper px-4 py-4 text-ink md:px-0">
        <details className="app-card p-4">
          <summary className="cursor-pointer font-semibold">Setup & cues</summary>
          <p className="mt-2 text-sm">{exercise.setup}</p>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {exercise.cues.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </details>
        <form action={finish} className="app-card grid gap-3 p-4">
          {slug === "squat" && formScore == null ? (
            <label className="text-sm">
              <span className="flex items-center gap-2 font-bold">
                <input className="h-5 w-5" name="placeholder" type="checkbox" />
                Save the labeled squat example
              </span>
              <span className="mt-1 block text-muted">
                Example only: overall {PLACEHOLDER_FORM.overall}. Not a measurement of this session.
              </span>
            </label>
          ) : null}
          <label>Notes<textarea name="notes" /></label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Finish session"}</button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/60">{label}</div>
      <div className="metric text-lg font-bold">{value}</div>
    </div>
  );
}
