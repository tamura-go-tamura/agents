# Multi-stage build for FastAPI + Next.js
FROM node:18-bullseye AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci --only=production

# Copy frontend source and build
COPY frontend/ ./
RUN npm install
RUN npm run build

# Final stage - combine both
FROM python:3.11-bullseye

WORKDIR /app

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*


# Copy backend code
COPY adk-backend/ ./backend/
RUN python -m pip install -r backend/requirements.txt

# Copy built frontend
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# Copy startup script
COPY ./start.sh ./
RUN chmod +x start.sh

# Expose port
EXPOSE 3000


# Start both services
CMD ["./start.sh"]
