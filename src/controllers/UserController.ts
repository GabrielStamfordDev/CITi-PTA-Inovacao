import crypto from "crypto";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as UserRepository from "../repositories/UserRepository";
import { sendPasswordResetEmail } from "../services/MailService";

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

export const register = async (req: Request, res: Response) => {
  try {
    const { nome, email, senha } = req.body;

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
    });

    return res.status(201).json({
      id: user.id,
      nome: user.nome,
      email: user.email,
    });
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

    return res.status(200).json({
      id: user.id,
      nome: user.nome,
      email: user.email,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao realizar login." });
  }
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

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Usuário inválido." });
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
