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
# Next.js standalone server respects PORT and HOSTNAME env vars
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Copy static assets into the standalone bundle location expected by server.js
RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public

# PORT is injected by Railway at runtime
CMD ["node", ".next/standalone/server.js"]
