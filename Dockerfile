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

FROM python:3.12-slim

WORKDIR /app
COPY package.json ./
COPY locale ./locale
COPY --from=build /app/web/dist ./dist

# api/ stays a sibling of package.json/locale/dist, same relative layout as
# local dev (`uvicorn --app-dir api app.main:app`) — config.py's
# APP_DIR-relative lookups (package.json, data_dir/public_dir/locale_dir
# defaults) and main.py's alembic.ini/alembic/ lookup all derive from
# __file__, so they only keep working with zero code changes if this stays
# a plain source tree at a fixed path, not something pip-installed into
# site-packages (which would physically relocate the files __file__ resolves
# against). Installing only the declared dependencies (read straight out of
# pyproject.toml, not hand-duplicated here) and running against the source
# tree via --app-dir is the same thing local dev already does.
COPY api ./api
RUN pip install --no-cache-dir $(python3 -c "import tomllib; print(' '.join(tomllib.load(open('api/pyproject.toml', 'rb'))['project']['dependencies']))")

ENV APP_TIMEZONE=Europe/Moscow
ENV TELEGRAM_NOTIFY_URL=
EXPOSE 3000

CMD ["sh", "-c", "exec python3 -m uvicorn --app-dir api app.main:app --host 0.0.0.0 --port ${PORT:-3000}"]
