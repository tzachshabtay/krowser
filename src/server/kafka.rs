use rocket::serde::json::Json;
use rocket::serde::{Serialize, Deserialize};

use rdkafka::message::Message;
use rdkafka::error::KafkaError;
use rdkafka::ClientContext;
use rdkafka::consumer::Rebalance;
use rdkafka::consumer::ConsumerContext;
use rdkafka::message::Timestamp;
use rdkafka::consumer::StreamConsumer;
use rdkafka::TopicPartitionList;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, Consumer};
use rdkafka::error::{KafkaResult};

use schema_registry_converter::async_impl::schema_registry::SrSettings;
use schema_registry_converter::async_impl::avro::AvroDecoder;

use avro_rs::types::Value;
use serde_json::Value as JsonValue;

use std::time::Duration;

use futures::StreamExt;

use regex::Regex;

use crate::config;

#[derive(PartialEq, Serialize, Deserialize, Debug, Clone)]
pub struct PartitionMetadata {
    error_description: Option<String>,
    partition_id: i32,
    leader: i32,
    replicas: Vec<i32>,
    isr: Vec<i32>,
}

#[derive(Serialize)]
pub struct TopicMetadata {
    name: String,
    partitions: Vec<PartitionMetadata>,
}

#[derive(Serialize)]
pub struct GetTopicsResult {
    topics: Vec<TopicMetadata>,
}

#[derive(Serialize, Copy, Clone)]
pub struct TopicOffsets {
    partition: i32,
    high: i64,
    low: i64,
}

#[derive(Serialize)]
pub struct ConsumerGroupOffsets {
    metadata: Option<String>,
    offset: i64,
    partition_offsets: TopicOffsets,
}

#[derive(Serialize)]
pub struct TopicConsumerGroup {
    group_id: String,
    offsets: Vec<ConsumerGroupOffsets>,
}

#[derive(Serialize)]
pub struct GetTopicOffsetsResult {
    offsets: Vec<TopicOffsets>
}

#[derive(Serialize)]
pub struct GetTopicResult {
    offsets: Vec<TopicOffsets>,
    consumer_groups: Vec<TopicConsumerGroup>
}

#[derive(Serialize)]
pub struct TopicMessage {
    topic: String,
    partition: i32,
    value: String,
    key: String,
    schema_type: Option<String>,
    timestamp: i64,
    offset: i64,
}

#[derive(Serialize)]
pub struct GetTopicMessagesResult {
    messages: Vec<TopicMessage>,
    has_timeout: bool,
}

#[derive(Serialize, FromFormField, Debug)]
pub enum SearchStyle {
    None,
    #[field(value = "case-sensitive")]
    CaseSensitive,
    Regex,
}

fn map_error<T, E: std::fmt::Debug>(result: Result<T, E>) -> Result<T, String> {
    match result {
        Ok(v) => Ok(v),
        Err(e) => Err(format!("{:?}", e)),
    }
}

struct CustomContext;

impl ClientContext for CustomContext {

    fn error(&self, error: KafkaError, reason: &str) {
        match error {
            KafkaError::PartitionEOF(i) => println!("Partition EOF: {}, reason: {}", i, reason),
            _ => ()
        }
    }
}

impl ConsumerContext for CustomContext {
    fn pre_rebalance(&self, rebalance: &Rebalance) {
        eprintln!("Pre rebalance {:?}", rebalance);
    }

    fn post_rebalance(&self, rebalance: &Rebalance) {
        eprintln!("Post rebalance {:?}", rebalance);
    }

    fn commit_callback(&self, result: KafkaResult<()>, _offsets: &TopicPartitionList) {
        eprintln!("Committing offsets: {:?}", result);
    }

}

type LoggingConsumer = StreamConsumer<CustomContext>;

#[get("/api/topics")]
pub fn get_topics() -> Result<Json<GetTopicsResult>, String> {
    println!("Connecting to kafka at: {}", *config::KAFKA_URLS);
    let consumer: BaseConsumer = map_error(ClientConfig::new()
        .set("bootstrap.servers", &*config::KAFKA_URLS)
        .create())?;

    let timeout = Duration::from_secs(10);
    let metadata = map_error(consumer
        .fetch_metadata(None, timeout))?;

    let mut topics = Vec::with_capacity(metadata.topics().len());
    for topic in metadata.topics() {
        let mut partitions = Vec::with_capacity(topic.partitions().len());
        for partition in topic.partitions() {
            let err_desc: Option<String> = match partition.error() {
                Some(e) => Some(format!("{:?}", e)),
                None => None,
            };
            partitions.push(PartitionMetadata{
                error_description: err_desc,
                partition_id: partition.id(),
                leader: partition.leader(),
                replicas: partition.replicas().to_owned(),
                isr: partition.isr().to_owned(),
            });
        }
        topics.push(TopicMetadata{
            name: topic.name().to_owned(),
            partitions: partitions,
        })
    }
    Ok(Json(GetTopicsResult{
        topics: topics,
    }))
}

