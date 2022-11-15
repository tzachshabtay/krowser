FROM krowser-build-api as build-plugins

WORKDIR /docs/examples/plugins

COPY ./helloworld ./helloworld
COPY ./configdemo ./configdemo

WORKDIR /docs/examples/plugins/helloworld
RUN cargo build --release

WORKDIR /docs/examples/plugins/configdemo
RUN cargo build --release

FROM krowser

COPY --from=build-plugins /docs/examples/plugins/helloworld/target/release/libhelloworld.so /usr/src/krowser/decoders/
COPY --from=build-plugins /docs/examples/plugins/configdemo/target/release/libconfigdemo.so /usr/src/krowser/decoders/

WORKDIR /usr/src/krowser

COPY ./config.toml ./config.toml
CMD ["/usr/src/krowser/krowser"]
