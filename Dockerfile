FROM node:12.18.0-buster AS base
WORKDIR /usr/src/krowser
COPY package*.json ./

FROM base AS dependencies
RUN npm i

# TODO test container
FROM dependencies AS test
COPY . .
RUN  npm run test

FROM dependencies AS release
COPY . .
RUN npm run build:backend
RUN npm run build:frontend
CMD npm start