#[get("/api/topic/<topic>")]
pub fn get_topic(topic: &str) -> Result<Json<GetTopicResult>, String> {
    let offsets = _get_offsets(topic)?;
    let groups = _get_topic_consumer_groups(topic, &offsets)?;
    Ok(Json(GetTopicResult{
        offsets: offsets,
        consumer_groups: groups,
    }))
}

#[get("/api/topic/<topic>/offsets")]
pub fn get_offsets(topic: &str) -> Result<Json<GetTopicOffsetsResult>, String> {
    let offsets = _get_offsets(topic)?;
    Ok(Json(GetTopicOffsetsResult{
        offsets: offsets,
    }))
}

fn _get_offsets(topic: &str) -> Result<Vec<TopicOffsets>, String> {
    println!("Connecting to kafka at: {}", *config::KAFKA_URLS);
    let consumer: BaseConsumer = map_error(ClientConfig::new()
        .set("bootstrap.servers", &*config::KAFKA_URLS)
        .create())?;

    let timeout = Duration::from_secs(10);
    let metadata = map_error(consumer
        .fetch_metadata(Some(topic), timeout))?;
    if metadata.topics().len() == 0 {
        return Err("topic not found".to_string())
    }
    if metadata.topics().len() > 1 {
        return Err("too many topics found".to_string())
    }
    let partitions = metadata.topics()[0].partitions();
    let mut offsets = Vec::with_capacity(partitions.len());
    for partition in partitions {
        let watermarks = map_error(consumer
            .fetch_watermarks(topic, partition.id(), timeout))?;
        offsets.push(TopicOffsets{
            partition: partition.id(),
            low: watermarks.0,
            high: watermarks.1,
        });
    }
    Ok(offsets)
}

fn _get_topic_consumer_groups(topic: &str, offsets: &Vec<TopicOffsets>) -> Result<Vec<TopicConsumerGroup>, String> {
    println!("Connecting to kafka at: {}", *config::KAFKA_URLS);
    let consumer: BaseConsumer = map_error(ClientConfig::new()
        .set("bootstrap.servers", &*config::KAFKA_URLS)
        .create())?;

    //todo: we're fetching all groups each time we fetch for a specific topic, we can use a very short-lived cache instead as we query for all topics from the topics page
    let timeout = Duration::from_secs(10);
    let groups = map_error(consumer
        .fetch_group_list(None, timeout))?;

    let groups = groups.groups();
    let mut topic_groups = Vec::with_capacity(groups.len());
    for group in groups {
        if group.protocol_type() != "consumer" {
            eprintln!("skipping group {} of type {}", group.name(), group.protocol_type());
            continue
        }
        let mut consumer_group_offsets = Vec::with_capacity(group.members().len());
        for member in group.members() {
            match member.assignment() {
                None => continue,
                Some(assgn) => {
                    match std::str::from_utf8(assgn) {
                        Ok(v) => {
                            //eprintln!("member assignment for group {}: {}", group.name(), v);
                            let pattern = format!("{}\u{0000}", topic);
                            if v.contains(&pattern) {
                                let group_consumer: BaseConsumer = map_error(ClientConfig::new()
                                    .set("bootstrap.servers", &*config::KAFKA_URLS)
                                    .set("group.id", group.name())
                                    .create())?;
                                let committed: TopicPartitionList = map_error(group_consumer.committed(timeout))?;
                                for elem in committed.elements() {
                                    if let rdkafka::Offset::Offset(offset) = elem.offset() {
                                        if let Some(partition_offsets) = offsets.iter().find(|v| v.partition == elem.partition()) {
                                            let consumer_offsets = ConsumerGroupOffsets{
                                                metadata: Some(elem.metadata().to_string()),
                                                offset: offset,
                                                partition_offsets: *partition_offsets,
                                            };
                                            eprintln!("PUSHING!!");
                                            consumer_group_offsets.push(consumer_offsets);
                                        } else {
                                            eprintln!("did not find offsets for topic {} and partition {}", topic, elem.partition());
                                        }
                                    } else {
                                        eprintln!("bad offset type: {:?}", elem.offset());
                                    }
                                }
                            }
                        },
                        Err(_) => eprintln!("failed to parse member assignment"),
                    }
                }
            }
        }
        let topic_group = TopicConsumerGroup{
            group_id: group.name().to_string(),
            offsets: consumer_group_offsets,
        };
        topic_groups.push(topic_group);
    }

    Ok(topic_groups)
}

