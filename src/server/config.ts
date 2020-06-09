export const SERVER_PORT = parseInt(process.env.SERVER_PORT || `9999`);
export const SCHEMA_REGISTRY_URL = process.env.SCHEMA_REGISTRY_URL || `http://localhost:8081`;
export const KAFKA_URL = process.env.KAFKA_URL || `localhost:9092`;