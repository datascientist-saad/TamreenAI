import { POSE_LANDMARK_NAMES } from "./geometry";
import { POSE_MODEL_NAME, type PoseEstimator, type PoseFrame } from "./pose";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export class MediaPipePoseEstimator implements PoseEstimator {
  readonly id = POSE_MODEL_NAME;
  readonly available = true;
  private landmarker: { detectForVideo: (video: HTMLVideoElement, timestamp: number) => { landmarks: Array<Array<{ x: number; y: number; z: number; visibility: number }>> }; close: () => void } | null = null;
  private listeners = new Set<(frame: PoseFrame) => void>();
  private video: HTMLVideoElement | null = null;
  private raf = 0;
  private running = false;
  private busy = false;
  private lastTimestamp = 0;

  async start(video: HTMLVideoElement): Promise<void> {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM_URL);
    const shared = {
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    try {
      this.landmarker = await PoseLandmarker.createFromOptions(files, {
        ...shared,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      });
    } catch {
      this.landmarker = await PoseLandmarker.createFromOptions(files, {
        ...shared,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      });
    }
    this.video = video;
    this.running = true;
    this.lastTimestamp = 0;
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.raf = window.requestAnimationFrame(loop);
    };
    this.raf = window.requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.landmarker?.close();
    this.landmarker = null;
    this.video = null;
    this.listeners.clear();
  }

  subscribe(listener: (frame: PoseFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private tick(): void {
    if (this.busy || !this.landmarker || !this.video || this.video.readyState < 2) return;
    const now = Math.max(this.lastTimestamp + 1, Math.round(performance.now()));
    this.busy = true;
    try {
      const result = this.landmarker.detectForVideo(this.video, now);
      this.lastTimestamp = now;
      const marks = result.landmarks[0] ?? [];
      const frame: PoseFrame = {
        timestampMs: now,
        source: "model",
        landmarks: marks.map((landmark, index) => ({
          name: POSE_LANDMARK_NAMES[index] ?? `landmark_${index}`,
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
          visibility: landmark.visibility,
        })),
      };
      for (const listener of this.listeners) listener(frame);
    } catch {
      this.lastTimestamp = now;
    } finally {
      this.busy = false;
    }
  }
}

export function createPoseEstimator(): PoseEstimator {
  return new MediaPipePoseEstimator();
}
