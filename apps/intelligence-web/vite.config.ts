import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_INTELLIGENCE_API_PROXY_TARGET || "http://localhost:4100";
  return {
    plugins: [vue()],
    server: {
      port: 5174,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/health": { target: apiTarget, changeOrigin: true },
        "/ready": { target: apiTarget, changeOrigin: true },
      },
    },
    preview: { port: 5174 },
  };
});
