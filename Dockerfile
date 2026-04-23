# Stage 1: Build the React frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/auth-app/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy frontend source
COPY frontend/auth-app/public ./public
COPY frontend/auth-app/src ./src
COPY frontend/auth-app/tailwind.config.js ./
COPY frontend/auth-app/postcss.config.js ./

# Build the frontend
RUN NODE_OPTIONS=--openssl-legacy-provider npm run build

# Stage 2: Build the final image with Python backend
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source (inclut entrypoint.sh et init_admin.py)
COPY backend ./backend

# Copy the built frontend from the builder stage
COPY --from=frontend-builder /app/frontend/build ./frontend/build
COPY --from=frontend-builder /app/frontend/build ./frontend_dist

# Install a simple static file server (optional)
RUN pip install --no-cache-dir whitenoise

# Create required directories
RUN mkdir -p /app/backend/fichiers_reçus

# --- MODIFICATIONS POUR L'ENTRYPOINT ---

# On s'assure que le script a les droits d'exécution
# Et on corrige les fins de ligne (au cas où vous l'ayez édité sous Windows)
RUN chmod +x /app/backend/entrypoint.sh && \
    sed -i 's/\r$//' /app/backend/entrypoint.sh

# Expose ports
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/docs')" || exit 1

# Le répertoire de travail pour l'exécution
WORKDIR /app/backend

# On utilise ENTRYPOINT pour lancer le script qui gère l'init
ENTRYPOINT ["/app/backend/entrypoint.sh"]
