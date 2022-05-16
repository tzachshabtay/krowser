use rocket::serde::json::Json;

use crate::config;
use crate::schema_registry::dto;
use crate::common::errors::{map_error, retry_async};

#[get("/api/schema-registry/subjects")]
pub async fn get_subjects() -> Result<Json<dto::GetSubjectsResult>, String> {
    let resp = retry_async("fetching subjects", || reqwest::get(format!("{}/subjects", *config::SCHEMA_REGISTRY_URL))).await?;
    let data = map_error(resp.json::<Vec<String>>().await)?;
    Ok(Json(dto::GetSubjectsResult{subjects: data}))
}

#[get("/api/schema-registry/versions/<subject>")]
pub async fn get_subject_versions(subject: &str) -> Result<Json<dto::GetSubjectVersionsResult>, String> {
    let resp = retry_async("fetching schema versions", || reqwest::get(format!("{}/subjects/{}/versions", *config::SCHEMA_REGISTRY_URL, subject))).await?;
    let data = map_error(resp.json::<Vec<i64>>().await)?;
    Ok(Json(dto::GetSubjectVersionsResult{versions: data}))
}

#[get("/api/schema-registry/schema/<subject>/<version>")]
pub async fn get_schema(subject: &str, version: i64) -> Result<Json<dto::GetSchemaResult>, String> {
    let resp = retry_async("fetching schema", || reqwest::get(format!("{}/subjects/{}/versions/{}", *config::SCHEMA_REGISTRY_URL, subject, version))).await?;
    let data = map_error(resp.json::<dto::GetSchemaResult>().await)?;
    Ok(Json(data))
}
