import dotenv from 'dotenv';

dotenv.config();

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key} (copy .env.example to .env)`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8080),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  databaseUrl: required(
    'DATABASE_URL',
    'postgresql://retailpulse:retailpulse@localhost:5432/retailpulse'
  ),
  pgSsl: String(process.env.PGSSL ?? 'false') === 'true',

  jwtSecret: required('JWT_SECRET', 'dev-only-change-me-7f3a9c1e5b2d4086'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),

  seedDefaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? 'Passw0rd!',

  embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1536),
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',

  get isProd() {
    return this.nodeEnv === 'production';
  },
};

export default env;
