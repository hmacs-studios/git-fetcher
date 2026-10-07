#!/bin/bash
# Startup script for medistics-rag-service container
# Fixes the issue where the service couldn't find the RAG index files

docker stop medistics-rag-service 2>/dev/null || true
docker rm medistics-rag-service 2>/dev/null || true

docker run -d \
  --name medistics-rag-service \
  --restart unless-stopped \
  -p 8001:8001 \
  -v /home/ubuntu/.mdcat_rag:/app/out \
  -v /home/ubuntu/medistics_rag_service.py:/app/medistics_rag_service.py \
  medistics-rag-builder:latest \
  uvicorn medistics_rag_service:app --host 0.0.0.0 --port 8001
