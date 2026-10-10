FROM node:22-alpine

WORKDIR /app

# Install deps first so Docker caches them between code changes
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/server.js"]
