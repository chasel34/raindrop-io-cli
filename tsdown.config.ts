import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  platform: "node",
  format: ["esm"],
  clean: true,
  dts: false,
  target: "node22.18",
  sourcemap: true,
});
