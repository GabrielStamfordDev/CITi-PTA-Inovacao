import { Request, Response } from "express";
import * as AppRepository from "../repositories/AppRepository";
import * as UserRepository from "../repositories/UserRepository";
import * as AssistantService from "../services/AssistantService";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

export const getInitialData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUserId = req.authUserId;
    if (req.query.userId !== undefined && Number(req.query.userId) !== authUserId) {
      return res
        .status(403)
        .json({ message: "Acesso negado: parâmetro userId não corresponde ao usuário autenticado." });
    }

    const [eventos, links, artigos, faqs] = await Promise.all([
      AppRepository.findAllEventos(authUserId),
      AppRepository.findAllLinks(),
      AppRepository.findAllArtigos(),
      AppRepository.findAllFaqs(),
    ]);

    return res.status(200).json({ eventos, links, artigos, faqs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao carregar dados do aplicativo." });
  }
};

export const toggleInscricao = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eventoId = Number(req.params.id);
    const userId = req.authUserId;

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Sessão não autenticada. Faça login novamente." });
    }

    if (req.body?.userId !== undefined && req.body?.userId !== null && Number(req.body.userId) !== userId) {
      return res
        .status(403)
        .json({ message: "Acesso negado: você só pode gerenciar inscrições da sua própria conta." });
    }

    if (!Number.isInteger(eventoId) || eventoId <= 0) {
      return res.status(400).json({ message: "Evento inválido." });
    }

    const result = await AppRepository.toggleInscricaoEvento(userId, eventoId);
    if ("error" in result) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao processar inscrição." });
  }
};

export const getAssistantSources = async (_req: Request, res: Response) => {
  try {
    const info = AssistantService.listAvailableSources();
    return res.status(200).json(info);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao listar o acervo científico." });
  }
};

export const askAssistant = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (!question) {
      return res.status(400).json({ message: "Escreva uma pergunta ou escolha um tópico rápido." });
    }
    if (question.length > 1500) {
      return res
        .status(400)
        .json({ message: "Sua pergunta ficou muito longa. Tente resumir em menos caracteres." });
    }

    const authUserId = req.authUserId;
    if (
      req.body?.userId !== undefined &&
      req.body?.userId !== null &&
      Number(req.body.userId) !== authUserId
    ) {
      return res
        .status(403)
        .json({ message: "Acesso negado: não é permitido consultar contexto pessoal de outro usuário." });
    }

    let userContext = null;
    if (authUserId) {
      try {
        userContext = await UserRepository.findUserById(authUserId);
      } catch {
        userContext = null;
      }
    }

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history: AssistantService.ChatTurn[] = rawHistory
      .filter(
        (item: any) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.trim().length > 0
      )
      .slice(-6)
      .map((item: any) => ({
        role: item.role,
        content: item.content.slice(0, 1200),
      }));

    const reply = await AssistantService.answerCaregiverQuestion({
      question,
      user: userContext,
      history,
    });

    return res.status(200).json(reply);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Não foi possível gerar a resposta agora. Tente novamente em instantes." });
  }
};
