export function isNativeShell(): boolean {
  return typeof window !== "undefined" && "Capacitor" in window;
}
