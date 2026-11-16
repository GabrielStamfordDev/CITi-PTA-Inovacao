import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as UserRepository from "../repositories/UserRepository";

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

export const recoverPassword = async (req: Request, res: Response) => {
  try {
    const { email, novaSenha } = req.body;

    if (typeof email !== "string" || typeof novaSenha !== "string" || !email.trim() || !novaSenha) {
      return res.status(400).json({ message: "Informe o email e a nova senha." });
    }

    const user = await UserRepository.findUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ message: "Email não encontrado no sistema." });
    }

    const hashed = await bcrypt.hash(novaSenha, 8);
    await UserRepository.updatePasswordByEmail(user.email, hashed);

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
