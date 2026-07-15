import 'dotenv/config';
import { createServer as createViteServer } from "vite";
import { app } from "./server/app";

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 40001;
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { overlay: false } },
      appType: "spa",
    });
    app.use((req, res, next) => {
      if (!req.url.startsWith('/api')) {
        return vite.middlewares(req, res, next);
      }
      next();
    });
  }
  
  app.listen(PORT, "0.0.0.0", () => console.log(`up on :${PORT}`));
}

startServer();