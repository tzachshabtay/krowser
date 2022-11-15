use config::{Config, ConfigError, Environment, File, Case};
use serde_derive::Deserialize;
use once_cell::sync::Lazy;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct KafkaTopic {
    pub name: String,
    #[serde(default)]
    pub key_decoders: String,
    #[serde(default)]
    pub value_decoders: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Kafka {
    pub urls: String,
    pub key_decoders: String,
    pub value_decoders: String,
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
        get_config()?.try_deserialize()
    }
}

fn get_config() -> Result<Config, ConfigError> {
    Config::builder()
        .add_source(File::with_name("default"))
        .add_source(File::with_name("config").required(false))
        .add_source(Environment::default().prefix("KROWSER").convert_case(Case::Kebab).separator("__"))
        .build()
}

#[derive(Debug, Default)]
pub struct DynamicConfig {}

impl serverapi::Config for DynamicConfig {
    fn get_string(&self, key: String) -> Option<String> {
        match DYNAMIC_CONFIG.get(&key) {
            Ok(result) => Some(result),
            Err(_) => None,
        }
    }
}

static DYNAMIC_CONFIG: Lazy<Config> = Lazy::new(||get_config().unwrap());

pub static SETTINGS: Lazy<Settings> = Lazy::new(||Settings::new().unwrap());
