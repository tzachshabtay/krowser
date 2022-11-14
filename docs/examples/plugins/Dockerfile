FROM krowser

WORKDIR /plugins

COPY ./helloworld ./helloworld
COPY ./configdemo ./configdemo

WORKDIR /plugins/helloworld
RUN cargo build --release

WORKDIR /plugins/configdemo
RUN cargo build --release

WORKDIR /plugins

RUN cp -R ./helloworld/target/release/libhelloworld.dylib /usr/src/krowser/decoders
RUN cp -R ./configdemo/target/release/libconfigdemo.dylib /usr/src/krowser/decoders

WORKDIR /usr/src/krowser

COPY ./config.toml ./config.toml
CMD ["/usr/src/krowser/krowser"]
