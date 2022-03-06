use rocket::serde::{Serialize, Deserialize};

#[derive(Serialize)]
pub struct GetSubjectsResult {
    pub subjects: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct GetSubjectVersionsResult {
    pub versions: Vec<i64>,
}

#[derive(Serialize, Deserialize)]
pub struct GetSchemaResult {
    pub subject: String,
    pub id: i64,
    pub version: i64,
    pub schema: String,
}