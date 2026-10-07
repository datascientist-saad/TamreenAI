import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tamreen AI",
    short_name: "Tamreen",
    description: "Hybrid training for strength, running, cycling, and swimming.",
    start_url: "/home",
    display: "standalone",
    background_color: "#10080c",
    theme_color: "#8A1538",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
    ],
  };
}
