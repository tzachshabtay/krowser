#[macro_use] extern crate rocket;

use rocket::fs::{NamedFile, relative};

use std::path::{Path, PathBuf};

mod config;
mod kafka {
    pub mod api;
    mod dto;
}

#[get("/<_file..>")]
async fn index(_file: PathBuf) -> Option<NamedFile> {
    let page_directory_path = public();
    NamedFile::open(Path::new(&page_directory_path).join("index.html")).await.ok()
}

#[get("/assets/<file..>")]
async fn files(file: PathBuf) -> Option<NamedFile> {
    let page_directory_path = assets();
    NamedFile::open(Path::new(&page_directory_path).join(file)).await.ok()
}


fn public() -> &'static str {
    relative!("../../public")
}

fn assets() -> &'static str {
    relative!("../../dist/client")
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![
        index,
        files,
        kafka::api::get_topics,
        kafka::api::get_offsets,
        kafka::api::get_messages,
        kafka::api::get_topic,
        kafka::api::get_topic_consumer_groups,
        kafka::api::get_topic_configs,
        kafka::api::get_broker_configs,
        kafka::api::get_cluster,
        kafka::api::get_groups,
        kafka::api::get_group_members,
        kafka::api::get_offset_for_timestamp,
    ])
}