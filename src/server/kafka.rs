use rocket::serde::json::Json;
use rocket::serde::{Serialize, Deserialize};

use rdkafka::admin::ConfigResourceResult;
use rdkafka::admin::ResourceSpecifier;
use rdkafka::admin::AdminOptions;
use rdkafka::client::DefaultClientContext;
use rdkafka::message::Message;
use rdkafka::error::KafkaError;
use rdkafka::ClientContext;
use rdkafka::consumer::Rebalance;
use rdkafka::consumer::ConsumerContext;
use rdkafka::message::Timestamp;
use rdkafka::consumer::StreamConsumer;
use rdkafka::TopicPartitionList;
use rdkafka::config::ClientConfig;
use rdkafka::admin::AdminClient;
use rdkafka::consumer::{BaseConsumer, Consumer};
use rdkafka::error::{KafkaResult};

use schema_registry_converter::async_impl::schema_registry::SrSettings;
use schema_registry_converter::async_impl::avro::AvroDecoder;

use avro_rs::types::Value;
use serde_json::Value as JsonValue;

use std::time::Duration;

use futures::StreamExt;
use tokio::time::timeout;

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
pub struct BrokerMetadata {
    id: i32,
    host: String,
    port: i32,
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

#[derive(Serialize)]
pub struct GetClusterResult {
    brokers: Vec<BrokerMetadata>,
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
pub struct GetTopicConsumerGroupsResult {
    consumer_groups: Vec<TopicConsumerGroup>
}

#[derive(Serialize)]
pub struct GroupMemberMetadata {
    member_id: String,
    client_id: String,
    client_host: String,
    metadata: String,
    assignment: String,
}

#[derive(Serialize)]
pub struct GroupMetadata {
    name: String,
    protocol: String,
    protocol_type: String,
    state: String,
    members: Vec<GroupMemberMetadata>
}

#[derive(Serialize)]
pub struct GetGroupsResult {
    groups: Vec<GroupMetadata>
}

#[derive(Serialize)]
pub struct GetGroupMembersResult {
    members: Vec<GroupMemberMetadata>
}

#[derive(Serialize)]
pub struct ConfigEntry {
    name: String,
    value: Option<String>,
    source: String,
    is_read_only: bool,
    is_default: bool,
    is_sensitive: bool,
}

#[derive(Serialize)]
pub struct GetTopicConfigsResult {
    entries: Vec<ConfigEntry>
}

#[derive(Serialize)]
pub struct GetBrokerConfigsResult {
    entries: Vec<ConfigEntry>
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

#[derive(Serialize)]
pub struct GetOffsetForTimestampResult {
    offset: i64,
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
    let groups = _get_topic_consumer_groups(topic, &offsets, false)?;
    Ok(Json(GetTopicResult{
        offsets: offsets,
        consumer_groups: groups,
    }))
}

#[get("/api/topic/<topic>/config")]
pub async fn get_topic_configs(topic: &str) -> Result<Json<GetTopicConfigsResult>, String> {
    let client: AdminClient<DefaultClientContext> = map_error(ClientConfig::new()
        .set("bootstrap.servers", &*config::KAFKA_URLS).create())?;

    let opts = AdminOptions::new().operation_timeout(Some(Duration::from_secs(5)));
    let configs: Vec<ConfigResourceResult> = map_error(client.describe_configs(&[
        ResourceSpecifier::Topic(topic),
    ], &opts).await)?;

    let entries = _get_entries(configs)?;

    Ok(Json(GetTopicConfigsResult{ entries: entries }))
}

#[get("/api/broker/<broker>/config")]
pub async fn get_broker_configs(broker: i32) -> Result<Json<GetBrokerConfigsResult>, String> {
    let client: AdminClient<DefaultClientContext> = map_error(ClientConfig::new()
        .set("bootstrap.servers", &*config::KAFKA_URLS).create())?;

    let opts = AdminOptions::new().operation_timeout(Some(Duration::from_secs(5)));
    let configs: Vec<ConfigResourceResult> = map_error(client.describe_configs(&[
        ResourceSpecifier::Broker(broker),
    ], &opts).await)?;

    let entries = _get_entries(configs)?;

    Ok(Json(GetBrokerConfigsResult{ entries: entries }))
}

#[get("/api/cluster")]
pub fn get_cluster() -> Result<Json<GetClusterResult>, String> {
    let consumer: BaseConsumer = map_error(ClientConfig::new()
        .set("bootstrap.servers", &*config::KAFKA_URLS)
        .create())?;

    let timeout = Duration::from_secs(10);
    let metadata = map_error(consumer
        .fetch_metadata(None, timeout))?;

    let mut brokers = Vec::with_capacity(metadata.brokers().len());
    for broker in metadata.brokers() {
        brokers.push(BrokerMetadata{
            id: broker.id(),
            host: broker.host().to_owned(),
            port: broker.port(),
        })
    }

    Ok(Json(GetClusterResult{ brokers: brokers }))
}

#[get("/api/groups")]
pub fn get_groups() -> Result<Json<GetGroupsResult>, String> {
    let consumer: BaseConsumer = map_error(ClientConfig::new()
    .set("bootstrap.servers", &*config::KAFKA_URLS)
    .create())?;

    let timeout = Duration::from_secs(10);
    let groups = map_error(consumer
        .fetch_group_list(None, timeout))?;

    let groups = groups.groups();
    let mut out = Vec::with_capacity(groups.len());
    for group in groups {
        let members = _get_members(&group);
        out.push(
            GroupMetadata{
                name: group.name().to_string(),
                protocol: group.protocol().to_string(),
                protocol_type: group.protocol_type().to_string(),
                state: group.state().to_string(),
                members: members,
            }
        );
    }

    Ok(Json(GetGroupsResult{groups: out}))
}

#[get("/api/members/<group>")]
pub fn get_group_members(group: &str) -> Result<Json<GetGroupMembersResult>, String> {
    let consumer: BaseConsumer = map_error(ClientConfig::new()
    .set("bootstrap.servers", &*config::KAFKA_URLS)
    .create())?;

    let timeout = Duration::from_secs(10);
    let groups = map_error(consumer
        .fetch_group_list(Some(group), timeout))?;
    let groups = groups.groups();

    if groups.len() == 0 {
        return Err("no groups found".to_string());
    }
    if groups.len() > 1 {
        return Err("too many groups found".to_string());
    }
    let group = &groups[0];
    let members = _get_members(&group);

    Ok(Json(GetGroupMembersResult{members: members}))
}

#[get("/api/topic/<topic>/consumer_groups")]
pub fn get_topic_consumer_groups(topic: &str) -> Result<Json<GetTopicConsumerGroupsResult>, String> {
    let offsets = _get_offsets(topic)?;
    let groups = _get_topic_consumer_groups(topic, &offsets, true)?;
    Ok(Json(GetTopicConsumerGroupsResult{consumer_groups: groups}))
}

#[get("/api/topic/<topic>/offsets")]
pub fn get_offsets(topic: &str) -> Result<Json<GetTopicOffsetsResult>, String> {
    let offsets = _get_offsets(topic)?;
    Ok(Json(GetTopicOffsetsResult{
        offsets: offsets,
    }))
}

#[get("/api/offset/<topic>/<partition>/<timestamp>")]
pub fn get_offset_for_timestamp(topic: &str, partition: i32, timestamp: i64) -> Result<Json<GetOffsetForTimestampResult>, String> {
    let consumer: BaseConsumer = map_error(ClientConfig::new()
        .set("bootstrap.servers", &*config::KAFKA_URLS)
        .set("group.id", "krowser")
        .set("enable.auto.commit", "false")
        .create())?;

    let timeout = Duration::from_secs(10);

    let mut assignment = TopicPartitionList::new();
    map_error(assignment.add_partition_offset(topic, partition, rdkafka::Offset::Offset(timestamp)))?; // that's not a mistake, the librdkafka api actually takes a timestamp for the offset.

    let offsets = map_error(consumer.offsets_for_times(assignment, timeout))?;
    let partition_offsets = offsets.elements_for_topic(topic);
    if partition_offsets.len() == 0 {
        return Ok(Json(GetOffsetForTimestampResult{
            offset: 0,
        }));
    }
    if partition_offsets.len() > 1 {
        return Err("found too many offsets".to_string());
    }
    let partition_offset = &partition_offsets[0];
    if let rdkafka::Offset::Offset(offset) = partition_offset.offset() {
        return Ok(Json(GetOffsetForTimestampResult{
            offset: offset,
        }));
    }
    Err(format!("bad offset type: {:?}", partition_offset.offset()))
}

fn _get_members(group: &rdkafka::groups::GroupInfo) -> Vec<GroupMemberMetadata> {
    let mut members = Vec::with_capacity(group.members().len());
    for member in group.members() {
        let assignment = match member.assignment() {
            None => "",
            Some(assgn) => match std::str::from_utf8(assgn) {
                Ok(v) => v,
                Err(_) => "Non-Utf8",
            }
        };
        let meta = match member.metadata() {
            None => "",
            Some(data) => match std::str::from_utf8(data) {
                Ok(v) => v,
                Err(_) => "Non-Utf8",
            }
        };
        members.push(
            GroupMemberMetadata{
                member_id: member.id().to_string(),
                client_id: member.client_id().to_string(),
                client_host: member.client_host().to_string(),
                metadata: meta.to_string(),
                assignment: assignment.to_string(),
            })
    }
    members
}

fn _get_entries(configs: Vec<ConfigResourceResult>) -> Result<Vec<ConfigEntry>, String> {
    if configs.len() == 0 {
        return Err("no configs found".to_string());
    }
    if configs.len() > 1 {
        return Err("too many configs found".to_string());
    }
    let config = map_error(configs[0].as_ref())?;

    let mut entries = Vec::with_capacity(config.entries.len());
    for entry in &config.entries {
        entries.push(ConfigEntry{
            name: entry.name.to_string(),
            value: match &entry.value {
                Some(val) => Some(val.to_string()),
                None => None,
            },
            source: format!("{:?}", entry.source),
            is_read_only: entry.is_read_only,
            is_default: entry.is_default,
            is_sensitive: entry.is_sensitive,
        });
    }

    Ok(entries)
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

fn _get_topic_consumer_groups(topic: &str, offsets: &Vec<TopicOffsets>, with_committed_offset: bool) -> Result<Vec<TopicConsumerGroup>, String> {
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
        for member in group.members() {
            match member.assignment() {
                None => continue,
                Some(assgn) => {
                    match std::str::from_utf8(assgn) {
                        Ok(v) => {
                            //eprintln!("member assignment for group {}: {}", group.name(), v);
                            let pattern = format!("{}\u{0000}", topic);
                            if v.contains(&pattern) {
                                let mut consumer_group_offsets = Vec::with_capacity(group.members().len());
                                if with_committed_offset {
                                    let group_consumer: BaseConsumer = map_error(ClientConfig::new()
                                        .set("bootstrap.servers", &*config::KAFKA_URLS)
                                        .set("group.id", group.name())
                                        .set("enable.auto.commit", "false")
                                        .create())?;
                                        let mut assignment = TopicPartitionList::new();
                                        for offset in offsets {
                                            map_error(assignment.add_partition_offset(topic, offset.partition, rdkafka::Offset::Offset(0)))?;
                                        }
                                        map_error(group_consumer.assign(&assignment))?;
                                    let committed: TopicPartitionList = map_error(group_consumer.committed(timeout))?;
                                    for elem in committed.elements() {
                                        if let rdkafka::Offset::Offset(offset) = elem.offset() {
                                            if let Some(partition_offsets) = offsets.iter().find(|v| v.partition == elem.partition()) {
                                                let consumer_offsets = ConsumerGroupOffsets{
                                                    metadata: Some(elem.metadata().to_string()),
                                                    offset: offset,
                                                    partition_offsets: *partition_offsets,
                                                };
                                                consumer_group_offsets.push(consumer_offsets);
                                            } else {
                                                eprintln!("did not find offsets for topic {} and partition {}", topic, elem.partition());
                                            }
                                        } else {
                                            eprintln!("bad offset type: {:?}", elem.offset());
                                        }
                                    }
                                }
                                let topic_group = TopicConsumerGroup{
                                    group_id: group.name().to_string(),
                                    offsets: consumer_group_offsets,
                                };
                                topic_groups.push(topic_group);
                            }
                        },
                        Err(_) => eprintln!("failed to parse member assignment for group {}", group.name()),
                    }
                }
            }
        }
    }

    Ok(topic_groups)
}

#[get("/api/messages/<topic>/<partition>?<limit>&<offset>&<search>&<search_style>&<timeout_millis>&<trace>")]
pub async fn get_messages(
    topic: &str,
    partition: i32,
    limit: Option<i64>,
    offset: Option<i64>,
    search: Option<&str>,
    search_style: Option<SearchStyle>,
    timeout_millis: Option<u64>,
    trace: bool) -> Result<Json<GetTopicMessagesResult>, String> {

    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);
    let timeout_millis = timeout_millis.unwrap_or(20000);
    let search_style = search_style.unwrap_or(SearchStyle::None);
    eprintln!("{:?} {:?} {}", search, search_style, timeout_millis);
    match timeout(Duration::from_millis(timeout_millis),
        _get_messages(topic, partition, limit, offset, search, search_style, trace)).await {
            Err(_) => Ok(Json(GetTopicMessagesResult{has_timeout: true, messages: Vec::new()})),
            Ok(res) => res,
    }
}

async fn _get_messages(topic: &str,
    partition: i32,
    mut limit: i64,
    offset: i64,
    search: Option<&str>,
    search_style: SearchStyle,
    trace: bool) -> Result<Json<GetTopicMessagesResult>, String> {
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