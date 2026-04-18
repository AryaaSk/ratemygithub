# Base image for the grading sandbox. Small, no GUI, egress narrowed later
# in E2B's template config. Everything lives in /agent.
FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates curl git ripgrep \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /agent

# Pin the Anthropic SDK. Grading uses Anthropic tool-use directly, so this is
# the only runtime dependency we need in the sandbox.
RUN npm init -y >/dev/null \
  && npm install --omit=dev \
       @anthropic-ai/sdk@latest

# Entrypoint is copied in from the repo's sandbox/ folder at build time.
COPY grade.js /agent/grade.js

# Default command is overridden by the orchestrator, but useful for sanity.
CMD ["node", "/agent/grade.js"]
