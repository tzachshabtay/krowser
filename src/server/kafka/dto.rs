use rocket::serde::{Serialize, Deserialize};

#[derive(PartialEq, Serialize, Deserialize, Debug, Clone)]
pub struct PartitionMetadata {
    pub error_description: Option<String>,
    pub partition_id: i32,
    pub leader: i32,
    pub replicas: Vec<i32>,
    pub isr: Vec<i32>,
}

#[derive(Serialize)]
pub struct BrokerMetadata {
    pub id: i32,
    pub host: String,
    pub port: i32,
}

#[derive(Serialize)]
pub struct TopicMetadata {
    pub name: String,
    pub partitions: Vec<PartitionMetadata>,
}

#[derive(Serialize)]
pub struct GetTopicsResult {
    pub topics: Vec<TopicMetadata>,
}

#[derive(Serialize)]
pub struct GetClusterResult {
    pub brokers: Vec<BrokerMetadata>,
}

#[derive(Serialize, Copy, Clone)]
pub struct TopicOffsets {
    pub partition: i32,
    pub high: i64,
    pub low: i64,
}

#[derive(Serialize)]
pub struct ConsumerGroupOffsets {
    pub metadata: Option<String>,
    pub offset: i64,
    pub partition_offsets: TopicOffsets,
}

#[derive(Serialize)]
pub struct TopicConsumerGroup {
    pub group_id: String,
    pub offsets: Vec<ConsumerGroupOffsets>,
}

#[derive(Serialize)]
pub struct GetTopicOffsetsResult {
    pub offsets: Vec<TopicOffsets>
}

#[derive(Serialize)]
pub struct GetTopicResult {
    pub offsets: Vec<TopicOffsets>,
    pub consumer_groups: Vec<TopicConsumerGroup>
}

#[derive(Serialize)]
pub struct GetTopicConsumerGroupsResult {
    pub consumer_groups: Vec<TopicConsumerGroup>
}

#[derive(Serialize)]
pub struct GroupMemberMetadata {
    pub member_id: String,
    pub client_id: String,
    pub client_host: String,
    pub metadata: String,
    pub assignment: String,
}

#[derive(Serialize)]
pub struct GroupMetadata {
    pub name: String,
    pub protocol: String,
    pub protocol_type: String,
    pub state: String,
    pub members: Vec<GroupMemberMetadata>
}

#[derive(Serialize)]
pub struct GetGroupsResult {
    pub groups: Vec<GroupMetadata>
}

#[derive(Serialize)]
pub struct GetGroupMembersResult {
    pub members: Vec<GroupMemberMetadata>
}

#[derive(Serialize)]
pub struct ConfigEntry {
    pub name: String,
    pub value: Option<String>,
    pub source: String,
    pub is_read_only: bool,
    pub is_default: bool,
    pub is_sensitive: bool,
}

#[derive(Serialize)]
pub struct GetTopicConfigsResult {
    pub entries: Vec<ConfigEntry>
}

#[derive(Serialize)]
pub struct GetBrokerConfigsResult {
    pub entries: Vec<ConfigEntry>
}

#[derive(Serialize)]
pub struct TopicMessage {
    pub topic: String,
    pub partition: i32,
    pub value: String,
    pub key: String,
    pub timestamp: i64,
    pub offset: i64,
    pub key_decoding: String,
    pub value_decoding: String,
}

#[derive(Serialize)]
pub struct GetTopicMessagesResult {
   pub messages: Vec<TopicMessage>,
   pub has_timeout: bool,
}

#[derive(Serialize)]
pub struct GetOffsetForTimestampResult {
    pub offset: i64,
}

#[derive(Serialize, FromFormField, Debug)]
pub enum SearchStyle {
    None,
    #[field(value = "case-sensitive")]
    CaseSensitive,
    Regex,
}

#[derive(Serialize)]
pub struct DecoderMetadata {
    pub id: String,
    pub display_name: String,
}

#[derive(Serialize)]
pub struct GetDecodersResult {
    pub decoders: Vec<DecoderMetadata>
}
