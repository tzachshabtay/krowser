use rocket::serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Serialize)]
pub struct GetConnectorsResult {
    pub connectors: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct GetConnectorStatusResult {
    pub name: String,
    pub connector: ConnectorStatus,
    pub tasks: Vec<ConnectorTask>,
    pub r#type: String,
}

#[derive(Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub state: String,
    pub worker_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct GetConnectorConfigResult {
    pub config: HashMap<String, String>,
}

#[derive(Serialize, Deserialize)]
pub struct ConnectorTaskID {
    pub connector: String,
    pub task: i64,
}

#[derive(Serialize, Deserialize)]
pub struct GetConnectorTasksResult {
    pub id: ConnectorTaskID,
    pub config: HashMap<String, String>,
}

#[derive(Serialize, Deserialize)]
pub struct GetConnectorTaskStatusResult {
    pub task: ConnectorTask,
}

#[derive(Serialize, Deserialize)]
pub struct ConnectorTask {
    pub state: String,
    pub id: i64,
    pub worker_id: String,
}

#[derive(Serialize, FromFormField, Debug)]
pub enum ConnectorState {
    Running,
    Failed,
    Paused,
}
