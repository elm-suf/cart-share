FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for better-sqlite3 build (if prebuilt binary isn't available)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
# Python/make/g++ might be needed again for better-sqlite3 install if it builds from source
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create a directory for the database volume
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DB_PATH=/app/data/database.db

# If the server uses process.env.PORT, default to 3000
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
