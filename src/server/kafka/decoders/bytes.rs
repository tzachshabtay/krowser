use async_trait::async_trait;
use rdkafka::message::OwnedMessage;
use rdkafka::message::Message;
use serverapi::{Decoder, DecoderBuilder, DecodingAttribute, DecodedContents, Config};


#[derive(Debug, Default)]
pub struct BytesDecoderBuilder {}

#[async_trait]
impl DecoderBuilder for BytesDecoderBuilder {
    async fn build(&self, _: Box<dyn Config + Send>) -> Box<dyn Decoder>{
        Box::new(BytesDecoder{})
    }
}

#[derive(Debug, Default)]
pub struct BytesDecoder {
}

#[async_trait]
impl Decoder for BytesDecoder {
    fn id(&self) -> &'static str  {
        "bytes"
    }

    fn display_name(&self) -> &'static str  {
        "Bytes"
    }

    async fn decode(&self, message: &OwnedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String> {
        match attribute {
            DecodingAttribute::Key => self.decode_payload(message.key()).await,
            DecodingAttribute::Value => self.decode_payload(message.payload()).await,
        }
    }
}

impl BytesDecoder {
    async fn decode_payload(&self, payload: Option<&[u8]>) -> Result<DecodedContents, String> {
        match payload {
            None => Ok(DecodedContents{json: None}),
            Some(buffer) => {
                let bytes_str: String = buffer.iter().map(|&x| x.to_string() + ",").collect();
                Ok(DecodedContents{json: Some(format!("{{\"bytes\":\"{}\", \"message_size_in_bytes\":\"{}\"}}", bytes_str, buffer.len()).to_string())})
            },
        }
    }
}
