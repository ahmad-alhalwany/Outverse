# Next.js frontend image for Outverse — standalone output.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# next.config.js requires @next/bundle-analyzer unconditionally at build time
# (it's a devDependency, only the analysis itself is gated on ANALYZE=true) —
# the standalone runtime image below never copies node_modules from here, so
# there's no cost to installing dev deps at this stage.
RUN npm ci || npm install

FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
