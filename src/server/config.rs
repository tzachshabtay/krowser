use std::env;
use once_cell::sync::Lazy;

pub static KAFKA_URLS: Lazy<String> = Lazy::new(||get_string("KAFKA_URLS", "localhost:9092"));

fn get_string(name: &str, default: &str) -> String {
    env::var(name).unwrap_or(default.to_string())
}