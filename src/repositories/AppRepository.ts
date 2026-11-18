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

export const DEFAULT_FORUM_ROOM_SLUG = "acolhimento-geral";

const forumAuthorSelect = {
  id: true,
  nome: true,
  pessoaComAlzheimer: true,
  parentesco: true,
  estagioDaDoenca: true,
  cidade: true,
  estado: true,
};

function formatForumMessage(m: any) {
  return {
    id: m.id,
    userId: m.userId,
    roomId: m.roomId,
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
  };
}

function formatForumRoom(room: any) {
  const latest = Array.isArray(room.messages) && room.messages.length > 0 ? room.messages[0] : null;
  const participando = room.padrao
    ? true
    : Array.isArray(room.memberships) && room.memberships.length > 0;

  return {
    id: room.id,
    slug: room.slug,
    nome: room.nome,
    descricao: room.descricao,
    categoria: room.categoria,
    icone: room.icone,
    cor: room.cor,
    padrao: Boolean(room.padrao),
    membrosCount: Number(room._count?.memberships ?? 0),
    mensagensCount: Number(room._count?.messages ?? 0),
    participando,
    ultimaMensagem: latest
      ? {
          id: latest.id,
          conteudo: latest.conteudo,
          createdAt: latest.createdAt.toISOString(),
          autorNome: latest.user?.nome || "Cuidador(a)",
        }
      : null,
  };
}

export const findDefaultForumRoom = async () => {
  return (
    (await prisma.forumRoom.findFirst({
      where: { slug: DEFAULT_FORUM_ROOM_SLUG },
    })) ||
    (await prisma.forumRoom.findFirst({
      where: { padrao: true },
      orderBy: { ordem: "asc" },
    })) ||
    (await prisma.forumRoom.findFirst({
      orderBy: { ordem: "asc" },
    }))
  );
};

export const ensureUserInDefaultForumRooms = async (userId: number) => {
  if (!userId || !Number.isInteger(userId) || userId <= 0) return;
  const defaultRooms = await prisma.forumRoom.findMany({
    where: { padrao: true },
    select: { id: true },
  });
  if (!defaultRooms.length) return;

  await prisma.forumMembership.createMany({
    data: defaultRooms.map((r) => ({ userId, roomId: r.id })),
    skipDuplicates: true,
  });
};

export const findAllForumRooms = async (userId?: number) => {
  if (userId) {
    try {
      await ensureUserInDefaultForumRooms(userId);
    } catch {
      // Evita falha caso o usuário ainda esteja sendo sincronizado
    }
  }

  const rooms = await prisma.forumRoom.findMany({
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    include: {
      _count: {
        select: {
          memberships: true,
          messages: true,
        },
      },
      memberships: userId ? { where: { userId }, select: { id: true } } : false,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          user: { select: { nome: true } },
        },
      },
    },
  });

  return rooms.map(formatForumRoom);
};

export const findForumRoomById = async (roomId: number, userId?: number) => {
  if (userId) {
    try {
      await ensureUserInDefaultForumRooms(userId);
    } catch {
      // Ignora silenciosamente
    }
  }

  const room = await prisma.forumRoom.findUnique({
    where: { id: roomId },
    include: {
      _count: {
        select: {
          memberships: true,
          messages: true,
        },
      },
      memberships: userId ? { where: { userId }, select: { id: true } } : false,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          user: { select: { nome: true } },
        },
      },
    },
  });

  if (!room) return null;
  return formatForumRoom(room);
};

export const toggleForumRoomMembership = async (
  userId: number,
  roomId: number,
  desiredAction?: "join" | "leave"
) => {
  const [user, room] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.forumRoom.findUnique({ where: { id: roomId } }),
  ]);

  if (!user) {
    return { status: 404, error: "Sessão expirada. Faça login novamente." };
  }
  if (!room) {
    return { status: 404, error: "Fórum não encontrado." };
  }

  const existing = await prisma.forumMembership.findUnique({
    where: {
      userId_roomId: { userId, roomId },
    },
  });

  const action =
    desiredAction === "join" || desiredAction === "leave"
      ? desiredAction
      : existing
        ? "leave"
        : "join";

  if (action === "leave" && room.padrao) {
    return {
      status: 400,
      error: "Você faz parte automaticamente do fórum Acolhimento Geral.",
    };
  }

  if (action === "join") {
    if (!existing) {
      await prisma.forumMembership.create({
        data: { userId, roomId },
      });
    }
  } else if (existing) {
    await prisma.forumMembership.delete({
      where: { id: existing.id },
    });
  }

  const membrosCount = await prisma.forumMembership.count({
    where: { roomId },
  });

  const participando = action === "join";
  return {
    participando,
    membrosCount,
    roomNome: room.nome,
    message: participando
      ? `Você entrou no fórum ${room.nome}!`
      : `Você saiu do fórum ${room.nome}.`,
  };
};

export const findAllForumMessages = async (roomId?: number, limit = 100) => {
  let resolvedRoomId = roomId;
  if (!resolvedRoomId) {
    const defaultRoom = await findDefaultForumRoom();
    if (!defaultRoom) return [];
    resolvedRoomId = defaultRoom.id;
  }

  const messages = await prisma.forumMessage.findMany({
    where: { roomId: resolvedRoomId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    include: {
      user: { select: forumAuthorSelect },
    },
  });

  return messages.map(formatForumMessage);
};

export const createForumMessage = async (
  userId: number,
  conteudo: string,
  roomId?: number
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return { status: 404, error: "Sessão expirada. Faça login novamente." };
  }

  const room = roomId
    ? await prisma.forumRoom.findUnique({ where: { id: roomId } })
    : await findDefaultForumRoom();

  if (!room) {
    return { status: 404, error: "Fórum não encontrado." };
  }

  if (room.padrao) {
    await ensureUserInDefaultForumRooms(userId);
  } else {
    const membership = await prisma.forumMembership.findUnique({
      where: {
        userId_roomId: { userId, roomId: room.id },
      },
      select: { id: true },
    });

    if (!membership) {
      return {
        status: 403,
        error: "Entre neste fórum antes de enviar mensagens.",
      };
    }
  }

  const created = await prisma.forumMessage.create({
    data: {
      userId,
      roomId: room.id,
      conteudo,
    },
    include: {
      user: { select: forumAuthorSelect },
    },
  });

  return {
    message: formatForumMessage(created),
  };
};

