# Django backend image for Outverse.
# Multi-stage: builder installs deps, runtime copies them into a slim image.
FROM python:3.11-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for psycopg2 + Pillow + audio handling.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libjpeg-dev zlib1g-dev libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip && \
    /opt/venv/bin/pip install -r requirements.txt

# ---- runtime ----
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 libjpeg62-turbo zlib1g libwebp7 \
    && rm -rf /var/lib/apt/lists/* && \
    useradd -m -u 1000 outverse

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=outverse:outverse . .

# Pre-create the directories that get overmounted by named volumes in prod
# compose (media/staticfiles) — Docker gives a fresh named volume root:root
# ownership unless the image path it covers already has the right owner.
RUN mkdir -p /app/media /app/staticfiles && chown -R outverse:outverse /app/media /app/staticfiles

USER outverse

EXPOSE 8000

# Daphne for ASGI (websockets). Falls back to runserver in dev compose.
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "outverse.asgi:application"]
