import "dotenv/config";
import express from "express";
import routes from "./routes";
import { resolveProjectPath } from "./utils/projectPaths";

const app = express();

// Necessário para cookies `HttpOnly; Secure` funcionarem atrás de proxy reverso (Render, Railway, etc.)
app.set("trust proxy", 1);

app.use(express.json());

// Serve os arquivos estáticos do Front-end (pasta public) e os PDFs científicos do acervo
app.use(express.static(resolveProjectPath("public")));
app.use("/acervo-pdf", express.static(resolveProjectPath("acervo-pdf")));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Rotas da API
app.use(routes);

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

const port = Number(process.env.PORT || process.env.SERVER_PORT || 3001);

app.listen(port, () => {
  console.log(`🚀 CuiDA rodando em http://localhost:${port}`);
});