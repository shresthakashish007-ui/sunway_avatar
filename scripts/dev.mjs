/**
 * Dev launcher — starts the API server and Vite together.
 *
 * Running Vite on its own leaves /api/* proxying to a dead port, which shows up
 * in the browser as an opaque `500 Internal Server Error` with an empty `{}`
 * body and nothing in the terminal. Starting both from one command removes that
 * failure mode entirely.
 *
 * Ctrl-C stops both. If either process dies, the other is shut down too so you
 * never end up with half the stack running.
 */
import { spawn } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_PORT = Number(process.env.PORT || 3001);

// Both children run through this same node binary with no shell. Using a shell
// on Windows breaks as soon as a path contains a space (e.g. the default
// "C:\Program Files\nodejs\node.exe").
const VITE_BIN = path.join(root, "node_modules", "vite", "bin", "vite.js");

function portInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
      .once("error", (err) => resolve(err.code === "EADDRINUSE"))
      // Resolve only after the probe socket is fully closed, then give Windows
      // a moment to release it — otherwise the API server we spawn next can
      // hit EADDRINUSE against our own probe and die on startup.
      .once("listening", () => srv.close(() => setTimeout(() => resolve(false), 250)))
      .listen(port, "127.0.0.1");
  });
}

const children = [];
let shuttingDown = false;

function start(name, args, { fatal = false } = {}) {
  const child = spawn(process.execPath, args, { stdio: "inherit", cwd: root });

  // Without this listener a failed spawn emits an unhandled 'error' event,
  // which surfaces as the child silently never starting.
  child.on("error", (err) => {
    console.error(`\n[dev] Failed to start ${name}: ${err.message}\n`);
    if (fatal) shutdown(1);
  });

  child.on("exit", (code) => {
    if (shuttingDown) return;
    if (fatal) {
      console.error(`\n[dev] ${name} exited with code ${code} — stopping everything.`);
      shutdown(code ?? 1);
      return;
    }
    // Keep Vite alive so the frontend still loads and the proxy can report a
    // clear "API server unreachable" error instead of the page going dead.
    console.error(
      `\n[dev] ${name} exited with code ${code}.` +
      `\n[dev] Vite is still running. Restart the API with "npm run server", ` +
      `or Ctrl-C and re-run "npm run dev".\n`
    );
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill(); } catch { /* already gone */ }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const busy = await portInUse(API_PORT);
if (busy) {
  console.log(`[dev] API server already running on :${API_PORT} — starting Vite only.`);
} else {
  console.log(`[dev] Starting API server on :${API_PORT}...`);
  start("api", [path.join(root, "server", "index.js")]);
}

// Vite is the one that matters — if it dies there's nothing left to serve
start("vite", [VITE_BIN], { fatal: true });
