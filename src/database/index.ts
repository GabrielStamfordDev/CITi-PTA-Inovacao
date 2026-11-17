import "dotenv/config";
import { PrismaClient } from "@prisma/client";

if (process.env.DATABASE_URL?.includes("${")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /\$\{([^}]+)\}/g,
    (_, key) => process.env[key] ?? ""
  );
}

const prisma = new PrismaClient();

export default prisma;
