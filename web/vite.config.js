import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base matches the GitHub Pages path
export default defineConfig({ plugins: [react()], base: "/parkkiko/" });
