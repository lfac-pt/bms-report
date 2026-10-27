import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginTypeCheck } from "@rsbuild/plugin-type-check";

const dataFiles = [
  "timeline-data.json",
  "processed-transects.json",
  "common-names.json",
  "photo-credits.json",
  "results-photo-credits.json",
  "municipality-coverage.json",
  "environmental-zones.geojson",
];

export default defineConfig({
  plugins: [pluginReact(), pluginTypeCheck()],
  source: { entry: { index: "./src/report2026.tsx" } },
  html: { template: "./src/report2026.html" },
  server: { publicDir: false },
  output: {
    assetPrefix: "./",
    distPath: { root: "dist-report" },
    copy: [
      ...dataFiles.map(file => ({ from: `public/data/${file}`, to: `data/${file}` })),
      { from: "public/imgs/results", to: "imgs/results" },
      { from: "public/imgs/vanessa-cardui-swarm.jpg", to: "imgs/vanessa-cardui-swarm.jpg" },
      {
        from: "public/imgs/sp/Nymphalidae/Euphydryas aurinia.jpg",
        to: "imgs/sp/Nymphalidae/Euphydryas aurinia.jpg",
      },
      { from: "public/embed-report.js", to: "embed-report.js" },
    ],
  },
});
