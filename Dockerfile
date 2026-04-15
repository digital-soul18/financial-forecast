FROM node:22-slim

# Build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy schema before installing so postinstall (prisma generate) can find it
COPY prisma ./prisma
COPY package.json package-lock.json ./
RUN npm ci

# Copy rest of source and build Next.js
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Railway injects PORT — Next.js must bind to it or the healthcheck fails
ENV PORT=3000
EXPOSE 3000

# Migrations run at container start so new schema changes apply on each deploy
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/next start -p ${PORT:-3000} -H 0.0.0.0"]
