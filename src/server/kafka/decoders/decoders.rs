use crate::common::errors::map_error;
use serverapi::Decoder;
use std::ffi::OsStr;
use libloading::{Library,Symbol};

pub struct Decoders {
    pub decoders: Vec<Box<dyn Decoder>>,
    loaded_libraries: Vec<Library>,
}

impl Decoders {
    pub fn new() -> Decoders {
        Decoders {
            decoders: Vec::new(),
            loaded_libraries: Vec::new(),
        }
    }

    pub async unsafe fn load_plugin<P: AsRef<OsStr>>(&mut self, filename: P) -> Result<(), String> {
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
        eprintln!("Loaded plugin: {}", plugin.name());
        plugin.on_init();//.await;
        self.decoders.push(plugin);

        Ok(())
    }

    /// Unload all plugins and loaded plugin libraries, making sure to fire
    /// their `on_plugin_unload()` methods so they can do any necessary cleanup.
    pub fn unload(&mut self) {
        eprintln!("Unloading plugins");

        for plugin in self.decoders.drain(..) {
            eprintln!("Firing on_unload for {:?}", plugin.name());
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
