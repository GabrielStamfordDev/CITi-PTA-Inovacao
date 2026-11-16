import prisma from "../database";

export const createUser = async (data: {
  nome: string;
  email: string;
  senha: string;
}) => {
  return await prisma.user.create({ data });
};

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const findUserById = async (id: number) => {
  return await prisma.user.findUnique({
    where: { id },
    select: { id: true, nome: true, email: true, createdAt: true },
  });
};

export const updatePasswordByEmail = async (
  email: string,
  novaSenhaHash: string
) => {
  return await prisma.user.update({
    where: { email },
    data: { senha: novaSenhaHash },
  });
};