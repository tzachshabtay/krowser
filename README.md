<p align="center">
    <img src="./logo.svg">
</p>

# Krowser

Web UI to browse [kafka](https://kafka.apache.org/), [schema registry](https://docs.confluent.io/current/schema-registry/index.html) and [kafka-connect](https://docs.confluent.io/platform/current/connect/).

## Features

- View kafka's topics, partitions, messages, consumer groups and brokers.
- View Confluent schema registry's subjects and schemas.
- View kafka-connect's connectors and tasks.
- The grid view destructures the messages/schemas (even nested json) into separate columns, and each of the columns can be (client-side) filtered and sorted.
- A decoding framework that allows for decoding messages by either auto-detecting the format from a configured list of decoders (with the ability to specify a different list of decoders for different topics or groups of topics) or by selecting the decoding from a list in the UI.
- Write your own custom decoder by implementing an interface, see [example](./docs/examples/plugins/readme.md).
- Or, use one of the built-in decoders:
    - Avro (using Confluent schema registry)
    - UTF-8
    - Raw bytes
- The decoding framework supports different decoded messages in the same topic, and different decodings for keys and values for the same message. The avro decoder supports different subject messages in a topic. As you filter for a specific event type it auto-hides all of the irrelevant columns belonging to the other messages.
- The raw view shows the data in json format, and allows easy copying to clipboard
- Server-side search for messages and the ability to search multiple topics at once
- Filter messages via time range (or offsets/newest/oldest)
- Auto-refresh toggle
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
`docker run -it -p 9999:9999 --env KROWSER__KAFKA__URLS=host.docker.internal:9092 --env KROWSER__CONFLUENT_SCHEMA_REGISTRY__URL=host.docker.internal:8081 tzachs/krowser`

Alternatively, you can use a `config.toml` config file to specify configurations. It needs to be placed in the same folder as the krowser binary (or in the `src/server` folder if you're running from source).

All available configurations can be seen in [the default config file](./src/server/default.toml).

Note that for specifying custom decoders for specific topics you have to use a config file, this is currently not supported via environment variables.

A [docker-compose example](./docs/examples/docker-compose.yml) is also available.

## Local Development

- Node.js v12 and Rust 2021 edition need to be installed first
- To install dependencies for the frontend, run: `npm i`
- To build backend, run: `npm run build:backend`
- To build frontend, run: `npm run build:frontend`
- To start the server, run: `npm start`
- If you need local kafka and schema registry (and zookeeper), run `npm run kafka-up`, and wait a few minutes (and run `npm run kafka-down` to shut those down)
- If you need dummy messages to be inserted to kafka, run `npm run insert-events`
- To build the docker image, run: `docker build -t krowser .`
