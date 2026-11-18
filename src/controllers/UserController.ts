import crypto from "crypto";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as UserRepository from "../repositories/UserRepository";
import * as AppRepository from "../repositories/AppRepository";
import { sendPasswordResetEmail } from "../services/MailService";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_TTL_MS,
  signAuthToken,
} from "../utils/authToken";

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

function attachAuthSession(res: Response, userId: number, email: string): string {
  const token = signAuthToken(userId, email);
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_TOKEN_TTL_MS,
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

function sanitizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalAge(value: unknown): { valid: boolean; value: number | null } {
  if (value === undefined || value === null || value === "") {
    return { valid: true, value: null };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 10 || parsed > 120) {
    return { valid: false, value: null };
  }
  return { valid: true, value: parsed };
}

function parseBirthDate(
  value: unknown
): { valid: boolean; dataNascimento: string | null; idade: number | null } {
  if (value === undefined || value === null || value === "") {
    return { valid: true, dataNascimento: null, idade: null };
  }
  if (typeof value !== "string") {
    return { valid: false, dataNascimento: null, idade: null };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: true, dataNascimento: null, idade: null };
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return { valid: false, dataNascimento: null, idade: null };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const parsedDate = new Date(year, month - 1, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return { valid: false, dataNascimento: null, idade: null };
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const mDiff = today.getMonth() - (month - 1);
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
    age--;
  }

  if (age < 10 || age > 120) {
    return { valid: false, dataNascimento: null, idade: null };
  }

  return { valid: true, dataNascimento: trimmed, idade: age };
}

export const register = async (req: Request, res: Response) => {
  try {
    const {
      nome,
      email,
      senha,
      dataNascimento,
      idade,
      pessoaComAlzheimer,
      parentesco,
      estagioDaDoenca,
      cidade,
      estado,
    } = req.body;

    if (
      typeof nome !== "string" ||
      typeof email !== "string" ||
      typeof senha !== "string" ||
      !nome.trim() ||
      !email.trim() ||
      !senha
    ) {
      return res.status(400).json({ message: "Preencha nome, email e senha." });
    }

    if (senha.length < 6) {
      return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
    }

    const parsedBirth = parseBirthDate(dataNascimento);
    if (!parsedBirth.valid) {
      return res
        .status(400)
        .json({ message: "Informe uma data de nascimento válida no formato dd/mm/aaaa." });
    }

    const parsedAge = parseOptionalAge(idade);
    if (!parsedAge.valid) {
      return res.status(400).json({ message: "Informe uma idade válida (entre 10 e 120 anos)." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await UserRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ message: "Este email já está cadastrado." });
    }

    const hashedPassword = await bcrypt.hash(senha, 8);
    const user = await UserRepository.createUser({
      nome: nome.trim(),
      email: normalizedEmail,
      senha: hashedPassword,
      dataNascimento: parsedBirth.dataNascimento,
      idade: parsedBirth.idade ?? parsedAge.value,
      pessoaComAlzheimer: sanitizeOptionalString(pessoaComAlzheimer),
      parentesco: sanitizeOptionalString(parentesco),
      estagioDaDoenca: sanitizeOptionalString(estagioDaDoenca),
      cidade: sanitizeOptionalString(cidade),
      estado: sanitizeOptionalString(estado),
    });

    try {
      await AppRepository.ensureUserInDefaultForumRooms(user.id);
    } catch (forumErr) {
      console.warn("Não foi possível inscrever usuário na sala padrão do fórum:", forumErr);
    }

    const token = attachAuthSession(res, user.id, user.email);
    return res.status(201).json({ ...user, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao registrar usuário." });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, senha } = req.body;

    if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha) {
      return res.status(400).json({ message: "Informe email e senha." });
    }

    const user = await UserRepository.findUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ message: "Email ou senha incorretos." });
    }

    const validPassword = await bcrypt.compare(senha, user.senha);
    if (!validPassword) {
      return res.status(401).json({ message: "Email ou senha incorretos." });
    }

    const token = attachAuthSession(res, user.id, user.email);
    return res.status(200).json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      dataNascimento: user.dataNascimento,
      idade: user.idade,
      pessoaComAlzheimer: user.pessoaComAlzheimer,
      parentesco: user.parentesco,
      estagioDaDoenca: user.estagioDaDoenca,
      cidade: user.cidade,
      estado: user.estado,
      createdAt: user.createdAt,
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao realizar login." });
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  return res.status(200).json({ message: "Sessão encerrada com sucesso." });
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "Informe um email válido." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const genericMessage =
      "Se o email estiver cadastrado, enviamos um código de 6 dígitos para sua caixa de entrada.";

    const user = await UserRepository.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(200).json({ message: genericMessage, deliveryMode: "email" });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await UserRepository.invalidatePreviousResetTokens(user.id);
    const createdToken = await UserRepository.createPasswordResetToken({
      userId: user.id,
      codeHash,
      expiresAt,
    });

    try {
      const deliveryMode = await sendPasswordResetEmail({
        toEmail: user.email,
        toName: user.nome,
        code,
      });

      return res.status(200).json({
        message:
          deliveryMode === "console"
            ? "Modo demo sem API de email: confira o código no terminal do servidor."
            : genericMessage,
        deliveryMode,
      });
    } catch (mailError) {
      await UserRepository.markResetTokenUsed(createdToken.id);
      console.error("Erro ao enviar email de recuperação:", mailError);
      return res.status(500).json({
        message: "Não foi possível enviar o email de recuperação. Verifique as chaves no .env.",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao solicitar recuperação de senha." });
  }
};

export const confirmPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email, codigo, novaSenha } = req.body;

    if (
      typeof email !== "string" ||
      typeof codigo !== "string" ||
      typeof novaSenha !== "string" ||
      !email.trim() ||
      !codigo.trim() ||
      !novaSenha
    ) {
      return res.status(400).json({ message: "Preencha email, código e nova senha." });
    }

    const cleanCode = codigo.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ message: "O código deve conter 6 dígitos numéricos." });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres." });
    }

    const user = await UserRepository.findUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(400).json({ message: "Código inválido ou expirado." });
    }

    const token = await UserRepository.findLatestActiveResetToken(user.id);
    if (!token) {
      return res.status(400).json({ message: "Código inválido ou expirado. Solicite um novo." });
    }

    if (token.expiresAt <= new Date()) {
      await UserRepository.markResetTokenUsed(token.id);
      return res.status(400).json({ message: "Código expirado. Solicite um novo código." });
    }

    if (token.attempts >= MAX_RESET_ATTEMPTS) {
      await UserRepository.markResetTokenUsed(token.id);
      return res
        .status(429)
        .json({ message: "Limite de tentativas excedido. Solicite um novo código." });
    }

    const isMatch = await bcrypt.compare(cleanCode, token.codeHash);
    if (!isMatch) {
      const updated = await UserRepository.incrementResetTokenAttempts(token.id);
      if (updated.attempts >= MAX_RESET_ATTEMPTS) {
        await UserRepository.markResetTokenUsed(token.id);
      }
      return res.status(400).json({ message: "Código inválido ou expirado." });
    }

    const hashed = await bcrypt.hash(novaSenha, 8);
    await UserRepository.completePasswordReset(user.id, token.id, hashed);

    return res.status(200).json({ message: "Senha redefinida com sucesso!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao redefinir senha." });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ message: "Sessão não autenticada." });
    }

    const user = await UserRepository.findUserById(req.authUserId);
    if (!user) {
      res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar usuário." });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Usuário inválido." });
    }

    if (userId !== req.authUserId) {
      return res
        .status(403)
        .json({ message: "Acesso negado: você não pode visualizar o perfil de outro usuário." });
    }

    const user = await UserRepository.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar usuário." });
  }
};

