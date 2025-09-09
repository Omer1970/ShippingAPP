<?php
echo "DB_CONNECTION: " . (getenv('DB_CONNECTION') ?: 'not found') . "\n";
echo "DB_HOST: " . (getenv('DB_HOST') ?: 'not found') . "\n";
echo "APP_KEY: " . (substr(getenv('APP_KEY'), 0, 20) ?: 'not found') . "\n";
echo "Working directory: " . getcwd() . "\n";
echo "Script filename: " . $_SERVER['SCRIPT_FILENAME'] . "\n";