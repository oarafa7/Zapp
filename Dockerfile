FROM node:22-alpine AS runtime

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5173
CMD ["npm", "start"]
