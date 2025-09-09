#!/bin/sh
# Health check script for Angular frontend

curl -f http://localhost/ || exit 1