"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LIVE_EXERCISES, PLACEHOLDER_FORM, createPoseEstimator } from "@/services/live/pose";
import { saveLiveSession } from "@/server/actions";

export function LiveSession({ slug }: { slug: string }) {
  const exercise = LIVE_EXERCISES.find((item) => item.slug === slug);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"starting" | "live" | "denied" | "missing">("starting");
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reps, setReps] = useState(0);
  const [sets, setSets] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const estimatorRef = useRef(createPoseEstimator());

  useEffect(() => {
    const estimator = estimatorRef.current;
    let stream: MediaStream | null = null;
    let active = true;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("missing");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          await estimator.start(videoRef.current);
        }
        setCamera("live");
      } catch {
        setCamera("denied");
      }
    }
    void start();
    return () => {
      active = false;
      estimator.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (paused || camera === "starting") return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [paused, camera]);

  if (!exercise) {
    return <p>That exercise is not in the live library.</p>;
  }

  async function finish(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveLiveSession({
        exerciseSlug: exercise!.slug,
        durationSeconds: seconds,
        manualReps: reps,
        manualSets: sets,
        cameraUsed: camera === "live",
        savePlaceholder: formData.get("placeholder") === "on",
        notes: String(formData.get("notes") || ""),
      });
      router.push(`/live/report/${saved.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The session was not saved.");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-3xl bg-black text-white">
        <div className="relative aspect-[3/4] bg-maroon-deep md:aspect-video">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {camera !== "live" ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="eyebrow text-gold">Camera</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {camera === "starting" ? "Opening the camera" : camera === "denied" ? "Camera permission denied" : "This device has no camera"}
                </h2>
                <p className="mt-2 text-sm text-white/70">Manual reps can still be saved. Form is not measured.</p>
              </div>
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 grid grid-cols-4 gap-2 bg-black/55 p-3 text-center text-xs">
            <Stat label="Rep" value={String(reps)} />
            <Stat label="Set" value={String(sets)} />
            <Stat label="Time" value={`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`} />
            <Stat label="Form" value="—" />
          </div>
        </div>
      </section>
      <article className="app-card p-4">
        <p className="eyebrow">{exercise.name}</p>
        <p className="mt-2">{exercise.setup}</p>
        <p className="mt-3 text-sm font-bold">Checklist, not detected movement</p>
        <ul className="mt-2 grid gap-1 text-sm text-muted">
          {exercise.cues.map((cue) => <li key={cue}>{cue}</li>)}
        </ul>
        <p className="mt-3 text-sm">Form score is not measured. No pose model is connected, so Tamreen will not invent “good depth” or a form score from the camera.</p>
      </article>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary" type="button" onClick={() => setReps((value) => value + 1)}>Count rep</button>
        <button className="btn btn-ghost" type="button" onClick={() => { setSets((value) => value + 1); setReps(0); }}>Next set</button>
        <button className="btn btn-ghost" type="button" onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
      </div>
      <form action={finish} className="app-card grid gap-3 p-4">
        {slug === "squat" ? (
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
