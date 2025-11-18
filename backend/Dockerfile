FROM node:20-alpine AS builder

WORKDIR /server

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build
RUN ls -la

FROM node:20-alpine

WORKDIR /server

COPY --from=builder /server/package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /server/dist ./dist
COPY --from=builder /server/public ./public
COPY --from=builder /server/swaggerConfig.js ./

EXPOSE 5000
CMD [ "node", "dist/app.js" ]