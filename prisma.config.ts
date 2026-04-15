import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// On Railway, DATABASE_URL = "file:/data/finance.db" (persistent volume)
// Locally, fall back to the dev database in the prisma/ directory
const datasourceUrl =
  process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma/finance.db")}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
