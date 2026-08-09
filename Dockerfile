# Builder Stage
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies required by node-gyp and @napi-rs/canvas
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for building)
RUN npm install

# Copy application source code
COPY . .

# Run any build scripts if needed (e.g., CSS building)
RUN npm run build:css

# Runner Stage
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install runtime dependencies for @napi-rs/canvas and FFmpeg for music
RUN apk add --no-cache cairo pango jpeg giflib librsvg ffmpeg

# Copy node_modules and built assets from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/plugin ./plugin
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/shard.js ./shard.js
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/TODO.md ./TODO.md
COPY --from=builder /app/AGENTS.md ./AGENTS.md

# Set Node ENV to production
ENV NODE_ENV=production

# Expose Dashboard Port
EXPOSE 3070

# Define the run command which includes migrations
CMD ["npm", "start"]
