#[macro_use]
extern crate serverapi;

use std::str;
use serverapi::{Decoder, DecodedContents, DecodingAttribute, Config};
use rdkafka::message::BorrowedMessage;
use std::sync::RwLock;

#[derive(Debug, Default)]
pub struct ConfigDemo {
    port: RwLock<Option<String>>,
    demo_var: RwLock<Option<String>>,
}

#[async_trait]
impl Decoder for ConfigDemo {
    fn id(&self) -> &'static str  {
        "config_demo"
    }

    fn display_name(&self) -> &'static str  {
        "Config Demo"
    }

    async fn on_init(&self, config: Box<dyn Config + Send>) {
        let mut port = self.port.write().unwrap();
        let mut demo_var = self.demo_var.write().unwrap();
        *port = Some(config.get_string("server.port".to_string()).unwrap_or("unknown port".to_string()));
        *demo_var = Some(config.get_string("configdemo.demo-var".to_string()).unwrap_or("unknown demo var".to_string()));
    }

    async fn decode(&self, _: &BorrowedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String> {
        match attribute {
            DecodingAttribute::Key => Ok(DecodedContents{json: Some("Config Demo Key".to_string())}),
            DecodingAttribute::Value => Ok(DecodedContents{json: Some(format!("{{\"server_port\":{}, \"demo\":{}}}",
                self.port.read().unwrap().as_ref().unwrap(),
                self.demo_var.read().unwrap().as_ref().unwrap(),
            ).to_string())})
        }
    }
}

declare_plugin!(ConfigDemo, ConfigDemo::default);