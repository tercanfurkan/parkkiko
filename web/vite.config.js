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

// A relative base so one build works at the custom domain's root and at tercanfurkan.github.io/parkkiko/.
// Safe because the app is one page with no router: every URL resolves against the root page.
export default defineConfig({
  plugins: [react()],
  base: "./",
  define: { __COMMIT__: JSON.stringify(commit()) },
});
