import express from "express";
import * as UserController from "./controllers/UserController";
import * as AppController from "./controllers/AppController";
import { optionalAuth, requireAuth } from "./middlewares/authMiddleware";
import {
  assistantHourlyLimiter,
  assistantMinuteLimiter,
  authAttemptLimiter,
  emailRecoveryIpLimiter,
  emailRecoveryTargetLimiter,
  forumPostLimiter,
  recoveryConfirmLimiter,
} from "./middlewares/rateLimitMiddleware";

const routes = express.Router();

// Autenticação, Sessão Segura e Recuperação de Senha por E-mail
routes.post("/api/auth/register", authAttemptLimiter, UserController.register);
routes.post("/api/auth/login", authAttemptLimiter, UserController.login);
routes.post("/api/auth/logout", UserController.logout);
routes.post(
  "/api/auth/recover/request",
  emailRecoveryIpLimiter,
  emailRecoveryTargetLimiter,
  UserController.requestPasswordReset
);
routes.post(
  "/api/auth/recover/confirm",
  recoveryConfirmLimiter,
  UserController.confirmPasswordReset
);
routes.get("/api/auth/me", requireAuth, UserController.getMe);
routes.put("/api/auth/me", requireAuth, UserController.updateMe);
routes.get("/api/auth/user/:id", requireAuth, UserController.getProfile);
routes.put("/api/auth/user/:id", requireAuth, UserController.updateProfile);

// Conteúdos, Eventos e Assistente Científico do CuiDA
routes.get("/api/dados", optionalAuth, AppController.getInitialData);
routes.post("/api/eventos/:id/inscricao", requireAuth, AppController.toggleInscricao);
routes.get("/api/assistente/fontes", AppController.getAssistantSources);
routes.post(
  "/api/assistente/perguntar",
  requireAuth,
  assistantMinuteLimiter,
  assistantHourlyLimiter,
  AppController.askAssistant
);
routes.get("/api/forum/salas", optionalAuth, AppController.getForumRooms);
routes.post("/api/forum/salas/:id/participar", requireAuth, AppController.toggleForumRoomMembership);
routes.get("/api/forum/salas/:id/mensagens", optionalAuth, AppController.getForumRoomMessages);
routes.post(
  "/api/forum/salas/:id/mensagens",
  requireAuth,
  forumPostLimiter,
  AppController.createForumRoomMessage
);
routes.get("/api/forum/mensagens", optionalAuth, AppController.getForumMessages);
routes.post(
  "/api/forum/mensagens",
  requireAuth,
  forumPostLimiter,
  AppController.createForumMessage
);

export default routes;
