use crate::config::DynamicConfig;
use crate::kafka::dto::DecoderMetadata;
use crate::common::errors::map_error;
use crate::kafka::decoders::avro::AvroConfluentDecoder;
use crate::kafka::decoders::bytes::BytesDecoder;
use crate::kafka::decoders::utf8::Utf8Decoder;
use crate::config;
use serverapi::Decoder;
use std::env;
use std::ffi::OsStr;
use std::collections::HashMap;
use libloading::{Library,Symbol};
use std::fs;
use once_cell::sync::Lazy;
use regex::Regex;

pub static mut DECODERS: Lazy<Decoders> = Lazy::new(|| {
    let decoders: Decoders = futures::executor::block_on(async {
        let mut loader = Decoders::new();
        unsafe {
            loader.load_all_plugins().await.unwrap();
        }
        loader
    });
    decoders
});

pub struct Decoders {
    pub decoders: HashMap<String, Box<dyn Decoder>>,
    loaded_libraries: Vec<Library>,
}

impl Decoders {
    pub fn new() -> Decoders {
        Decoders {
            decoders: HashMap::new(),
            loaded_libraries: Vec::new(),
        }
    }

    pub async unsafe fn load_all_plugins(&mut self) -> Result<(), String> {
        self.add_decoder(Box::new(AvroConfluentDecoder::default()));
        self.add_decoder(Box::new(Utf8Decoder::default()));
        self.add_decoder(Box::new(BytesDecoder::default()));

        let decoders_dir = "./decoders";
        if !fs::metadata(decoders_dir).is_ok() {
            let dir = env::current_dir().unwrap().into_os_string().into_string().unwrap();
            eprintln!("No custom decoders found, current dir {}", dir);
            return Ok(());
        }
        let paths = map_error(fs::read_dir(decoders_dir))?;

        for path in paths {
            let file_path = path.unwrap().path().display().to_string();
            eprintln!("Loading decoder from: {}", file_path);
            map_error(self.load_plugin(file_path).await)?;
        }
        for (_, decoder) in &self.decoders {
            let conf = DynamicConfig{};
            let conf_boxed: Box<dyn serverapi::Config + Send> = Box::new(conf);
            eprintln!("Initializing decoder {}", decoder.id());
            decoder.on_init(conf_boxed).await;
        }
        Ok(())
    }

    fn add_decoder(&mut self, decoder: Box<dyn Decoder>) {
        self.decoders.insert(decoder.id().to_string(), decoder);
    }

    async unsafe fn load_plugin<P: AsRef<OsStr>>(&mut self, filename: P) -> Result<(), String> {
        type PluginCreate = unsafe fn() -> *mut dyn Decoder;

        let lib = map_error(Library::new(filename.as_ref()))?;

        // We need to keep the library around otherwise our plugin's vtable will
        // point to garbage. We do this little dance to make sure the library
        // doesn't end up getting moved.
        self.loaded_libraries.push(lib);

        let lib = self.loaded_libraries.last().unwrap();

        let constructor: Symbol<PluginCreate> = map_error(lib.get(b"_plugin_create"))?;
        let boxed_raw = constructor();

        let plugin = Box::from_raw(boxed_raw);
        eprintln!("Loaded plugin: {}", plugin.id());
        self.add_decoder(plugin);

        Ok(())
    }

    pub fn get_decoders(&mut self, topic: String, key: bool) -> Vec<&Box<dyn Decoder>> {
        let mut decoders: Vec<&Box<dyn Decoder>> = vec![];
        let mut decoders_str = (&(*config::SETTINGS).kafka.value_decoders).to_string();
        if key {
            decoders_str = (&(*config::SETTINGS).kafka.key_decoders).to_string();
        }
        if let Some(topics) = &(*config::SETTINGS).kafka.kafka_topics {
            for topic_group in topics {
                if key && topic_group.key_decoders.is_empty() {
                    continue;
                }
                if !key && topic_group.value_decoders.is_empty() {
                    continue;
                }
                let regex = Regex::new(&topic_group.name).unwrap(); // todo: we could cache the regex-es at startup to increase performance
                if regex.is_match(&topic) {
                    if key {
                        decoders_str = topic_group.key_decoders.to_string();
                    } else {
                        decoders_str = topic_group.value_decoders.to_string();
                    }
                    break;
                }
            }
        }
        let tokens = decoders_str.split(",");
        for token in tokens {
            let decoder = self.decoders.get(token).unwrap();
            decoders.push(decoder);
        }
        decoders
    }

    pub fn get_decoder(&mut self, id: &str) -> Result<&Box<dyn Decoder>, String> {
        match self.decoders.get(id) {
            Some(decoder) => Ok(decoder),
            None => Err(format!("no decoder with id {}", id))
        }
    }

    pub fn get_decoders_metadata(&mut self) -> Vec<DecoderMetadata> {
        let mut decoders: Vec<DecoderMetadata> = vec![];
        for (_, value) in &self.decoders {
            decoders.push(DecoderMetadata{id: value.id().to_string(), display_name: value.display_name().to_string()});
        }
        decoders
    }

    /// Unload all plugins and loaded plugin libraries, making sure to fire
    /// their `on_plugin_unload()` methods so they can do any necessary cleanup.
    pub fn unload(&mut self) {
        eprintln!("Unloading plugins");

        for (plugin_name, plugin) in self.decoders.drain() {
            eprintln!("Firing on_unload for {:?}", plugin_name);
            plugin.on_unload();
        }

        for lib in self.loaded_libraries.drain(..) {
            drop(lib);
        }
    }
}

impl Drop for Decoders {
    fn drop(&mut self) {
        if !self.decoders.is_empty() || !self.loaded_libraries.is_empty() {
            self.unload();
        }
    }
}
