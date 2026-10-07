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

export function LiveSession({ slug }: { slug: string }) {
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
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-3xl bg-black text-white">
        <div className="relative aspect-[3/4] bg-maroon-deep md:aspect-video">
          <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
            <video ref={videoRef} className="h-full w-full object-contain" muted playsInline />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          </div>
          {camera !== "live" ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="eyebrow text-gold">Camera</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {camera === "starting" ? "Opening the camera" : camera === "denied" ? "Camera permission denied" : "This device has no camera"}
                </h2>
                <p className="mt-2 text-sm text-white/70">Manual reps can still be saved. Form is not scored without a visible body.</p>
              </div>
            </div>
          ) : (
            <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold">{status}</div>
          )}
          <div className="absolute inset-x-0 bottom-0 grid gap-2 bg-black/70 p-3">
            <p className="text-sm font-semibold">{cue}</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="Rep" value={String(setReps)} />
              <Stat label="Set" value={String(setCount)} />
              <Stat label="Time" value={`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`} />
              <Stat label="Form" value={formScore == null ? "—" : String(formScore)} />
            </div>
            {formScore != null ? <p className="text-center text-[11px] text-white/70">2D camera estimate, not a lab measurement.</p> : null}
          </div>
        </div>
      </section>
      <article className="app-card p-4">
        <p className="eyebrow">{exercise.name}</p>
        <p className="mt-2">{exercise.setup}</p>
        <p className="mt-3 text-sm font-bold">Coaching cues</p>
        <ul className="mt-2 grid gap-1 text-sm text-muted">
          {exercise.cues.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-3 text-sm">The pose model runs on this device. A form number appears only after your body stays visible. It is a 2D camera estimate, not a lab measurement.</p>
      </article>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary" type="button" onClick={() => bump(1)}>Count rep</button>
        <button className="btn btn-ghost" type="button" onClick={() => bump(-1)}>Undo rep</button>
        <button className="btn btn-ghost" type="button" onClick={nextSet}>Next set</button>
        <button className="btn btn-ghost" type="button" onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
      </div>
      <form action={finish} className="app-card grid gap-3 p-4">
        {slug === "squat" && formScore == null ? (
          <label className="text-sm">
            <span className="flex items-center gap-2 font-bold">
              <input className="h-5 w-5" name="placeholder" type="checkbox" />
              Save the labeled squat example
            </span>
            <span className="mt-1 block text-muted">
              Example only: overall {PLACEHOLDER_FORM.overall}. These numbers are not a measurement of this session.
            </span>
          </label>
        ) : null}
        {formScore != null ? <p className="text-sm">A camera score is ready, so the labeled example will not be saved.</p> : null}
        <label>Notes<textarea name="notes" /></label>
        {error ? <p className="text-sm text-live">{error}</p> : null}
        <button className="btn btn-primary" disabled={saving} type="submit">Finish</button>
      </form>
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