#[get("/api/messages/<topic>/<partition>?<limit>&<offset>&<search>&<search_style>&<timeout>&<trace>")]
pub async fn get_messages(
    topic: &str,
    partition: i32,
    limit: Option<i64>,
    offset: Option<i64>,
    search: Option<&str>,
    search_style: Option<SearchStyle>,
    timeout: Option<i32>,
    trace: bool) -> Result<Json<GetTopicMessagesResult>, String> {
        let mut limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);
        let timeout = timeout.unwrap_or(20000);
        let search_style = search_style.unwrap_or(SearchStyle::None);
        eprintln!("{:?} {:?} {}", search, search_style, timeout);
        let regex: Option<Regex> = match search_style {
            SearchStyle::Regex =>
                if let Some(pattern) = &search
                    { Some(map_error(Regex::new(pattern))?) } else
                    { None },
            _ => None,
        };
        let topic_offsets = get_offsets(topic)?;
        let mut found_partition = false;
        for offsets in &topic_offsets.offsets{
            if offsets.partition != partition {
                continue;
            }
            found_partition = true;
            let max_offset =offsets.high;
            if max_offset == 0 || offset > max_offset {
                return Ok(Json(GetTopicMessagesResult{messages: Vec::new(), has_timeout: false}))
            }
            if offset + limit > max_offset {
                limit = max_offset - offset
            }
            if limit <= 0 {
                return Ok(Json(GetTopicMessagesResult{messages: Vec::new(), has_timeout: false}))
            }
            break;
        }
        if !found_partition {
            return Err(format!("partition {} not found for topic {}", partition, topic))
        }

        let context = CustomContext;

        println!("Connecting to kafka at: {}", *config::KAFKA_URLS);
        let consumer: LoggingConsumer = map_error(ClientConfig::new()
            .set("bootstrap.servers", &*config::KAFKA_URLS)
            .set("group.id", "krowser")
            .set("enable.auto.commit", "false")
            .create_with_context(context))?;

        let mut assignment = TopicPartitionList::new();
        map_error(assignment.add_partition_offset(topic, partition, rdkafka::Offset::Offset(offset)))?;
        map_error(consumer.assign(&assignment))?;

        let srs = SrSettings::new((&*config::SCHEMA_REGISTRY_URL).to_string());
        let mut avro_decoder = AvroDecoder::new(srs);

        let mut num_consumed = 0;
        let mut messages = Vec::with_capacity(limit.try_into().unwrap());

        let mut message_stream = consumer.stream();
        while let Some(message) = message_stream.next().await {
            num_consumed += 1;
            match message {
                Err(e) => eprintln!("Kafka error: {}", e),
                Ok(m) => {
                    let key = match m.key() {
                        Some(k) => match std::str::from_utf8(k) {
                            Ok(v) => v,
                            Err(_) => "Non-Utf8",
                        },
                        None => "",
                    };
                    let timestamp = match m.timestamp() {
                        Timestamp::NotAvailable => 0,
                        Timestamp::CreateTime(v) => v,
                        Timestamp::LogAppendTime(v) => v,
                    };
                    let decoded = decode(m.payload(), &mut avro_decoder).await?;
                    if trace {
                        eprintln!("key: '{:?}', value: {:?}, topic: {}, offset: {}, timestamp: {:?}",
                            key, decoded.value, m.topic(), m.offset(), timestamp);
                    }
                    let mut filtered_out = false;
                    if let Some(pattern) = search {
                        let schema = *&decoded.schema.as_ref();
                        let text = format!("{},{},{}", key.to_string(), decoded.value, schema.unwrap_or(&"".to_string()));
                        if !includes(text, pattern.to_string(), &search_style, &regex) {
                            filtered_out = true;
                        }
                    }
                    if !filtered_out {
                        let msg = TopicMessage{
                            topic: topic.to_string(),
                            partition: partition,
                            key: key.to_owned(),
                            timestamp: timestamp,
                            offset: m.offset(),
                            value: decoded.value,
                            schema_type: decoded.schema,
                        };
                        messages.push(msg);
                    }
                }
            };
            if num_consumed >= limit {
                break;
            }
        }
        Ok(Json(GetTopicMessagesResult{
            messages: messages,
            has_timeout: false,
        }))
}

struct DecodedValue {
    value: String,
    schema: Option<String>,
}

async fn decode(payload: Option<&[u8]>, avro_decoder: &mut AvroDecoder<'_>) -> Result<DecodedValue, String> {
    match payload {
        None => Ok(DecodedValue{value: "".to_string(), schema: None}),
        Some(buffer) => {
            match avro_decoder.decode(payload).await {
                Err(err) => {
                    eprintln!("error decoding avro: {}", err);
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
                    return Ok(DecodedValue{value: json, schema: schema});
                }
            };
            match std::str::from_utf8(buffer) {
                Ok(v) => Ok(DecodedValue{value: v.to_string(), schema: None}),
                Err(_) => Ok(DecodedValue{value: "Non-Utf8".to_string(), schema: None}),
            }
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
        Value::Union(uni) => {
            decode_bytes(uni);
        }
        _ => {},
    }
}

fn includes(text: String, pattern: String, style: &SearchStyle, regex: &Option<Regex>) -> bool {
    match style {
        SearchStyle::None => text.to_ascii_lowercase().contains(&pattern.to_ascii_lowercase()),
        SearchStyle::CaseSensitive => text.contains(&pattern),
        SearchStyle::Regex => (*regex).as_ref().unwrap().is_match(&text),
    }
}