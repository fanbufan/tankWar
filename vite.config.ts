import { defineConfig } from "vite";

export default defineConfig({
  base: "/tankwar/",
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
