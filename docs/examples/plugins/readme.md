## Custom decoders demo

This demo includes 2 custom decoders:
- "Hello world"- The most simple decoder that simply returns `{"hello_world":true}` for each message, both for the key and value.
- "Config demo"- This demonstrates how to read values from the configuration file. This reads the built-in server port configuration and a custom configuration value `demo-var` and display them on the grid for each messsage value (which simply returning "Config Demo Key" for the keys).

The demo also includes a custom config file. The custom config file contains the `demo-var` config variable used by the config demo, and also shows how to set custom decoders for specific topics. Here it sets the config demo decoder to be used by default for any topic starting with "test".

Finally the demo shows how to install the decoders into your custom krowser pack. The dockerfile builds the two plugins and copies them to the krowser folder where they will be picked up by krowser.
Run the `run.sh` script to build and run krowser with both plugins installed.

Once it's running you should be able to see both "Hello world" and "Config demo" in the decoding drop-down for each topic. If you have a topic starting with "test" you can also open it and see that the config demo decoder is used automatically.

If you want to see some practical real-life decoders, you can look at the [decoders folder in the source-code](./../../../src/server/decoders).