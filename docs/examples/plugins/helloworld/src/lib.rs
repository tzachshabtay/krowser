#[macro_use]
extern crate serverapi;

use std::str;
use serverapi::{Decoder, DecodedContents, DecodingAttribute};
use rdkafka::message::BorrowedMessage;

#[derive(Debug, Default)]
pub struct HelloWorld;

#[async_trait]
impl Decoder for HelloWorld {
    fn id(&self) -> &'static str  {
        "hello_world"
    }

    fn display_name(&self) -> &'static str  {
        "Hello World"
    }

    async fn on_init(&self) {
        format!("HelloWorld loaded");
    }

    async fn decode(&self, _: &BorrowedMessage, _: &DecodingAttribute) -> Result<DecodedContents, String> {
        Ok(DecodedContents{json: Some(r#"{"hello_world":true}"#.to_string()), schema: None})
    }
}

declare_plugin!(HelloWorld, HelloWorld::default);