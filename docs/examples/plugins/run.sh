#!/usr/bin/env bash
set -euxo pipefail

cd ../../.. && docker build -t krowser .
cd - && docker build -t krowser_with_plugins .

docker run -it -p 9999:9999 krowser_with_plugins