use config::{Config, ConfigError, Environment, File};
use serde_derive::Deserialize;
use once_cell::sync::Lazy;

#[derive(Debug, Deserialize)]
pub struct KafkaTopic {
    pub name: String,
    pub decoders: String,
}

#[derive(Debug, Deserialize)]
pub struct Kafka {
    pub urls: String,
    pub decoders: String,
    pub kafka_topics: Option<Vec<KafkaTopic>>,
}

#[derive(Debug, Deserialize)]
pub struct ConfluentSchemaRegistry {
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct KafkaConnect {
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct Server {
    pub port: i32,
}

#[derive(Debug, Deserialize)]
pub struct Settings  {
    pub kafka: Kafka,
    pub confluent_schema_registry: ConfluentSchemaRegistry,
    pub kafka_connect: KafkaConnect,
    pub server: Server,
}

impl Settings {
    pub fn new() -> Result<Self, ConfigError> {
        let s = Config::builder()
            .add_source(File::with_name("default"))
            .add_source(File::with_name("config").required(false))
            .add_source(Environment::default().separator("_"))
            .build()?;

        s.try_deserialize()
    }
}

pub static SETTINGS: Lazy<Settings> = Lazy::new(||Settings::new().unwrap());
