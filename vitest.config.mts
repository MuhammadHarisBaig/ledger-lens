import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()], // makes "@/..." imports resolve in tests
  test: {
    environment: "node", // pure logic needs no browser DOM (jsdom comes later)
    include: ["src/**/*.test.ts", "eval/**/*.test.ts"], // src + the eval metric-math tests
  },
});
