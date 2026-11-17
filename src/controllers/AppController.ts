import { Request, Response } from "express";
import * as AppRepository from "../repositories/AppRepository";
import * as UserRepository from "../repositories/UserRepository";
import * as AssistantService from "../services/AssistantService";

export const getInitialData = async (req: Request, res: Response) => {
  try {
    const parsedUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const userId =
      parsedUserId && Number.isInteger(parsedUserId) && parsedUserId > 0
        ? parsedUserId
        : undefined;

    const [eventos, links, artigos, faqs] = await Promise.all([
      AppRepository.findAllEventos(userId),
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

export const toggleInscricao = async (req: Request, res: Response) => {
  try {
    const eventoId = Number(req.params.id);
    const userId = Number(req.body?.userId);

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(eventoId) || eventoId <= 0) {
      return res.status(400).json({ message: "Usuário e evento são obrigatórios." });
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

export const askAssistant = async (req: Request, res: Response) => {
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

    const parsedUserId = req.body?.userId ? Number(req.body.userId) : undefined;
    const validUserId =
      parsedUserId && Number.isInteger(parsedUserId) && parsedUserId > 0
        ? parsedUserId
        : undefined;

    let userContext = null;
    if (validUserId) {
      try {
        userContext = await UserRepository.findUserById(validUserId);
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
