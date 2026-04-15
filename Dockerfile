FROM node:22-slim

# Build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy rest of source and build Next.js
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Migrations run at container start so new schema changes apply on each deploy
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
