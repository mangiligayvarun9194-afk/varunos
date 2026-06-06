FROM python:3.11-slim

WORKDIR /opt/varunos

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gcc && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code
COPY varunos/ ./varunos/
COPY scripts/ ./scripts/
COPY examples/ ./examples/
COPY pwa/ ./pwa/
COPY tests/ ./tests/

# Persistent data dir
RUN mkdir -p /data

# Create non-root user and give them ownership of the data dir
RUN useradd -m -u 1000 varunos && chown -R varunos:varunos /opt/varunos /data
USER varunos

# Healthcheck (runs as varunos user)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/healthz || exit 1

EXPOSE 8000

ENV VARUNOS_SERVE_PWA=1

# Default uvicorn command. Override with -e CMD=... in compose if you need it.
CMD ["uvicorn", "varunos.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
