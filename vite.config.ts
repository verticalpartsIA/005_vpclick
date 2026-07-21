import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

// Escreve dist/version.json a cada build, pra o app rodando no navegador
// conseguir detectar quando uma nova versão foi publicada (ver
// src/lib/versionCheck.ts). __APP_BUILD_TIME__ é o mesmo valor embutido
// no bundle JS — é assim que a aba já aberta sabe "de que build eu sou".
function writeVersionFile(buildTime: string, commit: string): Plugin {
  return {
    name: "write-version-file",
    apply: "build",
    writeBundle(options) {
      const outDir = options.dir || "dist";
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        JSON.stringify({ buildTime, commit }, null, 2),
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildTime = new Date().toISOString();
  const commit =
    process.env.GITHUB_SHA ||
    (() => {
      try {
        return execSync("git rev-parse HEAD").toString().trim();
      } catch {
        return "";
      }
    })();

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      writeVersionFile(buildTime, commit),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __APP_BUILD_TIME__: JSON.stringify(buildTime),
    },
  };
});
