import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads the connection URL from the schema file — the CLI
// takes it from here, and the runtime client takes it from a driver adapter
// (see src/config/prisma.ts).
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
