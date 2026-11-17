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
