import "dotenv/config";
import path from "path";
import express from "express";
import routes from "./routes";

const app = express();

app.use(express.json());

// Serve os arquivos estáticos do Front-end (pasta public) e os PDFs científicos do acervo
app.use(express.static(path.resolve(__dirname, "..", "public")));
app.use("/acervo-pdf", express.static(path.resolve(__dirname, "..", "acervo-pdf")));

// Rotas da API
app.use(routes);

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

const port = process.env.SERVER_PORT || 3001;

app.listen(port, () => {
  console.log(`🚀 CuiDA rodando em http://localhost:${port}`);
});