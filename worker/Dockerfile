FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# Mount the same uploads volume the backend writes to.
VOLUME ["/app/uploads"]

CMD ["node", "src/index.js"]
