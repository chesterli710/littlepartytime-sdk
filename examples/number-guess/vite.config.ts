import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => {
        if (format === "es") return "bundle.js";
        if (format === "cjs") return "engine.cjs";
        return `bundle.${format}.js`;
      },
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@littlepartytime/sdk"],
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
