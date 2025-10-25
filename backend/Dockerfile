# Stage 1: Build the TypeScript code
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create the final, lighter production image
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .

ENV NODE_ENV production
ENV PORT 10000
EXPOSE 10000
CMD ["npm", "start"]