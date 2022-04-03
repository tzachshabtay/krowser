# Rust as the base image
# FROM rust:1.59 as build
#FROM ubuntu:16.04 as build

FROM messense/rust-musl-cross:x86_64-musl as build
RUN sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get install -y python pkg-config libssl-dev apt-file && sudo apt-get clean && sudo rm -rf /var/lib/apt/lists/*
RUN apt-file update && export OPENSSL_DIR=$(apt-file list libssl-dev | grep libssl.a | awk '{ print $2 }')
RUN rustup update && \
    rustup target add x86_64-unknown-linux-musl

#ADD . /home/rust/src
#RUN apt-get update && apt-get install -y python && apt-get clean && rm -rf /var/lib/apt/lists/*
#RUN rustup update && \
#    rustup target add x86_64-unknown-linux-musl
#RUN cargo build --release


#RUN apt-get update
#RUN apt-get install -y \
#  build-essential \
#  cmake \
#  curl \
#  git \
#  python \
#  pkg-config \
#  libssl-dev
#RUN curl https://sh.rustup.rs -sSf | sh -s -- -y


#RUN apt purge --auto-remove cmake && \
#    apt update && \
#    apt install -y software-properties-common lsb-release && \
#    apt clean all && \
#    wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | sudo tee /etc/apt/trusted.gpg.d/kitware.gpg >/dev/null && \
#    apt-add-repository "deb https://apt.kitware.com/ubuntu/ $(lsb_release -cs) main" && \
#    apt update && \
#    apt install kitware-archive-keyring && \
#    rm /etc/apt/trusted.gpg.d/kitware.gpg && \
#    apt update && \
#    apt install cmake

# RUN apt-get update && apt-get install -y build-essential \
#     curl \
#     openssl libssl-dev \
#     pkg-config \
#     python \
#     valgrind \
#     zlib1g-dev
#
# RUN cmake --version

#RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH /root/.cargo/bin/:$PATH

# Create a new empty shell project
RUN USER=root cargo new --bin krowser
WORKDIR /krowser

# Copy our manifests
COPY ./src/server/Cargo.lock ./Cargo.lock
COPY ./src/server/Cargo.toml ./Cargo.toml

# Build only the dependencies to cache them
RUN cargo build --release --features=rdkafka/cmake_build
RUN rm src/*.rs

# Copy the source code
COPY ./src/server ./src

# Build for release.
RUN rm ./target/release/deps/krowser*
RUN cargo build --release

FROM node:12.18.0-buster AS base
WORKDIR /usr/src/krowser
COPY package*.json ./
# Copy from the previous build
COPY --from=build /krowser/target/release/krowser /usr/src/krowser
# COPY --from=build /holodeck/target/release/holodeck/target/x86_64-unknown-linux-musl/release/holodeck .


FROM base AS dependencies
RUN npm i

FROM dependencies AS release
COPY . .
RUN npm run build:frontend
CMD ["/usr/src/krowser"]
