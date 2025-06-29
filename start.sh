#!/bin/bash

# Start script for Cloud Run deployment
# This script starts both FastAPI backend and Next.js frontend

set -e

echo "Starting SafeComm AI services..."

# Set environment variables
export PORT=${PORT:-3000}
export BACKEND_PORT=${BACKEND_PORT:-8080}
export FRONTEND_PORT=${FRONTEND_PORT:-3000}
export GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT:-"llm-dx-test-387511"}
export GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-"us-central1"}
export GOOGLE_GENAI_USE_VERTEXAI=${GOOGLE_GENAI_USE_VERTEXAI:-"true"}
export NODE_ENV=${NODE_ENV:-"production"}

# Internal API URL for Next.js to communicate with FastAPI
export NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}"

echo "Environment variables:"
echo "  PORT: $PORT"
echo "  BACKEND_PORT: $BACKEND_PORT"  
echo "  FRONTEND_PORT: $FRONTEND_PORT"
echo "  GOOGLE_CLOUD_PROJECT: $GOOGLE_CLOUD_PROJECT"
echo "  NODE_ENV: $NODE_ENV"

# Start FastAPI backend in background
echo "Starting FastAPI backend on port $BACKEND_PORT..."
cd /app/backend
python -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT &
BACKEND_PID=$!

# Start Next.js frontend
echo "Starting Next.js frontend on port $FRONTEND_PORT..."
cd /app/frontend
npm start -- -p $FRONTEND_PORT &
FRONTEND_PID=$!

echo "Both services are running successfully!"
echo "  Backend: http://localhost:$BACKEND_PORT"
echo "  Frontend: http://localhost:$FRONTEND_PORT"

# Function to handle shutdown
shutdown() {
  echo "Shutting down services..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo "Services shut down successfully"
  exit 0
}

# Trap signals for graceful shutdown
trap shutdown SIGTERM SIGINT

# Wait for either process to exit
wait -n $BACKEND_PID $FRONTEND_PID

# If we get here, one of the processes exited
echo "One of the services exited, shutting down..."
shutdown
