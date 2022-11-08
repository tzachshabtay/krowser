use config::{Config, ConfigError, Environment, File, Case};
use serde_derive::Deserialize;
use once_cell::sync::Lazy;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct KafkaTopic {
    pub name: String,
    pub decoders: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Kafka {
    pub urls: String,
    pub decoders: String,
    pub kafka_topics: Option<Vec<KafkaTopic>>, //todo: support reading this from environment variables, see: https://github.com/mehcode/config-rs/blob/master/src/env.rs#L45 and for the individual kafka topic object: https://serde.rs/string-or-struct.html
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ConfluentSchemaRegistry {
    pub url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct KafkaConnect {
    pub url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Server {
    pub port: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
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
            .add_source(Environment::default().prefix("KROWSER").convert_case(Case::Kebab).separator("__"))
            .build()?;

        s.try_deserialize()
    }
}

pub static SETTINGS: Lazy<Settings> = Lazy::new(||Settings::new().unwrap());
