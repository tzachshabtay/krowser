export const SERVER_PORT = parseInt(process.env.SERVER_PORT || `9999`);
export const SCHEMA_REGISTRY_URL = process.env.SCHEMA_REGISTRY_URL || `http://localhost:8081`;
export const KAFKA_URLS = (process.env.KAFKA_URLS || `localhost:9092`).split(`,`);
export const KAFKA_CONNECT_URL = process.env.KAFKA_CONNECT_URL || `http://localhost:8083`;