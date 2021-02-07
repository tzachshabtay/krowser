<p align="center">
    <img src="./logo.svg">
</p>

# Krowser

Web UI to browse [kafka](https://kafka.apache.org/) and [schema registry](https://docs.confluent.io/current/schema-registry/index.html).

## Features

- View kafka's topics, partitions, messages, consumer groups and brokers.
- View schema registry's subjects and schemas.
- The grid view destructures the messages/schemas (even nested json) into separate columns, and each of the columns can be (client-side) filtered and sorted.
- Support for avro auto-detecting and decoding (via the schema registry). Different subject messages in a topic are supported as well (and as you filter for a specific event type it auto-hides all of the irrelevant columns belonging to the other messages).
- The raw view shows the data in json format, and allows easy copying to clipboard
- Server-side search for messages and the ability to search multiple topics at once
- Filter messages via time range (or offsets)
- Light and dark themes

## Images

### Topics View (light theme)

![Topics View (light theme)](./docs/images/topics.png "Topics View (light theme)")

### Messages View (dark theme)

![Messages View (dark theme)](/docs/images/messages.png "Messages View (dark theme)")

## Usage

A [docker](https://www.docker.com/) image is available in [dockerhub](https://hub.docker.com/repository/docker/tzachs/krowser/).

Run it via: `docker run -it -p 9999:9999 tzachs/krowser`

If you need to configure URLs (of kafka, schema registry), you can run, for example (if you need to run against local kafka and schema-registry):
`docker run -it -p 9999:9999 --env KAFKA_URL=host.docker.internal:9092 --env SCHEMA_REGISTRY_URL=host.docker.internal:8081 tzachs/krowser`

All available environment variable configurations can be seen in [the config file](./src/server/config.ts).

A [docker-compose example](./docs/examples/docker-compose.yml) is also available.

## Local Development

- To install dependencies (`nodejs` v12 needs to be installed first), run: `npm i`
- To build backend, run: `npm run build:backend`
- To build frontend, run: `npm run build:frontend`
- To start the server, run: `npm start`
- If you need local kafka and schema registry (and zookeeper), run `npm run kafka-up`, and wait a few minutes (and run `npm run kafka-down` to shut those down)
- If you need dummy messages to be inserted to kafka, run `npm run insert-events`
- To build the docker image, run: `docker build -t krowser .`


