use schema_registry_converter::async_impl::schema_registry::SrSettings;
use schema_registry_converter::async_impl::avro::AvroDecoder;
use async_trait::async_trait;
use avro_rs::types::Value;
use rdkafka::message::BorrowedMessage;
use rdkafka::message::Message;
use serde_json::Value as JsonValue;

use crate::config;
use crate::kafka::decoders::api;

#[derive(Debug, Default)]
pub struct AvroCustomDecoder {
    settings: Option<SrSettings>,
}

#[async_trait]
impl api::Decoder for AvroCustomDecoder {
    fn name(&self) -> &'static str  {
        "Avro (Confluent Schema Registry)"
    }

    async fn on_init(&mut self) {
        self.settings = Some(SrSettings::new((&*config::SCHEMA_REGISTRY_URL).to_string()));
    }

    async fn decode(&self, message: &BorrowedMessage, attribute: &api::DecodingAttribute) -> Result<api::DecodedContents, String> {
        match attribute {
            api::DecodingAttribute::Key => self.decode_payload(message.key()).await,
            api::DecodingAttribute::Value => self.decode_payload(message.payload()).await,
        }
    }
}

impl AvroCustomDecoder {
    async fn decode_payload(&self, payload: Option<&[u8]>) -> Result<api::DecodedContents, String> {
        match payload {
            None => Ok(api::DecodedContents{json: None, schema: None}),
            Some(_) => {
                let mut decoder = AvroDecoder::new(self.settings.as_ref().unwrap().clone());
                let task = decoder.decode(payload);
                match task.await {
                    Err(err) => {
                        eprintln!("error decoding avro: {}", err);
                        return Ok(api::DecodedContents{json: None, schema: None});
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
                            Ok(json_val) => json = match serde_json::to_string(&json_val) {
                                Ok(v) => v,
                                Err(e) => e.to_string(),
                            },
                        }
                        return Ok(api::DecodedContents{json: Some(json), schema: schema});
                    }
                };
            },
        }
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
        Value::Union(uni) => {
            decode_bytes(uni);
        }
        _ => {},
    }
}