use async_trait::async_trait;
use rdkafka::message::OwnedMessage;
use rdkafka::message::Message;
use serverapi::{Decoder, DecoderBuilder, Config, DecodingAttribute, DecodedContents};

#[derive(Debug, Default)]
pub struct Utf8LossyDecoderBuilder {}

#[async_trait]
impl DecoderBuilder for Utf8LossyDecoderBuilder {
    async fn build(&self, _: Box<dyn Config + Send>) -> Box<dyn Decoder>{
        Box::new(Utf8LossyDecoder{})
    }
}

#[derive(Debug, Default)]
pub struct Utf8LossyDecoder {
}

#[async_trait]
impl Decoder for Utf8LossyDecoder {
    fn id(&self) -> &'static str  {
        "utf8_lossy"
    }

    fn display_name(&self) -> &'static str  {
        "UTF-8 (Lossy)"
    }

    async fn decode(&self, message: &OwnedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String> {
        match attribute {
            DecodingAttribute::Key => self.decode_payload(message.key()).await,
            DecodingAttribute::Value => self.decode_payload(message.payload()).await,
        }
    }
}

impl Utf8LossyDecoder {
    async fn decode_payload(&self, payload: Option<&[u8]>) -> Result<DecodedContents, String> {
        match payload {
            None => Ok(DecodedContents{json: None}),
            Some(buffer) => {
                Ok(DecodedContents{json: Some(String::from_utf8_lossy(buffer).to_string())})
            }
        }
    }
}
