import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The deployed commit, shown in the About card. GitHub Actions sets GITHUB_SHA; locally ask git.
function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

// base matches the GitHub Pages path
export default defineConfig({
  plugins: [react()],
  base: "/parkkiko/",
  define: { __COMMIT__: JSON.stringify(commit()) },
});
