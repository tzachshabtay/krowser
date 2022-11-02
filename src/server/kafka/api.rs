use rdkafka::Message;
use rocket::serde::json::Json;

use rdkafka::admin::ConfigResourceResult;
use rdkafka::admin::ResourceSpecifier;
use rdkafka::admin::AdminOptions;
use rdkafka::client::DefaultClientContext;
use rdkafka::message::Timestamp;
use rdkafka::TopicPartitionList;
use rdkafka::config::ClientConfig;
use rdkafka::admin::AdminClient;
use rdkafka::consumer::{BaseConsumer, Consumer};
use rdkafka::error::KafkaError;
use rdkafka::ClientContext;
use rdkafka::consumer::Rebalance;
use rdkafka::consumer::ConsumerContext;
use rdkafka::consumer::StreamConsumer;
use rdkafka::error::{KafkaResult};
use rdkafka::message::BorrowedMessage;

use futures::StreamExt;

use std::time::Duration;
use std::thread;

use tokio::time::timeout;

use regex::Regex;

use crate::config;
use crate::kafka::dto;
use crate::common::errors::{map_error, retry};
use crate::kafka::decoders::avro::AvroCustomDecoder;
use crate::kafka::decoders::decoders::Decoders;
use serverapi::{Decoder, DecodingAttribute, DecodedContents};

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

fn kafka_retry<C, T, E: std::fmt::Debug>(
    name: &str,
    consumer_creator: &mut dyn std::ops::FnMut() -> std::result::Result<C, E>,
    action: &mut dyn std::ops::FnMut(C) -> std::result::Result<T, E>) -> Result<T, String> {
    let mut retries = 5;
    let mut wait = 500;
    loop {
        let consumer_res = consumer_creator();
        match consumer_res {
            Ok(consumer) => {
                let res = action(consumer);
                match res {
                    Ok(val) => { return Ok(val); },
                    Err(err) => {
                        if retries <= 0 {
                            return Err(format!("{:?}", err));
                        }
                        eprintln!("Failed connnecting to kafka for {}, retrying in {} milliseconds, retries left {}", name, wait, retries);
                        thread::sleep(Duration::from_millis(wait));
                        retries -= 1;
                        wait *= 2;
                    }
                }
            },
            Err(err) => {
                if retries <= 0 {
                    return Err(format!("{:?}", err));
                }
                eprintln!("Failed {}, retrying in {} milliseconds, retries left {}", name, wait, retries);
                thread::sleep(Duration::from_millis(wait));
                retries -= 1;
                wait *= 2;
            }
        }
    }
}

fn base_consumer() -> KafkaResult<BaseConsumer> {
    println!("Connecting to kafka at: {}", (*config::SETTINGS).kafka.urls);
    ClientConfig::new()
        .set("bootstrap.servers", &(*config::SETTINGS).kafka.urls)
        .create()
}

fn group_consumer(group: &str) -> KafkaResult<BaseConsumer> {
    println!("Connecting to kafka at: {}", (*config::SETTINGS).kafka.urls);
    ClientConfig::new()
        .set("bootstrap.servers", &(*config::SETTINGS).kafka.urls)
        .set("group.id", group)
        .set("enable.auto.commit", "false")
        .create()

}

#[get("/api/topics")]
pub fn get_topics() -> Result<Json<dto::GetTopicsResult>, String> {
    let timeout = Duration::from_secs(10);
    let metadata = kafka_retry("fetching metadata", &mut base_consumer, &mut |consumer| consumer
        .fetch_metadata(None, timeout))?;

    let mut topics = Vec::with_capacity(metadata.topics().len());
    for topic in metadata.topics() {
        let mut partitions = Vec::with_capacity(topic.partitions().len());
        for partition in topic.partitions() {
            let err_desc: Option<String> = match partition.error() {
                Some(e) => Some(format!("{:?}", e)),
                None => None,
            };
            partitions.push(dto::PartitionMetadata{
                error_description: err_desc,
                partition_id: partition.id(),
                leader: partition.leader(),
                replicas: partition.replicas().to_owned(),
                isr: partition.isr().to_owned(),
            });
        }
        topics.push(dto::TopicMetadata{
            name: topic.name().to_owned(),
            partitions: partitions,
        })
    }
    Ok(Json(dto::GetTopicsResult{
        topics: topics,
    }))
}

#[get("/api/topic/<topic>")]
pub fn get_topic(topic: &str) -> Result<Json<dto::GetTopicResult>, String> {
    let offsets = _get_offsets(topic)?;
    let groups = _get_topic_consumer_groups(topic, &offsets, false)?;
    Ok(Json(dto::GetTopicResult{
        offsets: offsets,
        consumer_groups: groups,
    }))
}

