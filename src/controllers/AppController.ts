import { Request, Response } from "express";
import * as AppRepository from "../repositories/AppRepository";

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
