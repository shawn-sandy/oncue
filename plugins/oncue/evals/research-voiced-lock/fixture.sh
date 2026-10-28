#!/usr/bin/env bash
# Copies this case's fixtures into the run's empty workspace, plus an unchosen take: the audio file only
# has to exist, because the stage comes from which files are in the folder.
set -euo pipefail
cp -R "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/fixtures/." .
: > voiceover-take1.mp3
