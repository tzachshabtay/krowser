use schema_registry_converter::async_impl::schema_registry::SrSettings;
use schema_registry_converter::async_impl::avro::AvroDecoder;
use async_trait::async_trait;
use avro_rs::types::Value;
use rdkafka::message::BorrowedMessage;
use rdkafka::message::Message;
use serde_json::Value as JsonValue;
use serde_json::json;
use std::sync::RwLock;
use serverapi::{Decoder, DecodingAttribute, DecodedContents, Config};

#[derive(Debug, Default)]
pub struct AvroConfluentDecoder {
    settings: RwLock<Option<SrSettings>>,
}

#[async_trait]
impl Decoder for AvroConfluentDecoder {
    fn id(&self) -> &'static str  {
        "avro_confluent_schema_registry"
    }

    fn display_name(&self) -> &'static str  {
        "Avro (Confluent Schema Registry)"
    }

    async fn on_init(&self, config: Box<dyn Config + Send>) {
        let mut settings = self.settings.write().unwrap();
        *settings = Some(SrSettings::new(config.get_string("confluent-schema-registry.url".to_string()).unwrap()));
    }

    async fn decode(&self, message: &BorrowedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String> {
        match attribute {
            DecodingAttribute::Key => self.decode_payload(message.key()).await,
            DecodingAttribute::Value => self.decode_payload(message.payload()).await,
        }
    }
}

impl AvroConfluentDecoder {
    async fn decode_payload(&self, payload: Option<&[u8]>) -> Result<DecodedContents, String> {
        match payload {
            None => Ok(DecodedContents{json: None}),
            Some(_) => {
                let mut decoder = AvroDecoder::new(self.settings.read().unwrap().as_ref().unwrap().clone());
                let task = decoder.decode(payload);
                match task.await {
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
                                }
                            }
                        }
                        return Ok(DecodedContents{json: Some(json)});
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