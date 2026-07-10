import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrate needs a direct (non-pgbouncer) connection; runtime queries use
    // the pooled DATABASE_URL via the Neon driver adapter instead (lib/prisma.js).
    url: env('DATABASE_URL_UNPOOLED'),
  },
})
