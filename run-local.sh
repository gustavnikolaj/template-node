#!/usr/bin/env node

set -euo pipefail
IFS=$'\n\t'

# Get the dirname of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Check if at least one argument is provided
if [ $# -lt 1 ]; then
    echo "Error: This script requires at least one argument."
    echo "Usage: $0 <arg1> [arg2] [arg3] ..."
    exit 1
fi

# Assign the first argument to TARGET
TARGET="__local/run/$1"

# Shift the first argument so that "$@" contains only the remaining arguments
# and store those
shift
ARGS=("$@")

cd $DIR

if [ -e $TARGET ] ; then
  rm -fr $TARGET
fi

mkdir -p $TARGET

git archive --format=tar HEAD | tar -x -C $TARGET
git ls-files --modified --others --exclude-standard -z | rsync -a --files-from=- --from0 . $TARGET

cd $TARGET

node bootstrap $@