async function performProfileUpdate(userId: number, body: any, res: Response) {
  const existing = await UserRepository.findUserById(userId);
  if (!existing) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const {
    nome,
    dataNascimento,
    idade,
    pessoaComAlzheimer,
    parentesco,
    estagioDaDoenca,
    cidade,
    estado,
  } = body || {};

  if (typeof nome !== "string" || !nome.trim()) {
    return res.status(400).json({ message: "O nome não pode ficar vazio." });
  }

  const parsedBirth = parseBirthDate(dataNascimento);
  if (!parsedBirth.valid) {
    return res
      .status(400)
      .json({ message: "Informe uma data de nascimento válida no formato dd/mm/aaaa." });
  }

  const parsedAge = parseOptionalAge(idade);
  if (!parsedAge.valid) {
    return res.status(400).json({ message: "Informe uma idade válida (entre 10 e 120 anos)." });
  }

  const updated = await UserRepository.updateUserProfile(userId, {
    nome: nome.trim(),
    dataNascimento: parsedBirth.dataNascimento,
    idade: parsedBirth.idade ?? parsedAge.value,
    pessoaComAlzheimer: sanitizeOptionalString(pessoaComAlzheimer),
    parentesco: sanitizeOptionalString(parentesco),
    estagioDaDoenca: sanitizeOptionalString(estagioDaDoenca),
    cidade: sanitizeOptionalString(cidade),
    estado: sanitizeOptionalString(estado),
  });

  return res.status(200).json(updated);
}

export const updateMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ message: "Sessão não autenticada." });
    }
    return await performProfileUpdate(req.authUserId, req.body, res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao atualizar perfil." });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Usuário inválido." });
    }

    if (userId !== req.authUserId) {
      return res
        .status(403)
        .json({ message: "Acesso negado: você não pode alterar o perfil de outro usuário." });
    }

    return await performProfileUpdate(userId, req.body, res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao atualizar perfil." });
  }
};