#[get("/api/topic/<topic>/config")]
pub async fn get_topic_configs(topic: &str) -> Result<Json<dto::GetTopicConfigsResult>, String> {
    let client: AdminClient<DefaultClientContext> = map_error(ClientConfig::new()
        .set("bootstrap.servers", &(*config::SETTINGS).kafka.urls).create())?;

    let opts = AdminOptions::new().operation_timeout(Some(Duration::from_secs(5)));
    let configs: Vec<ConfigResourceResult> = map_error(client.describe_configs(&[
        ResourceSpecifier::Topic(topic),
    ], &opts).await)?;

    let entries = _get_entries(configs)?;

    Ok(Json(dto::GetTopicConfigsResult{ entries: entries }))
}

#[get("/api/broker/<broker>/config")]
pub async fn get_broker_configs(broker: i32) -> Result<Json<dto::GetBrokerConfigsResult>, String> {
    let client: AdminClient<DefaultClientContext> = map_error(ClientConfig::new()
        .set("bootstrap.servers", &(*config::SETTINGS).kafka.urls).create())?;

    let opts = AdminOptions::new().operation_timeout(Some(Duration::from_secs(5)));
    let configs: Vec<ConfigResourceResult> = map_error(client.describe_configs(&[
        ResourceSpecifier::Broker(broker),
    ], &opts).await)?;

    let entries = _get_entries(configs)?;

    Ok(Json(dto::GetBrokerConfigsResult{ entries: entries }))
}

#[get("/api/cluster")]
pub fn get_cluster() -> Result<Json<dto::GetClusterResult>, String> {
    let timeout = Duration::from_secs(10);
    let metadata = kafka_retry("fetching metadata", &mut base_consumer, &mut |consumer| consumer
        .fetch_metadata(None, timeout))?;

    let mut brokers = Vec::with_capacity(metadata.brokers().len());
    for broker in metadata.brokers() {
        brokers.push(dto::BrokerMetadata{
            id: broker.id(),
            host: broker.host().to_owned(),
            port: broker.port(),
        })
    }

    Ok(Json(dto::GetClusterResult{ brokers: brokers }))
}

#[get("/api/groups")]
pub fn get_groups() -> Result<Json<dto::GetGroupsResult>, String> {
    let timeout = Duration::from_secs(10);
    let groups = kafka_retry("fetching groups", &mut base_consumer, &mut |consumer| consumer
        .fetch_group_list(None, timeout))?;

    let groups = groups.groups();
    let mut out = Vec::with_capacity(groups.len());
    for group in groups {
        let members = _get_members(&group);
        out.push(
            dto::GroupMetadata{
                name: group.name().to_string(),
                protocol: group.protocol().to_string(),
                protocol_type: group.protocol_type().to_string(),
                state: group.state().to_string(),
                members: members,
            }
        );
    }

    Ok(Json(dto::GetGroupsResult{groups: out}))
}

#[get("/api/members/<group>")]
pub fn get_group_members(group: &str) -> Result<Json<dto::GetGroupMembersResult>, String> {
    let timeout = Duration::from_secs(10);
    let groups = kafka_retry("fetching groups", &mut base_consumer, &mut |consumer| consumer
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

    Ok(Json(dto::GetGroupMembersResult{members: members}))
}

#[get("/api/topic/<topic>/consumer_groups")]
pub fn get_topic_consumer_groups(topic: &str) -> Result<Json<dto::GetTopicConsumerGroupsResult>, String> {
    let offsets = _get_offsets(topic)?;
    let groups = _get_topic_consumer_groups(topic, &offsets, true)?;
    Ok(Json(dto::GetTopicConsumerGroupsResult{consumer_groups: groups}))
}

#[get("/api/topic/<topic>/offsets")]
pub fn get_offsets(topic: &str) -> Result<Json<dto::GetTopicOffsetsResult>, String> {
    let offsets = _get_offsets(topic)?;
    Ok(Json(dto::GetTopicOffsetsResult{
        offsets: offsets,
    }))
}

#[get("/api/offset/<topic>/<partition>/<timestamp>")]
pub fn get_offset_for_timestamp(topic: &str, partition: i32, timestamp: i64) -> Result<Json<dto::GetOffsetForTimestampResult>, String> {
    let timeout = Duration::from_secs(10);

    let offsets = kafka_retry("fetching offsets for times", &mut || group_consumer("krowser"), &mut |consumer| {
        let mut assignment = TopicPartitionList::new();
        assignment.add_partition_offset(topic, partition, rdkafka::Offset::Offset(timestamp))?; // that's not a mistake, the librdkafka api actually takes a timestamp for the offset.
        return consumer.offsets_for_times(assignment, timeout);
    })?;

    let partition_offsets = offsets.elements_for_topic(topic);
    if partition_offsets.len() == 0 {
        return Ok(Json(dto::GetOffsetForTimestampResult{
            offset: 0,
        }));
    }
    if partition_offsets.len() > 1 {
        return Err("found too many offsets".to_string());
    }
    let partition_offset = &partition_offsets[0];
    match partition_offset.offset() {
        rdkafka::Offset::Offset(offset) => Ok(Json(dto::GetOffsetForTimestampResult{
            offset: offset,
        })),
        rdkafka::Offset::End => {
            let topic_offsets = _get_offsets(topic)?;
            if let Some(partition_offsets) = topic_offsets.iter().find(|v| v.partition == partition) {
                return Ok(Json(dto::GetOffsetForTimestampResult{
                    offset: partition_offsets.high,
                }));
            }
            return Err("missing end offset".to_string());
        },
        _ => Err(format!("bad offset type: {:?}", partition_offset.offset()))
    }
}

fn _get_members(group: &rdkafka::groups::GroupInfo) -> Vec<dto::GroupMemberMetadata> {
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
            dto::GroupMemberMetadata{
                member_id: member.id().to_string(),
                client_id: member.client_id().to_string(),
                client_host: member.client_host().to_string(),
                metadata: meta.to_string(),
                assignment: assignment.to_string(),
            })
    }
    members
}

