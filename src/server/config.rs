use std::env;
use once_cell::sync::Lazy;

pub static KAFKA_URLS: Lazy<String> = Lazy::new(||get_string("KAFKA_URLS", "localhost:9092"));

pub static SCHEMA_REGISTRY_URL: Lazy<String> = Lazy::new(||get_string("SCHEMA_REGISTRY_URL", "http://localhost:8081"));

pub static KAFKA_CONNECT_URL: Lazy<String> = Lazy::new(||get_string("KAFKA_CONNECT_URL", "http://localhost:8083"));

fn get_string(name: &str, default: &str) -> String {
    env::var(name).unwrap_or(default.to_string())
}