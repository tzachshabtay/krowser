use rdkafka::message::BorrowedMessage;
use async_trait::async_trait;
use std::any::Any;

pub struct DecodedContents {
    pub json: Option<String>,
    pub schema: Option<String>,
}

pub enum DecodingAttribute {
    Key,
    Value,
}

#[async_trait]
pub trait Decoder: Any + Send + Sync {
    /// A name for the decoder (will appear in a protocol column and in logs).
    fn name(&self) -> &'static str;

    /// This is called on startup to enable initializiing resources.
    async fn on_init(&self);

    /// Should attempt to decode a kafka message's key/value into json (the attribute instructs whether to decode the key or the value).
    /// If the key/value is not encoded in a protocol the decoder understands,
    /// it's expected to return None in the json field, not return an error.
    /// An error should signify that the decoder is unable to decoded unrelated to the message contents (like failing to connect to a schema provider).
    async fn decode(&self, message: &BorrowedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String>;
}
