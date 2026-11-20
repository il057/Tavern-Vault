FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY client/package.json ./client/
RUN npm --prefix client install
COPY client ./client
RUN npm --prefix client run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3456
COPY package.json ./
COPY server/package.json ./server/
RUN npm --prefix server install --omit=dev
COPY server ./server
COPY --from=builder /app/client/dist ./client/dist
VOLUME ["/app/data"]
EXPOSE 3456
CMD ["npm", "start"]
