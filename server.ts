import express from "express";
import { createServer as createViteServer } from "vite";
import { app } from "./server/app";

// spins up express + vite together so we don't need two terminals
async function startServer() {
  const PORT = 4000;

  if (process.env.NODE_ENV !== "production") {
    // hook vite into express for HMR in dev
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`up on :${PORT}`);
  });
}

startServer();
