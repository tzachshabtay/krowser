#[macro_use] extern crate rocket;

use rocket::fs::{NamedFile, relative};
use rocket::serde::json::Json;
use rocket::serde::{Serialize, Deserialize};

use std::path::{Path, PathBuf};
use std::time::Duration;

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, Consumer};
use rdkafka::error::{KafkaResult,RDKafkaError};

mod config;

#[get("/")]
async fn index() -> Option<NamedFile> {
    let page_directory_path = public();
    NamedFile::open(Path::new(&page_directory_path).join("index.html")).await.ok()
}

#[get("/assets/<file..>")]
async fn files(file: PathBuf) -> Option<NamedFile> {
    let page_directory_path = assets();
    NamedFile::open(Path::new(&page_directory_path).join(file)).await.ok()
}

#[derive(PartialEq, Serialize, Deserialize, Debug, Clone)]
struct PartitionMetadata {
    error_description: Option<String>,
    partition_id: i32,
    leader: i32,
    replicas: Vec<i32>,
    isr: Vec<i32>,
}

#[derive(Serialize)]
struct TopicMetadata {
    name: String,
    partitions: Vec<PartitionMetadata>,
}

#[derive(Serialize)]
struct GetTopicsResult {
    topics: Vec<TopicMetadata>,
}

#[derive(Serialize)]
struct TopicOffsets {
    partition: i32,
    high: i64,
    low: i64,
}

#[derive(Serialize)]
struct GetTopicOffsetsResult {
    offsets: Vec<TopicOffsets>
}

fn map_kafka_error<T>(result: KafkaResult<T>) -> Result<T, String> {
    match result {
        Ok(v) => Ok(v),
        Err(e) => Err(format!("{}", e)),
    }
}

#[get("/api/topics")]
fn get_topics() -> Result<Json<GetTopicsResult>, String> {
    println!("Connecting to kafka at: {}", *config::KAFKA_URLS);
    let consumer: BaseConsumer = map_kafka_error(ClientConfig::new()
        .set("bootstrap.servers", &config::KAFKA_URLS)
        .create())?;

    let timeout = Duration::from_secs(10);
    let metadata = map_kafka_error(consumer
        .fetch_metadata(None, timeout))?;

    let mut topics = Vec::with_capacity(metadata.topics().len());
    for topic in metadata.topics() {
        let mut partitions = Vec::with_capacity(topic.partitions().len());
        for partition in topic.partitions() {
            let err_desc = partition.error()
                .map(|e| format!("{}", RDKafkaError::from(e).to_owned()));
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

#[get("/api/topic/<topic>/offsets")]
fn get_offsets(topic: &str) -> Result<Json<GetTopicOffsetsResult>, String> {
    println!("Connecting to kafka at: {}", *config::KAFKA_URLS);
    let consumer: BaseConsumer = map_kafka_error(ClientConfig::new()
        .set("bootstrap.servers", &config::KAFKA_URLS)
        .create())?;

    let timeout = Duration::from_secs(10);
    let metadata = map_kafka_error(consumer
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
        let watermarks = map_kafka_error(consumer
            .fetch_watermarks(topic, partition.id(), timeout))?;
        offsets.push(TopicOffsets{
            partition: partition.id(),
            low: watermarks.0,
            high: watermarks.1,
        });
    }
    Ok(Json(GetTopicOffsetsResult{
        offsets: offsets,
    }))
}

fn public() -> &'static str {
    relative!("../../public")
}

fn assets() -> &'static str {
    relative!("../../dist/client")
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![index, files, get_topics, get_offsets])
}