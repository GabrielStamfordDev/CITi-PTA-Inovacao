import express from "express";
import * as UserController from "./controllers/UserController";
import * as AppController from "./controllers/AppController";

const routes = express.Router();

// Autenticação e Recuperação de Senha por E-mail
routes.post("/api/auth/register", UserController.register);
routes.post("/api/auth/login", UserController.login);
routes.post("/api/auth/recover/request", UserController.requestPasswordReset);
routes.post("/api/auth/recover/confirm", UserController.confirmPasswordReset);
routes.get("/api/auth/user/:id", UserController.getProfile);

// Conteúdos e Eventos do CuiDA
routes.get("/api/dados", AppController.getInitialData);
routes.post("/api/eventos/:id/inscricao", AppController.toggleInscricao);

export default routes;
