# Bun-only production image for the No Rules WebSocket server.
FROM oven/bun:1.4.3-slim

WORKDIR /app

COPY server/package.json ./
RUN bun install --production --no-progress

COPY server/src ./src

RUN mkdir -p /data && chown -R bun:bun /data
USER bun

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DB_PATH=/data/no-rules.db

EXPOSE 8787
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["bun", "src/index.js"]
