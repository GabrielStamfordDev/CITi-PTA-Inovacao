import express from "express";
import * as UserController from "./controllers/UserController";
import * as AppController from "./controllers/AppController";
import { optionalAuth, requireAuth } from "./middlewares/authMiddleware";

const routes = express.Router();

// Autenticação, Sessão Segura e Recuperação de Senha por E-mail
routes.post("/api/auth/register", UserController.register);
routes.post("/api/auth/login", UserController.login);
routes.post("/api/auth/logout", UserController.logout);
routes.post("/api/auth/recover/request", UserController.requestPasswordReset);
routes.post("/api/auth/recover/confirm", UserController.confirmPasswordReset);
routes.get("/api/auth/me", requireAuth, UserController.getMe);
routes.put("/api/auth/me", requireAuth, UserController.updateMe);
routes.get("/api/auth/user/:id", requireAuth, UserController.getProfile);
routes.put("/api/auth/user/:id", requireAuth, UserController.updateProfile);

// Conteúdos, Eventos e Assistente Científico do CuiDA
routes.get("/api/dados", optionalAuth, AppController.getInitialData);
routes.post("/api/eventos/:id/inscricao", requireAuth, AppController.toggleInscricao);
routes.get("/api/assistente/fontes", AppController.getAssistantSources);
routes.post("/api/assistente/perguntar", optionalAuth, AppController.askAssistant);

export default routes;
