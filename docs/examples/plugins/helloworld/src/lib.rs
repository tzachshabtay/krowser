#[macro_use]
extern crate serverapi;

use std::str;
use serverapi::{Decoder, DecoderBuilder, DecodedContents, DecodingAttribute, Config};
use rdkafka::message::OwnedMessage;

#[derive(Debug, Default)]
pub struct HelloWorldBuilder {}

#[async_trait]
impl DecoderBuilder for HelloWorldBuilder {
    async fn build(&self, _: Box<dyn Config + Send>) -> Box<dyn Decoder>{
        Box::new(HelloWorld{})
    }
}

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

    async fn decode(&self, _: &OwnedMessage, _: &DecodingAttribute) -> Result<DecodedContents, String> {
        Ok(DecodedContents{json: Some(r#"{"hello_world":true}"#.to_string())})
    }
}

declare_plugin!(HelloWorldBuilder, HelloWorldBuilder::default);