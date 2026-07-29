FROM node:24-alpine AS build

WORKDIR /app
COPY web/package*.json web/
RUN npm --prefix web install

# locale/ sits next to web/ (not inside it) — lib/i18n.js imports
# ../../locale/*.json, and next.config.js's turbopack.root points one level
# up from web/ for the same reason.
COPY web ./web
COPY locale ./locale
RUN npm --prefix web run build

FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY locale ./locale
COPY --from=build /app/web/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000
ENV TELEGRAM_NOTIFY_URL=
ENV APP_TIMEZONE=Europe/Moscow
EXPOSE 3000

CMD ["node", "server.js"]
