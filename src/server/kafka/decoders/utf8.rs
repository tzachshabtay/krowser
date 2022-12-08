use async_trait::async_trait;
use rdkafka::message::OwnedMessage;
use rdkafka::message::Message;
use serverapi::{Decoder, DecoderBuilder, Config, DecodingAttribute, DecodedContents};

#[derive(Debug, Default)]
pub struct Utf8DecoderBuilder {}

#[async_trait]
impl DecoderBuilder for Utf8DecoderBuilder {
    async fn build(&self, _: Box<dyn Config + Send>) -> Box<dyn Decoder>{
        Box::new(Utf8Decoder{})
    }
}

#[derive(Debug, Default)]
pub struct Utf8Decoder {
}

#[async_trait]
impl Decoder for Utf8Decoder {
    fn id(&self) -> &'static str  {
        "utf8"
    }

    fn display_name(&self) -> &'static str  {
        "UTF-8"
    }

    async fn decode(&self, message: &OwnedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String> {
        match attribute {
            DecodingAttribute::Key => self.decode_payload(message.key()).await,
            DecodingAttribute::Value => self.decode_payload(message.payload()).await,
        }
    }
}

impl Utf8Decoder {
    async fn decode_payload(&self, payload: Option<&[u8]>) -> Result<DecodedContents, String> {
        match payload {
            None => Ok(DecodedContents{json: None}),
            Some(buffer) => {
                match std::str::from_utf8(buffer) {
                    Ok(v) => Ok(DecodedContents{json: Some(v.to_string())}),
                    Err(_) => Ok(DecodedContents{json: None})
                }
            },
        }
    }
}
