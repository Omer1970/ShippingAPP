#!/bin/bash
# StatusLine script based on user's PS1 configuration
# Matches the format: username@hostname:current_directory

input=$(cat)
username=$(whoami)
hostname=$(hostname -s)
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
model_name=$(echo "$input" | jq -r '.model.display_name')

# Use the same color scheme as the user's PS1
# Green for username@hostname, blue for directory, reset at end
printf "\033[01;32m%s@%s\033[00m:\033[01;34m%s\033[00m" "$username" "$hostname" "$current_dir"