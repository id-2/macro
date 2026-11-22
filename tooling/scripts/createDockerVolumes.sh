#!/usr/bin/env bash

# Function to create Docker volume
create_volume() {
    docker volume create --name $1
}

# Create Docker volumes
create_volume rox_db_volume
create_volume rox_cache_volume

# Opensearch
create_volume rox_opensearch_1
create_volume rox_opensearch_2
