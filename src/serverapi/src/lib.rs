use rdkafka::message::OwnedMessage;
use async_trait::async_trait;
use std::any::Any;

pub struct DecodedContents {
    pub json: Option<String>,
}

pub enum DecodingAttribute {
    Key,
    Value,
}

pub trait Config {
    fn get_string(&self, key: String) -> Option<String>;
}

#[async_trait]
pub trait DecoderBuilder: Any + Send + Sync {
    /// this is called on startup to initialize the decoder.
    async fn build(&self, _config: Box<dyn Config + Send>) -> Box<dyn Decoder>;
}

#[async_trait]
pub trait Decoder: Any + Send + Sync {
    /// An id for the decoder (will appear in the configuration file for selecting decoders per topic).
    fn id(&self) -> &'static str;

    /// A name for the decoder (will appear in an encoding column).
    fn display_name(&self) -> &'static str;

    /// Should attempt to decode a kafka message's key/value into json (the attribute instructs whether to decode the key or the value).
    /// If the key/value is not encoded in a protocol the decoder understands,
    /// it's expected to return None in the json field, not return an error.
    /// An error should signify that the decoder is unable to decoded unrelated to the message contents (like failing to connect to a schema provider).
    async fn decode(&self, message: &OwnedMessage, attribute: &DecodingAttribute) -> Result<DecodedContents, String>;

    /// A callback fired immediately before the plugin is unloaded. Use this if
    /// you need to do any cleanup.
    fn on_unload(&self) {}
}

/*

Allows external plugins to register themselves for custom decoding.
Code from: https://michael-f-bryan.github.io/rust-ffi-guide/dynamic_loading.html

*/
#[macro_export]
macro_rules! declare_plugin {
    ($plugin_type:ty, $constructor:path) => {
        #[no_mangle]
        pub extern "C" fn _plugin_create() -> *mut dyn $crate::DecoderBuilder {
            // make sure the constructor is the correct type.
            let constructor: fn() -> $plugin_type = $constructor;

            let object = constructor();
            let boxed: Box<dyn $crate::DecoderBuilder> = Box::new(object);
            Box::into_raw(boxed)
        }
    };
}
