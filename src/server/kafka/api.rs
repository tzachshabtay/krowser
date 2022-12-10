use rdkafka::message::OwnedMessage;
use rdkafka::groups::GroupInfo;
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
use rdkafka::Offset;

//use rayon::prelude::*;
use itertools::Itertools;
use std::io::{Cursor, BufRead};
use byteorder::{BigEndian, ReadBytesExt};
use cached::proc_macro::cached;

use futures::StreamExt;

use std::time::{Duration,Instant};
use std::thread;
use std::thread::sleep;

use tokio::time::timeout;

use regex::Regex;

use crate::config;
use crate::kafka::dto;
use crate::common::errors::{map_error, retry};
use crate::kafka::decoders::decoders::DECODERS;
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
    ClientConfig::new()
        .set("bootstrap.servers", &(*config::SETTINGS).kafka.urls)
        .create()
}

fn group_consumer(group: &str) -> KafkaResult<BaseConsumer> {
    ClientConfig::new()
        .set("bootstrap.servers", &(*config::SETTINGS).kafka.urls)
        .set("group.id", group)
        .set("enable.auto.commit", "false")
        .create()

}

#[get("/api/topics")]
pub fn get_topics() -> Result<Json<dto::GetTopicsResult>, String> {
    let metadata = cached_get_metadata()?;

    Ok(Json(dto::GetTopicsResult{
        topics: metadata,
    }))
}

#[cached(time=300, result = true)]
fn cached_get_metadata() -> Result<Vec<dto::TopicMetadata>, String> {
    let timeout = Duration::from_secs(10);
    let meta = kafka_retry("fetching metadata", &mut base_consumer, &mut |consumer| consumer
        .fetch_metadata(None, timeout))?;
    Ok(meta.topics().iter().map(|t| dto::TopicMetadata{
            name: t.name().to_string(),
            partitions: t.partitions().iter().map(|partition| {
                let err_desc: Option<String> = match partition.error() {
                    Some(e) => Some(format!("{:?}", e)),
                    None => None,
                };
                dto::PartitionMetadata{
                    error_description: err_desc,
                    partition_id: partition.id(),
                    leader: partition.leader(),
                    replicas: partition.replicas().to_owned(),
                    isr: partition.isr().to_owned(),
                }
            }).collect(),
        }).collect(),
    )
}

#[get("/api/topic/<topic>")]
pub fn get_topic(topic: &str) -> Result<Json<dto::GetTopicResult>, String> {
    let res = cached_get_topic(topic.to_string())?;
    Ok(Json(res))
}

