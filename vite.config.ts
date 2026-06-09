import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: [
        "resume-ats-dfpp.onrender.com", // Your specific Render host
        ".onrender.com"                // Allows any sub-domain on Render
      ]
    },
    build: {
      minify: 'terser',
      cssMinify: true,
      sourcemap: false,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    }
  }
});
