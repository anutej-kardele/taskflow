#!/usr/bin/env bash
# Installs local Kubernetes prerequisites for TaskFlow on macOS.
# Does not create/delete clusters or alter TaskFlow data.
set -Eeuo pipefail

log()  { printf '\n[taskflow] %s\n' "$*"; }
fail() { printf '\n[taskflow] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || fail "This installer supports macOS only. Install Docker, kind, kubectl, Helm, and jq manually on your OS."

command -v brew >/dev/null 2>&1 || fail "Homebrew is required. Install it from https://brew.sh and rerun this script."

install_formula() {
    local binary="$1"
    local formula="$2"
    if command -v "$binary" >/dev/null 2>&1; then
        log "$binary is already installed; skipping."
    else
        log "Installing $formula..."
        brew install "$formula"
        command -v "$binary" >/dev/null 2>&1 || fail "$binary was installed but is not on PATH. Open a new terminal and try again."
    fi
}

# Docker Desktop supplies the Docker engine and Docker Compose plugin.
if [[ -d /Applications/Docker.app || -d "$HOME/Applications/Docker.app" ]] || brew list --cask docker-desktop >/dev/null 2>&1; then
    log "Docker Desktop is already installed; skipping."
else
    log "Installing Docker Desktop..."
    brew install --cask docker-desktop
fi

install_formula kind kind
install_formula kubectl kubectl
install_formula helm helm
install_formula jq jq

log "Installed tools:"
kind version
kubectl version --client
helm version --short
jq --version

if command -v docker >/dev/null 2>&1; then
    docker --version
    if docker info >/dev/null 2>&1; then
        log "Docker engine is running."
    else
        log "Docker Desktop is installed, but its engine is not running. Open Docker Desktop and wait until it starts."
    fi
else
    log "Open Docker Desktop, then start a new terminal if the docker command is not yet on PATH."
fi

log "Prerequisites installed. Next: ./scripts/k8s-up.sh"
