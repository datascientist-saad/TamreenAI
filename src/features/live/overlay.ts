import { BODY_CONNECTIONS } from "@/services/live/geometry";
import type { PoseFrame } from "@/services/live/pose";

export function drawPose(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null, frame: PoseFrame) {
  if (!canvas || !video) return;
  const bounds = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  const box = contentBox(video);
  if (!box) return;
  const points = new Map(frame.landmarks.filter((landmark) => (landmark.visibility ?? 1) >= 0.6).map((landmark) => [landmark.name, landmark]));
  context.lineWidth = 3;
  context.strokeStyle = "#c9a876";
  context.fillStyle = "#ffffff";
  for (const [startName, endName] of BODY_CONNECTIONS) {
    const start = points.get(startName);
    const end = points.get(endName);
    if (!start || !end) continue;
    context.beginPath();
    context.moveTo(box.x + start.x * box.w, box.y + start.y * box.h);
    context.lineTo(box.x + end.x * box.w, box.y + end.y * box.h);
    context.stroke();
  }
  for (const landmark of points.values()) {
    if (!BODY_CONNECTIONS.some(([start, end]) => start === landmark.name || end === landmark.name)) continue;
    context.beginPath();
    context.arc(box.x + landmark.x * box.w, box.y + landmark.y * box.h, 4, 0, Math.PI * 2);
    context.fill();
  }
}

function contentBox(video: HTMLVideoElement): { x: number; y: number; w: number; h: number } | null {
  const frameWidth = video.videoWidth;
  const frameHeight = video.videoHeight;
  const elementWidth = video.clientWidth;
  const elementHeight = video.clientHeight;
  if (!frameWidth || !frameHeight || !elementWidth || !elementHeight) return null;
  const scale = Math.min(elementWidth / frameWidth, elementHeight / frameHeight);
  const w = frameWidth * scale;
  const h = frameHeight * scale;
  return { x: (elementWidth - w) / 2, y: (elementHeight - h) / 2, w, h };
}
