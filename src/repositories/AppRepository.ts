import prisma from "../database";

export const findAllEventos = async (userId?: number) => {
  const eventos = await prisma.evento.findMany({
    orderBy: { id: "asc" },
    include: {
      inscricoes: userId ? { where: { userId } } : false,
    },
  });

  return eventos.map((ev: any) => ({
    id: ev.id,
    titulo: ev.titulo,
    data: ev.data,
    horario: ev.horario,
    local: ev.local,
    descricao: ev.descricao,
    precisaInscricao: ev.precisaInscricao,
    inscrito: Array.isArray(ev.inscricoes) && ev.inscricoes.length > 0,
  }));
};

export const toggleInscricaoEvento = async (
  userId: number,
  eventoId: number
) => {
  const [user, evento] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.evento.findUnique({ where: { id: eventoId } }),
  ]);

  if (!user) {
    return { status: 404, error: "Sessão expirada. Faça login novamente." };
  }
  if (!evento) {
    return { status: 404, error: "Evento não encontrado." };
  }

  const existente = await prisma.inscricao.findUnique({
    where: {
      userId_eventoId: { userId, eventoId },
    },
  });

  if (existente) {
    await prisma.inscricao.delete({ where: { id: existente.id } });
    return {
      inscrito: false,
      precisaInscricao: evento.precisaInscricao,
      message: "Inscrição cancelada com sucesso.",
    };
  }

  await prisma.inscricao.create({
    data: { userId, eventoId },
  });
  return {
    inscrito: true,
    precisaInscricao: evento.precisaInscricao,
    message: evento.precisaInscricao
      ? "Inscrição confirmada no evento!"
      : "Evento salvo na sua lista de inscritos!",
  };
};

export const findAllLinks = async () => {
  return await prisma.linkApoio.findMany({ orderBy: { id: "asc" } });
};

export const findAllArtigos = async () => {
  return await prisma.artigo.findMany({ orderBy: { id: "asc" } });
};

export const findAllFaqs = async () => {
  return await prisma.faq.findMany({ orderBy: { ordem: "asc" } });
};

export const findAllForumMessages = async (limit = 100) => {
  const messages = await prisma.forumMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          nome: true,
          pessoaComAlzheimer: true,
          parentesco: true,
          estagioDaDoenca: true,
          cidade: true,
          estado: true,
        },
      },
    },
  });

  return messages.map((m) => ({
    id: m.id,
    userId: m.userId,
    conteudo: m.conteudo,
    createdAt: m.createdAt.toISOString(),
    autor: {
      id: m.user.id,
      nome: m.user.nome,
      pessoaComAlzheimer: m.user.pessoaComAlzheimer,
      parentesco: m.user.parentesco,
      estagioDaDoenca: m.user.estagioDaDoenca,
      cidade: m.user.cidade,
      estado: m.user.estado,
    },
  }));
};

export const createForumMessage = async (userId: number, conteudo: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return { status: 404, error: "Sessão expirada. Faça login novamente." };
  }

  const created = await prisma.forumMessage.create({
    data: {
      userId,
      conteudo,
    },
    include: {
      user: {
        select: {
          id: true,
          nome: true,
          pessoaComAlzheimer: true,
          parentesco: true,
          estagioDaDoenca: true,
          cidade: true,
          estado: true,
        },
      },
    },
  });

  return {
    message: {
      id: created.id,
      userId: created.userId,
      conteudo: created.conteudo,
      createdAt: created.createdAt.toISOString(),
      autor: {
        id: created.user.id,
        nome: created.user.nome,
        pessoaComAlzheimer: created.user.pessoaComAlzheimer,
        parentesco: created.user.parentesco,
        estagioDaDoenca: created.user.estagioDaDoenca,
        cidade: created.user.cidade,
        estado: created.user.estado,
      },
    },
  };
};

