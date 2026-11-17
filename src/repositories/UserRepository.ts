import prisma from "../database";

export const userSafeSelect = {
  id: true,
  nome: true,
  email: true,
  dataNascimento: true,
  idade: true,
  pessoaComAlzheimer: true,
  parentesco: true,
  estagioDaDoenca: true,
  cidade: true,
  estado: true,
  createdAt: true,
};

export const createUser = async (data: {
  nome: string;
  email: string;
  senha: string;
  dataNascimento?: string | null;
  idade?: number | null;
  pessoaComAlzheimer?: string | null;
  parentesco?: string | null;
  estagioDaDoenca?: string | null;
  cidade?: string | null;
  estado?: string | null;
}) => {
  return await prisma.user.create({
    data,
    select: userSafeSelect,
  });
};

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const findUserById = async (id: number) => {
  return await prisma.user.findUnique({
    where: { id },
    select: userSafeSelect,
  });
};

export const updateUserProfile = async (
  id: number,
  data: {
    nome?: string;
    dataNascimento?: string | null;
    idade?: number | null;
    pessoaComAlzheimer?: string | null;
    parentesco?: string | null;
    estagioDaDoenca?: string | null;
    cidade?: string | null;
    estado?: string | null;
  }
) => {
  return await prisma.user.update({
    where: { id },
    data,
    select: userSafeSelect,
  });
};

export const invalidatePreviousResetTokens = async (userId: number) => {
  return await prisma.passwordResetToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });
};

export const createPasswordResetToken = async (data: {
  userId: number;
  codeHash: string;
  expiresAt: Date;
}) => {
  return await prisma.passwordResetToken.create({ data });
};

export const findLatestActiveResetToken = async (userId: number) => {
  return await prisma.passwordResetToken.findFirst({
    where: { userId, used: false },
    orderBy: { createdAt: "desc" },
  });
};

export const incrementResetTokenAttempts = async (id: number) => {
  return await prisma.passwordResetToken.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
};

export const markResetTokenUsed = async (id: number) => {
  return await prisma.passwordResetToken.update({
    where: { id },
    data: { used: true },
  });
};

export const completePasswordReset = async (
  userId: number,
  tokenId: number,
  novaSenhaHash: string
) => {
  return await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { senha: novaSenhaHash },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    }),
    prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { used: true },
    }),
  ]);
};
