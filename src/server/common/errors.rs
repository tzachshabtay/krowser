use std::time::Duration;
use std::thread;

pub fn map_error<T, E: std::fmt::Debug>(result: Result<T, E>) -> Result<T, String> {
    match result {
        Ok(v) => Ok(v),
        Err(e) => Err(format!("{:?}", e)),
    }
}

pub fn retry<T, E: std::fmt::Debug>(name: &str, action: &mut dyn std::ops::FnMut() -> std::result::Result<T, E>) -> Result<T, String> {
    let mut retries = 5;
    let mut wait = 500;
    loop {
        let res = action();
        match res {
            Ok(val) => { return Ok(val); },
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
