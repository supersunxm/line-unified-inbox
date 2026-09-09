import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OPPO Brand Shop",
    short_name: "OPPO Brand Shop",
    start_url: "/",
    display: "standalone",
    background_color: "#211b1d",
    theme_color: "#00a651",
    icons: [
      {
        src: "/images/LOGO_OBS.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
