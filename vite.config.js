import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        // Vite's own proxy error handler runs first and already sends a bare
        // 500 with an empty body, so we can't change the response here — but we can
        // make the terminal say what actually went wrong. The browser side is
        // handled in src/services/chatService.js, which turns an empty 5xx
        // into a readable "API server unreachable" message.
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.error(`\n[vite-proxy] Cannot reach API server at :3001 (${err.code}).`);
            console.error(`[vite-proxy] Start it with "npm run server", or run "npm run dev" to start both.\n`);
          });
        },
      },
    },
  },
});
