use std::sync::Arc;
use async_trait::async_trait;
use apache_avro::types::Value;
use rdkafka::message::OwnedMessage;
use rdkafka::message::Message;
use serde_json::Value as JsonValue;
use serde_json::json;
use serverapi::{Decoder, DecoderBuilder, DecodingAttribute, DecodedContents, Config};
use schema_registry_converter::async_impl::schema_registry::SrSettings;
use schema_registry_converter::async_impl::avro::AvroDecoder;

#[derive(Debug, Default)]
pub struct AvroConfluentDecoderBuilder {}

#[async_trait]
impl DecoderBuilder for AvroConfluentDecoderBuilder {
    async fn build(&self, config: Box<dyn Config + Send>) -> Box<dyn Decoder>{
        let settings = SrSettings::new(config.get_string("confluent-schema-registry.url".to_string()).unwrap());
        Box::new(AvroConfluentDecoder::new(settings))
    }
}
#[derive(Debug)]
pub struct AvroConfluentDecoder {
    decoder: Arc<AvroDecoder<'static>>,
}

impl AvroConfluentDecoder {
    fn new(settings: SrSettings) -> Self {
        Self { decoder: Arc::new(AvroDecoder::new(settings)) }
    }
}

#[async_trait]
impl Decoder for AvroConfluentDecoder {
    fn id(&self) -> &'static str  {
        "avro_confluent_schema_registry"
    }

    fn display_name(&self) -> &'static str  {
        "Avro (Confluent Schema Registry)"
    }

    async fn decode(&self, message: &OwnedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String> {
        let decoder: Arc<AvroDecoder<'static>> = Arc::clone(&self.decoder);
        match attribute {
            DecodingAttribute::Key => decode_payload(&decoder, message.key()).await,
            DecodingAttribute::Value => decode_payload(&decoder, message.payload()).await,
        }
    }
}

async fn decode_payload(avro_decoder: &AvroDecoder<'static>, payload: Option<&[u8]>) -> Result<DecodedContents, String> {
    match payload {
        None => Ok(DecodedContents{json: None}),
        Some(_) => {
            let task = avro_decoder.decode(payload).await;
            match task {
                Err(err) => {
                    eprintln!("error decoding avro: {}", err);
                    return Ok(DecodedContents{json: None});
                },
                Ok(val) => {
                    let mut decoded_val = val.value;
                    decode_bytes(&mut decoded_val);
                    let schema = match val.name {
                        None => None,
                        Some(v) => Some(format!("{}.{}", v.namespace.unwrap_or("".to_string()), v.name)),
                    };
                    let json;
                    match JsonValue::try_from(decoded_val) {
                        Err(err) => {
                            eprintln!("error parsing json: {}", err);
                            json = format!("error parsing json: {}", err);
                        },
                        Ok(mut json_val) => {
                            if let Some(map) = json_val.as_object_mut() {
                                map.insert("schema_event_type".to_string(), json!(schema));
                            }
                            json = match serde_json::to_string(&json_val) {
                                Ok(v) => v,
                                Err(e) => e.to_string(),
                            };
                        }
                    }
                    return Ok(DecodedContents{json: Some(json)});
                }
            };
        },
    }
}

// decode_bytes recursively goes over an avro value and changes bytes to its utf-8 sting representation (if can be decoded by utf-8)
fn decode_bytes(val: &mut Value) {
    match val {
        Value::Bytes(bytes) => {
            match std::str::from_utf8(&bytes) {
                Ok(v) => *val = Value::String(v.to_string()),
                Err(_) => {},
            }
        },
        Value::Array(vals) => {
            for item in vals.iter_mut() {
                decode_bytes(item);
            }
        },
        Value::Map(map) => {
            for (_k, v) in map.iter_mut() {
                decode_bytes(v);
            }
        },
        Value::Record(record) => {
            for (_k, v) in record.iter_mut() {
                decode_bytes(v);
            }
        },
        Value::Union(_, uni) => {
            decode_bytes(uni);
        }
        _ => {},
    }
}
