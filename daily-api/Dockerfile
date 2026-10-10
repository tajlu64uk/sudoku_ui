FROM node:20-alpine
WORKDIR /app

# Reuses the existing, already-tested puzzle engine from the frontend repo —
# no duplication, no separate package.
COPY src/core ./src/core

COPY daily-api/package.json daily-api/package-lock.json* ./daily-api/
RUN cd daily-api && npm install

COPY daily-api/src ./daily-api/src

WORKDIR /app/daily-api
ENV PORT=4000
ENV CANDIDATE_COUNT=20
# Unset by default: generateDaily.ts falls back to os.cpus().length (one worker
# process per core). Override if you want to cap it below the container's CPU limit.
# ENV WORKER_COUNT=4
EXPOSE 4000
VOLUME ["/app/daily-api/data"]

CMD ["npx", "tsx", "src/server.ts"]
