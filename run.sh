#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
NODE_VERSION=$(node --version | sed 's/^v//')
TAG=template-node-sandbox

cd $DIR

# cd ..

docker build \
  --tag $TAG \
  --build-arg NODE_VERSION=$NODE_VERSION \
  -f Dockerfile \
  .

docker run --rm -it $TAG bash
