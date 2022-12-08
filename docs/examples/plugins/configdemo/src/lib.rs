#[macro_use]
extern crate serverapi;

use std::str;
use serverapi::{Decoder, DecoderBuilder, DecodedContents, DecodingAttribute, Config};
use rdkafka::message::OwnedMessage;

#[derive(Debug, Default)]
pub struct ConfigDemoBuilder {}

#[async_trait]
impl DecoderBuilder for ConfigDemoBuilder {
    async fn build(&self, config: Box<dyn Config + Send>) -> Box<dyn Decoder>{
        Box::new(ConfigDemo::new(config))
    }
}


#[derive(Debug)]
pub struct ConfigDemo {
    port: String,
    demo_var: String,
}

impl ConfigDemo {
    fn new(config: Box<dyn Config + Send>) -> Self {
        Self {
            port: config.get_string("server.port".to_string()).unwrap_or("unknown port".to_string()),
            demo_var: config.get_string("configdemo.demo-var".to_string()).unwrap_or("unknown demo var".to_string()),
        }
    }
}

#[async_trait]
impl Decoder for ConfigDemo {
    fn id(&self) -> &'static str  {
        "config_demo"
    }

    fn display_name(&self) -> &'static str  {
        "Config Demo"
    }

    async fn decode(&self, _: &OwnedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String> {
        match attribute {
            DecodingAttribute::Key => Ok(DecodedContents{json: Some("Config Demo Key".to_string())}),
            DecodingAttribute::Value => Ok(DecodedContents{json: Some(format!("{{\"server_port\":{}, \"demo\":{}}}",
                self.port,
                self.demo_var,
            ).to_string())})
        }
    }
}

declare_plugin!(ConfigDemoBuilder, ConfigDemoBuilder::default);