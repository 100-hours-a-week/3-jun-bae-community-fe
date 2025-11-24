FROM node:24-alpine

WORKDIR /app

# dependency 설치 먼저
COPY package*.json /app
RUN npm install

COPY . /app

EXPOSE 3000
ENTRYPOINT ["node", "app.js"]