use std::env;
use once_cell::sync::Lazy;

pub static KAFKA_URLS: Lazy<String> = Lazy::new(||get_string("KAFKA_URLS", "localhost:9092"));

pub static SCHEMA_REGISTRY_URL: Lazy<String> = Lazy::new(||get_string("SCHEMA_REGISTRY_URL", "http://localhost:8081"));

pub static KAFKA_CONNECT_URL: Lazy<String> = Lazy::new(||get_string("KAFKA_CONNECT_URL", "http://localhost:8083"));

pub static SERVER_PORT: Lazy<i32> = Lazy::new(||get_int("SERVER_PORT", "9999"));

fn get_string(name: &str, default: &str) -> String {
    env::var(name).unwrap_or(default.to_string())
}

fn get_int(name: &str, default: &str) -> i32 {
    let envstr = env::var(name).unwrap_or(default.to_string());
    envstr.parse::<i32>().unwrap()
}