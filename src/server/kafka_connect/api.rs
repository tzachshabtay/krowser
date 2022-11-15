use rocket::serde::json::Json;
use std::collections::HashMap;

use crate::config;
use crate::kafka_connect::dto;
use crate::common::errors::{map_error, retry_async};

#[get("/api/kafka-connect/connectors")]
pub async fn get_connectors() -> Result<Json<dto::GetConnectorsResult>, String> {
    let resp = retry_async("fetching connectors", || reqwest::get(format!("{}/connectors", (*config::SETTINGS).kafka_connect.url))).await?;
    let data = map_error(resp.json::<Vec<String>>().await)?;
    Ok(Json(dto::GetConnectorsResult{connectors: data}))
}

#[get("/api/kafka-connect/connector/<connector>/status")]
pub async fn get_connector_status(connector: &str) -> Result<Json<dto::GetConnectorStatusResult>, String> {
    let resp = retry_async("fetching connector status", || reqwest::get(format!("{}/connectors/{}/status", (*config::SETTINGS).kafka_connect.url, connector))).await?;
    let data = map_error(resp.json::<dto::GetConnectorStatusResult>().await)?;
    Ok(Json(data))
}

#[get("/api/kafka-connect/connector/<connector>/config")]
pub async fn get_connector_config(connector: &str) -> Result<Json<dto::GetConnectorConfigResult>, String> {
    let resp = retry_async("fetching connector config", || reqwest::get(format!("{}/connectors/{}/config", (*config::SETTINGS).kafka_connect.url, connector))).await?;
    let data = map_error(resp.json::<HashMap<String, String>>().await)?;
    Ok(Json(dto::GetConnectorConfigResult{config: data}))
}

#[get("/api/kafka-connect/connector/<connector>/tasks")]
pub async fn get_connector_tasks(connector: &str) -> Result<Json<Vec<dto::GetConnectorTasksResult>>, String> {
    let resp = retry_async("fetching connector tasks", || reqwest::get(format!("{}/connectors/{}/tasks", (*config::SETTINGS).kafka_connect.url, connector))).await?;
    let data = map_error(resp.json::<Vec<dto::GetConnectorTasksResult>>().await)?;
    Ok(Json(data))
}

#[get("/api/kafka-connect/connector/<connector>/tasks/<task>/status")]
pub async fn get_connector_task_status(connector: &str, task: &str) -> Result<Json<dto::GetConnectorTaskStatusResult>, String> {
    let resp = retry_async("fetching connector task status", || reqwest::get(format!("{}/connectors/{}/tasks/{}/status", (*config::SETTINGS).kafka_connect.url, connector, task))).await?;
    let data = map_error(resp.json::<dto::ConnectorTask>().await)?;
    Ok(Json(dto::GetConnectorTaskStatusResult{task: data}))
}