fn _get_entries(configs: Vec<ConfigResourceResult>) -> Result<Vec<dto::ConfigEntry>, String> {
    if configs.len() == 0 {
        return Err("no configs found".to_string());
    }
    if configs.len() > 1 {
        return Err("too many configs found".to_string());
    }
    let config = map_error(configs[0].as_ref())?;

    let mut entries = Vec::with_capacity(config.entries.len());
    for entry in &config.entries {
        entries.push(dto::ConfigEntry{
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

fn _get_offsets(topic: &str) -> Result<Vec<dto::TopicOffsets>, String> {
    let consumer: BaseConsumer = retry("connecting consumer", &mut || base_consumer())?;

    let timeout = Duration::from_secs(10);
    let metadata = retry("fetching metadata", &mut || consumer
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
        let watermarks = retry("fetching watermarks", &mut || consumer
            .fetch_watermarks(topic, partition.id(), timeout))?;
        offsets.push(dto::TopicOffsets{
            partition: partition.id(),
            low: watermarks.0,
            high: watermarks.1,
        });
    }
    Ok(offsets)
}

fn _get_topic_consumer_groups(topic: &str, offsets: &Vec<dto::TopicOffsets>, with_committed_offset: bool) -> Result<Vec<dto::TopicConsumerGroup>, String> {
    //todo: we're fetching all groups each time we fetch for a specific topic, we can use a very short-lived cache instead as we query for all topics from the topics page
    let timeout = Duration::from_secs(10);
    let groups = kafka_retry("fetching groups", &mut base_consumer, &mut |consumer| consumer
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
                                    let committed: TopicPartitionList = kafka_retry("fetching offsets for times", &mut || group_consumer(group.name()), &mut |consumer| {
                                        let mut tpl = TopicPartitionList::new();
                                        for offset in offsets {
                                            tpl.add_partition_offset(topic, offset.partition, rdkafka::Offset::Offset(0))?;
                                        }
                                        consumer.committed_offsets(tpl, timeout)
                                    })?;
                                    for elem in committed.elements() {
                                        if let rdkafka::Offset::Offset(offset) = elem.offset() {
                                            if let Some(partition_offsets) = offsets.iter().find(|v| v.partition == elem.partition()) {
                                                let consumer_offsets = dto::ConsumerGroupOffsets{
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
                                let topic_group = dto::TopicConsumerGroup{
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
    search_style: Option<dto::SearchStyle>,
    timeout_millis: Option<u64>,
    trace: bool) -> Result<Json<dto::GetTopicMessagesResult>, String> {

    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);
    let timeout_millis = timeout_millis.unwrap_or(20000);
    let search_style = search_style.unwrap_or(dto::SearchStyle::None);
    eprintln!("{:?} {:?} {}", search, search_style, timeout_millis);
    match timeout(Duration::from_millis(timeout_millis),
        _get_messages(topic, partition, limit, offset, search, search_style, trace)).await {
            Err(_) => Ok(Json(dto::GetTopicMessagesResult{has_timeout: true, messages: Vec::new()})),
            Ok(res) => res,
    }
}

async fn _get_messages(topic: &str,
    partition: i32,
    mut limit: i64,
    offset: i64,
    search: Option<&str>,
    search_style: dto::SearchStyle,
    trace: bool) -> Result<Json<dto::GetTopicMessagesResult>, String> {
    let regex: Option<Regex> = match search_style {
        dto::SearchStyle::Regex =>
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
            return Ok(Json(dto::GetTopicMessagesResult{messages: Vec::new(), has_timeout: false}))
        }
        if offset + limit > max_offset {
            limit = max_offset - offset
        }
        if limit <= 0 {
            return Ok(Json(dto::GetTopicMessagesResult{messages: Vec::new(), has_timeout: false}))
        }
        break;
    }
    if !found_partition {
        return Err(format!("partition {} not found for topic {}", partition, topic))
    }

    println!("Connecting to kafka at: {}", (*config::SETTINGS).kafka.urls);
    let consumer: LoggingConsumer = retry("connecting consumer", &mut || ClientConfig::new()
        .set("bootstrap.servers", &(*config::SETTINGS).kafka.urls)
        .set("group.id", "krowser")
        .set("enable.auto.commit", "false")
        .create_with_context(CustomContext))?;

    let mut assignment = TopicPartitionList::new();
    map_error(assignment.add_partition_offset(topic, partition, rdkafka::Offset::Offset(offset)))?;
    retry("assigning consumer", &mut || consumer.assign(&assignment))?;

    //let mut avro_decoder: AvroCustomDecoder = Default::default();
    let mut decoders: Vec<&mut dyn Decoder> = vec![/*&mut avro_decoder*/];

    let mut loader = Decoders::new();
    unsafe {
        loader.load_plugin("../../docs/examples/plugins/helloworld/target/debug/libhelloworld.dylib").await.unwrap();

        decoders.push(&mut *(loader.decoders[0]));
    }
    for decoder in decoders.iter_mut() {
        decoder.on_init().await;
    }

    let mut num_consumed = 0;
    let mut messages = Vec::with_capacity(limit.try_into().unwrap());

    let mut message_stream = consumer.stream();
    while let Some(message) = message_stream.next().await {
        num_consumed += 1;
        match message {
            Err(e) => eprintln!("Kafka error: {}", e),
            Ok(m) => {
                let timestamp = match m.timestamp() {
                    Timestamp::NotAvailable => 0,
                    Timestamp::CreateTime(v) => v,
                    Timestamp::LogAppendTime(v) => v,
                };
                let decoded_value = decode(&m, DecodingAttribute::Value, &decoders).await?;
                let json_value = &decoded_value.json.unwrap();
                let decoded_key = decode(&m, DecodingAttribute::Key, &decoders).await?;
                let json_key = &decoded_key.json.unwrap();
                if trace {
                    eprintln!("key: '{:?}', value: {:?}, topic: {}, offset: {}, timestamp: {:?}",
                        json_key, json_value, m.topic(), m.offset(), timestamp);
                }
                let mut filtered_out = false;
                if let Some(pattern) = search {
                    let schema = *&decoded_value.schema.as_ref();
                    let text = format!("{},{},{}", json_key, json_value, schema.unwrap_or(&"".to_string()));
                    if !includes(text, pattern.to_string(), &search_style, &regex) {
                        filtered_out = true;
                    }
                }
                if !filtered_out {
                    let msg = dto::TopicMessage{
                        topic: topic.to_string(),
                        partition: partition,
                        key: json_key.to_string(),
                        timestamp: timestamp,
                        offset: m.offset(),
                        value: json_value.to_string(),
                        schema_type: decoded_value.schema,
                    };
                    messages.push(msg);
                }
            }
        };
        if num_consumed >= limit {
            break;
        }
    }
    Ok(Json(dto::GetTopicMessagesResult{
        messages: messages,
        has_timeout: false,
    }))
}

async fn decode(message: &BorrowedMessage<'_>, attr: DecodingAttribute, decoders: &Vec<&mut dyn Decoder>) -> Result<DecodedContents, String>{
    for decoder in decoders {
        let result = decoder.decode(message, &attr).await?;
        if let Some(_) = result.json {
            return Ok(result);
        }
    }
    let payload = message.payload();
    match payload {
        None => Ok(DecodedContents{json: Some("".to_string()), schema: None}),
        Some(buffer) =>
            match std::str::from_utf8(buffer) {
                Ok(v) => Ok(DecodedContents{json: Some(v.to_string()), schema: None}),
                Err(_) => Ok(DecodedContents{json: Some("Non-Utf8".to_string()), schema: None}),
            }
    }
}

fn includes(text: String, pattern: String, style: &dto::SearchStyle, regex: &Option<Regex>) -> bool {
    match style {
        dto::SearchStyle::None => text.to_ascii_lowercase().contains(&pattern.to_ascii_lowercase()),
        dto::SearchStyle::CaseSensitive => text.contains(&pattern),
        dto::SearchStyle::Regex => (*regex).as_ref().unwrap().is_match(&text),
    }
}
