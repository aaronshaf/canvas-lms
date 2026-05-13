#!/bin/bash

set -o errexit -o errtrace -o nounset -o pipefail -o xtrace

COVERAGE_DIR=/usr/src/app/coverage-report-dir
COVERAGE_INPUT_DIR=/usr/src/app/tmp/coverage-report-js

# we have to premake the directories because for docker
# sub directories are problematic when making it on a mounted
# directory. permissions errors happen when making sub directories.
rm -vrf "$COVERAGE_DIR"
mkdir -v "$COVERAGE_DIR"
chmod -vvR 777 "$COVERAGE_DIR"

# babel-plugin-istanbul will produce differently formatted
# coverage json files, this script cleans them up to be uniform and what
# nyc merge requires
node ./build/new-jenkins/js/cleanup-coverage.js "$COVERAGE_INPUT_DIR" "$COVERAGE_DIR/"

# aggregate them into .nyc_output for the report
mkdir -v .nyc_output
./node_modules/.bin/nyc merge "$COVERAGE_DIR" .nyc_output/total-coverage.json

# the html report
./node_modules/.bin/nyc report --reporter=html --report-dir report-html
