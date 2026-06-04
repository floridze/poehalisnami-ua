import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "site"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        home: path.resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "assets/js/[name].js",
        chunkFileNames: "assets/js/[name].js",
        assetFileNames: (assetInfo) => {
          const originalFileName = assetInfo.originalFileNames?.[0] ?? assetInfo.name ?? "";
          const sourceImagesPath = "src/images/";

          if (assetInfo.name?.endsWith(".css")) {
            return "assets/css/[name][extname]";
          }

          if (originalFileName.includes(sourceImagesPath)) {
            const relativeImagePath = originalFileName.slice(originalFileName.indexOf(sourceImagesPath) + sourceImagesPath.length);

            return `assets/images/${relativeImagePath}`;
          }

          if (/\.(gif|jpe?g|png|svg|webp|avif)$/.test(assetInfo.name ?? "")) {
            return "assets/images/[name][extname]";
          }
          if (/\.(woff|woff2|eot|ttf|otf)$/.test(assetInfo.name ?? "")) {
            return "assets/fonts/[name][extname]";
          }
          return "assets/[name][extname]";
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    host: "0.0.0.0",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
