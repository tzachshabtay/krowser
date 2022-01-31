#[macro_use] extern crate rocket;

use rocket::fs::{NamedFile, relative};

use std::path::{Path, PathBuf};

mod config;
mod kafka;

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
        kafka::get_topics,
        kafka::get_offsets,
        kafka::get_messages,
        kafka::get_topic,
        kafka::get_topic_consumer_groups,
        kafka::get_topic_configs,
        kafka::get_broker_configs,
        kafka::get_cluster,
    ])
}