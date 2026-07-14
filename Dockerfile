FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

COPY server ./server
COPY public ./public

EXPOSE 8080
CMD ["node", "server/index.js"]