#[cached(time=300, size=10000, result = true)]
fn cached_get_topic(topic: String) -> Result<dto::GetTopicResult, String> {
    let offsets = _get_offsets(&topic)?;
    let groups = _get_topic_consumer_groups(&topic, &offsets, false)?;
    Ok(dto::GetTopicResult{
        offsets: offsets,
        consumer_groups: groups,
    })
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
    let groups = cached_fetch_group_list()?;
    let mut out = Vec::with_capacity(groups.len());
    for group in groups {
        let members = _get_members(&group)?;
        out.push(
            dto::GroupMetadata{
                name: group.name.to_string(),
                protocol: group.protocol.to_string(),
                protocol_type: group.protocol_type.to_string(),
                state: group.state.to_string(),
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
    let members = _get_members(&to_group(group))?;

    Ok(Json(dto::GetGroupMembersResult{members: members}))
}

#[get("/api/topic/decoders")]
pub fn get_decoders() -> Result<Json<dto::GetDecodersResult>, String> {
    let mut decoders: Vec<dto::DecoderMetadata>;
    unsafe {
        decoders = DECODERS.get_decoders_metadata();
    }
    decoders.sort();
    Ok(Json(dto::GetDecodersResult{decoders: decoders}))
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
            let partition_offsets = _get_offsets_for_partition(topic, partition)?;
            Ok(Json(dto::GetOffsetForTimestampResult{
                offset: partition_offsets.high,
            }))
        },
        _ => Err(format!("bad offset type: {:?}", partition_offset.offset()))
    }
}

fn _get_members(group: &CachedGroup) -> Result<Vec<dto::GroupMemberMetadata>, String> {
    let mut members = Vec::with_capacity(group.members.len());
    for member in &group.members {
        let assignment = match &member.assignment {
            None => "".to_string(),
            Some(payload) => {
                match _parse_member_assignment(&payload) {
                    Ok(assignments) => assignments.iter().map(|ass| ass.topic.to_string() + " [" + &ass.partitions.iter().join(",") + "]").join(", "),
                    Err(err) => {
                        eprintln!("failed parsing group {}: {}", group.name.to_string(), err);
                        "???".to_string()
                    }
                }
            }
        };
        let meta = match &member.metadata {
            None => "",
            Some(data) => match std::str::from_utf8(data) {
                Ok(v) => v,
                Err(_) => "Non-Utf8",
            }
        };
        members.push(
            dto::GroupMemberMetadata{
                member_id: member.id.to_string(),
                client_id: member.client_id.to_string(),
                client_host: member.client_host.to_string(),
                metadata: meta.to_string(),
                assignment: assignment.to_string(),
            })
    }
    Ok(members)
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
    let timeout = Duration::from_secs(10);
    let topics = cached_get_metadata()?;

    let topic_metadata = topics.iter().find(|t| -> bool {t.name == topic}).ok_or("failed to find topic in metadata".to_string())?;

    if topic_metadata.partitions.len() == 1 {
        let out = _get_offsets_for_partition(topic, topic_metadata.partitions[0].partition_id)?;
        return Ok(vec![out]);
    }
    //based on: https://github.com/edenhill/librdkafka/issues/3737
    let low_offsets = kafka_retry("fetching low offsets", &mut || group_consumer("krowser"), &mut |consumer| {
        let mut low_assignment = TopicPartitionList::new();
        for partition in &topic_metadata.partitions {
            low_assignment.add_partition_offset(topic, partition.partition_id, rdkafka::Offset::Offset(0))?;
        }
        consumer.offsets_for_times(low_assignment, timeout)
    })?;
    let low_elements = low_offsets.elements_for_topic(topic);
    let high_offsets = kafka_retry("fetching high offsets", &mut || group_consumer("krowser"), &mut |consumer| {
        let mut high_assignment = TopicPartitionList::new();
        for partition in &topic_metadata.partitions {
            high_assignment.add_partition_offset(topic, partition.partition_id, rdkafka::Offset::End)?;
        }
        consumer.offsets_for_times(high_assignment, timeout)
    })?;
    let mut offsets = Vec::with_capacity(topic_metadata.partitions.len());
    for low_offset in low_elements {
        for high_offset in high_offsets.elements_for_topic(topic) {
            if low_offset.partition() != high_offset.partition() {
                continue;
            }
            if let Offset::Offset(low_offset_num) = low_offset.offset() {
                if let Offset::Offset(high_offset_num) = high_offset.offset() {
                    offsets.push(dto::TopicOffsets{
                        partition: low_offset.partition(),
                        low: low_offset_num,
                        high: high_offset_num,
                    });
                }
            }
        }
    }
    Ok(offsets)
}

fn _get_offsets_for_partition(topic: &str, partition: i32) -> Result<dto::TopicOffsets, String> {
    let consumer: BaseConsumer = retry("connecting consumer", &mut || base_consumer())?;
    let timeout = Duration::from_secs(10);
    let watermarks = retry("fetching watermarks", &mut || consumer
        .fetch_watermarks(topic, partition, timeout))?;
    Ok(dto::TopicOffsets{
        partition: partition,
        low: watermarks.0,
        high: watermarks.1,
    })
}

#[derive(Clone)]
struct CachedMember {
    assignment: Option<Vec<u8>>,
    metadata: Option<Vec<u8>>,
    id: String,
    client_id: String,
    client_host: String,
}

#[derive(Clone)]
struct CachedGroup {
    name: String,
    protocol: String,
    state: String,
    protocol_type: String,
    members: Vec<CachedMember>,
}

fn to_group(group: &GroupInfo) -> CachedGroup {
    CachedGroup{
        name: group.name().to_string(),
        protocol_type: group.protocol_type().to_string(),
        protocol: group.protocol().to_string(),
        state: group.state().to_string(),
        members: group.members().iter().map(|member| CachedMember{
            assignment: member.assignment().map(|ass| ass.to_vec()),
            metadata: member.metadata().map(|meta| meta.to_vec()),
            id: member.id().to_string(),
            client_id: member.client_id().to_string(),
            client_host: member.client_host().to_string(),
        }).collect(),
    }
}

#[cached(time=60, size=10000, result = true)]
fn cached_fetch_group_list() -> Result<Vec<CachedGroup>, String> {
    eprintln!("Refreshing groups cache");
    let start = Instant::now();

    let timeout = Duration::from_secs(10);
    let groups = kafka_retry("fetching groups", &mut base_consumer, &mut |consumer| consumer
        .fetch_group_list(None, timeout))?;
    let out = groups.groups().iter().map(|group|to_group(group)).collect();
    eprintln!("Refreshed groups cache in {:?}", start.elapsed());
    Ok(out)
}

fn _get_topic_consumer_groups(topic: &str, offsets: &Vec<dto::TopicOffsets>, with_committed_offset: bool) -> Result<Vec<dto::TopicConsumerGroup>, String> {
    let timeout = Duration::from_secs(10);
    let groups = cached_fetch_group_list()?;
    let mut topic_groups = Vec::with_capacity(groups.len());
    for group in groups {
        if group.protocol_type != "consumer" {
            continue
        }
        let num_members = group.members.len();
        for member in group.members {
            match member.assignment {
                None => continue,
                Some(payload) => {
                    let assignments = _parse_member_assignment(&payload)?;
                    for assgn in assignments {
                        if assgn.topic == topic {
                            let mut consumer_group_offsets = Vec::with_capacity(num_members);
                            if with_committed_offset {
                                let committed: TopicPartitionList = kafka_retry("fetching offsets for times", &mut || group_consumer(&group.name), &mut |consumer| {
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
                                group_id: group.name.to_string(),
                                offsets: consumer_group_offsets,
                            };
                            topic_groups.push(topic_group);
                        }
                    }
                }
            }
        }
    }

    Ok(topic_groups)
}

#[derive(Debug, Clone, PartialEq)]
pub struct MemberAssignment {
    pub topic: String,
    pub partitions: Vec<i32>,
}

// from: https://github.com/fede1024/rust-rdkafka/pull/184
fn _parse_member_assignment(payload: &[u8]) -> Result<Vec<MemberAssignment>, String> {
    let mut cursor = Cursor::new(payload);
    let _version = map_error(cursor.read_i16::<BigEndian>())?;
    let assign_len = map_error(cursor.read_i32::<BigEndian>())?;
    let mut assigns = Vec::with_capacity(assign_len as usize);
    for _ in 0..assign_len {
        let len = map_error(cursor.read_i16::<BigEndian>())?;
        let len_usize = len as usize;
        let pos = cursor.position() as usize;
        if &cursor.get_ref().len() < &(pos + len_usize) {
            return Err("failed reading topic from assignment".to_string());
        }
        let topic = map_error(std::str::from_utf8(&cursor.get_ref()[pos..(pos + len_usize)]))?;
        cursor.consume(len as usize);
        //let topic = _read_str(&mut cursor)?;
        let partition_len = map_error(cursor.read_i32::<BigEndian>())?;
        let mut partitions = Vec::with_capacity(partition_len as usize);
        for _ in 0..partition_len {
            let partition = map_error(cursor.read_i32::<BigEndian>())?;
            partitions.push(partition);
        }
        assigns.push(MemberAssignment { topic: topic.to_string(), partitions })
    }
    Ok(assigns)
}

#[get("/api/messages/<topic>/<partition>?<limit>&<offset>&<search>&<search_style>&<timeout_millis>&<trace>&<decoding>")]
pub async fn get_messages(
    topic: &str,
    partition: i32,
    limit: Option<i64>,
    offset: Option<i64>,
    search: Option<&str>,
    search_style: Option<dto::SearchStyle>,
    timeout_millis: Option<u64>,
    trace: bool,
    decoding: Option<&str>) -> Result<Json<dto::GetTopicMessagesResult>, String> {

    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);
    let timeout_millis = timeout_millis.unwrap_or(20000);
    let search_style = search_style.unwrap_or(dto::SearchStyle::None);
    let decoding = decoding.unwrap_or("");
    eprintln!("{:?} {:?} {} {}", search, search_style, timeout_millis, decoding);
    match timeout(Duration::from_millis(timeout_millis),
        _get_messages(topic, partition, limit, offset, search, search_style, trace, decoding)).await {
            Err(_) => Ok(Json(dto::GetTopicMessagesResult{has_timeout: true, messages: Vec::new()})),
            Ok(res) => res,
    }
}

async fn _get_messages(
    topic: &str,
    partition: i32,
    mut limit: i64,
    offset: i64,
    search: Option<&str>,
    search_style: dto::SearchStyle,
    trace: bool,
    decoding: &str) -> Result<Json<dto::GetTopicMessagesResult>, String> {
    let regex: Option<Regex> = match search_style {
        dto::SearchStyle::Regex =>
            if let Some(pattern) = &search
                { Some(map_error(Regex::new(pattern))?) } else
                { None },
        _ => None,
    };
    let offsets = _get_offsets_for_partition(topic, partition)?;
    let max_offset = offsets.high;
    if max_offset == 0 || offset > max_offset {
        return Ok(Json(dto::GetTopicMessagesResult{messages: Vec::new(), has_timeout: false}))
    }
    if offset + limit > max_offset {
        limit = max_offset - offset
    }
    if limit <= 0 {
        return Ok(Json(dto::GetTopicMessagesResult{messages: Vec::new(), has_timeout: false}))
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

    let key_decoders: Vec<&Box<dyn Decoder>>;
    let value_decoders: Vec<&Box<dyn Decoder>>;
    unsafe {
        if decoding == "" || decoding == "Auto-Detect" {
            key_decoders = DECODERS.get_decoders(topic.to_string(), true);
            value_decoders = DECODERS.get_decoders(topic.to_string(), false);
        } else {
            let decoder = DECODERS.get_decoder(decoding)?;
            key_decoders = vec![decoder];
            value_decoders = vec![decoder];
        }
    }

    let mut num_consumed = 0;
    let mut messages = Vec::with_capacity(limit.try_into().unwrap());

    let mut message_stream = consumer.stream();
    while let Some(message) = message_stream.next().await {
        num_consumed += 1;
        match message {
            Err(e) => eprintln!("Kafka error: {}", e),
            Ok(m) => {
                let owned = m.detach();
                let owned_search = search.map(|s| s.to_string());
                let owned_regex = regex.clone();
                let owned_key_decoders = key_decoders.to_vec();
                let owned_value_decoders = value_decoders.to_vec();
                let msg = parse_message(owned, partition, owned_search, search_style, trace, owned_regex, owned_key_decoders, owned_value_decoders).await?;
                if let Some(message) = msg {
                    messages.push(message);
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

async fn parse_message(
    m: OwnedMessage,
    partition: i32,
    search: Option<String>,
    search_style: dto::SearchStyle,
    trace: bool,
    regex: Option<Regex>,
    key_decoders: Vec<&Box<dyn Decoder>>,
    value_decoders: Vec<&Box<dyn Decoder>>
) -> Result<Option<dto::TopicMessage>, String> {
    let topic = m.topic();
    let timestamp = match m.timestamp() {
        Timestamp::NotAvailable => 0,
        Timestamp::CreateTime(v) => v,
        Timestamp::LogAppendTime(v) => v,
    };
    let decoded_value = decode(&m, DecodingAttribute::Value, &value_decoders).await?;
    let decoded_key = decode(&m, DecodingAttribute::Key, &key_decoders).await?;
    let json_key = &decoded_key.contents.json.unwrap();
    let json_value = &decoded_value.contents.json.unwrap();
    if trace {
        eprintln!("key: '{:?}', value: {:?}, topic: {}, offset: {}, timestamp: {:?}",
            json_key, json_value, m.topic(), m.offset(), timestamp);
    }
    if let Some(pattern) = search {
        let text = format!("{},{}", json_key, json_value);
        if !includes(text, pattern.to_string(), &search_style, &regex) {
            return Ok(None);
        }
    }
    let out = Some(dto::TopicMessage{
        topic: topic.to_string(),
        partition: partition,
        key: json_key.to_string(),
        timestamp: timestamp,
        offset: m.offset(),
        value: json_value.to_string(),
        key_decoding: decoded_key.decoding,
        value_decoding: decoded_value.decoding,
    });
    Ok(out)
}

pub struct DecodedMessage {
    pub contents: DecodedContents,
    pub decoding: String,
}

async fn decode(message: &OwnedMessage, attr: DecodingAttribute, decoders: &Vec<&Box<dyn Decoder>>) -> Result<DecodedMessage, String>{
    for decoder in decoders {
        let result = decoder.decode(message, &attr).await?;
        if let Some(_) = result.json {
            return Ok(DecodedMessage{contents: result, decoding: decoder.display_name().to_string()});
        }
    }
    let payload = message.payload();
    match payload {
        None => Ok(DecodedMessage{contents: DecodedContents{json: Some("".to_string())}, decoding: "Empty".to_string()}),
        Some(buffer) => Ok(DecodedMessage{contents: DecodedContents{json: Some(format!("??? ({} bytes)", buffer.len()))}, decoding: "Unknown".to_string()}),
    }
}

fn includes(text: String, pattern: String, style: &dto::SearchStyle, regex: &Option<Regex>) -> bool {
    match style {
        dto::SearchStyle::None => text.to_ascii_lowercase().contains(&pattern.to_ascii_lowercase()),
        dto::SearchStyle::CaseSensitive => text.contains(&pattern),
        dto::SearchStyle::Regex => (*regex).as_ref().unwrap().is_match(&text),
    }
}

pub fn update_cache_thread() {
    std::thread::spawn(|| {
        loop {
            eprintln!("Refreshing topic cache");
            let start = Instant::now();
            match cached_get_metadata_prime_cache() {
                Ok(_) => {},
                Err(err) => { eprintln!("failed refreshing metadata cache: {}", err); }
            }
            match cached_fetch_group_list_prime_cache() {
                Ok(_) => {},
                Err(err) => { eprintln!("failed refreshing groups cache: {}", err); }
            }
            match get_topics() {
                Ok(topics) => {
                    topics.into_inner().topics.iter().for_each(|topic| {
                        // this method is generated by the `cached` macro
                        match cached_get_topic_prime_cache(topic.name.to_string()) {
                            Ok(_) => {},
                            Err(err) => { eprintln!("failed refreshing topic cache for {}: {}", topic.name.to_string(), err); }
                        }
                    });
                    sleep(Duration::from_millis(100));
                },
                Err(err) => {
                    eprintln!("error getting topics: {}", err);
                }
            }
            eprintln!("Refreshed topic cache in {:?}", start.elapsed());
        }
    });
}
