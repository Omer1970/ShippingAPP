<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Customer Search Configuration
    |--------------------------------------------------------------------------
    |
    | Configure settings for customer search functionality including
    | autocomplete parameters, caching, and relevance scoring.
    |
    */

    'customer' => [
        'autocomplete' => [
            'min_length' => env('CUSTOMER_SEARCH_MIN_LENGTH', 2),
            'max_results' => env('CUSTOMER_SEARCH_MAX_RESULTS', 10),
            'cache_ttl' => env('CUSTOMER_SEARCH_CACHE_TTL', 300), // 5 minutes
            'rate_limit' => env('CUSTOMER_SEARCH_RATE_LIMIT', 120), // requests per minute
            'response_time_target' => env('CUSTOMER_SEARCH_RESPONSE_TIME', 200), // milliseconds
        ],
        
        'search' => [
            'max_results' => env('CUSTOMER_MAX_SEARCH_RESULTS', 50),
            'cache_ttl' => env('CUSTOMER_SEARCH_CACHE_TTL', 600), // 10 minutes
            'fuzzy_matching' => env('CUSTOMER_FUZZY_SEARCH', true),
            'similarity_threshold' => env('CUSTOMER_SIMILARITY_THRESHOLD', 0.6),
            'boost_recent' => env('CUSTOMER_BOOST_RECENT_SEARCHES', true),
            'response_time_target' => env('CUSTOMER_SEARCH_RESPONSE_TIME', 500), // milliseconds
        ],

        'relevance' => [
            'scoring' => [
                'exact_match' => env('CUSTOMER_EXACT_MATCH_WEIGHT', 100),
                'prefix_match' => env('CUSTOMER_PREFIX_MATCH_WEIGHT', 80),
                'contains_match' => env('CUSTOMER_CONTAINS_MATCH_WEIGHT', 60),
                'fuzzy_match' => env('CUSTOMER_FUZZY_MATCH_WEIGHT', 40),
                'recent_search_bonus' => env('CUSTOMER_RECENT_SEARCH_BONUS', 10),
                'search_frequency_bonus' => env('CUSTOMER_SEARCH_FREQUENCY_BONUS', 5),
                'total_orders_multiplier' => env('CUSTOMER_ORDERS_MULTIPLIER', 0.1),
                'total_value_multiplier' => env('CUSTOMER_VALUE_MULTIPLIER', 0.00001),
            ],
            'fields' => [
                'name' => env('CUSTOMER_NAME_SEARCH_WEIGHT', 100),
                'email' => env('CUSTOMER_EMAIL_SEARCH_WEIGHT', 90),
                'phone' => env('CUSTOMER_PHONE_SEARCH_WEIGHT', 70),
                'address' => env('CUSTOMER_ADDRESS_SEARCH_WEIGHT', 60),
                'tax_number' => env('CUSTOMER_TAX_NUMBER_SEARCH_WEIGHT', 50),
                'categories' => env('CUSTOMER_CATEGORIES_SEARCH_WEIGHT', 30),
            ]
        ],

        'elasticsearch' => [
            'enabled' => env('CUSTOMER_ELASTICSEARCH_ENABLED', false),
            'prefix_analysis' => env('CUSTOMER_ELASTICSEARCH_PREFIX', 'shipment_app'),
            'max_autocomplete_results' => env('ELASTICSEARCH_AUTOCOMPLETE_LIMIT', 100),
            'fuzziness' => env('ELASTICSEARCH_FUZZINESS', 'AUTO'),
            'slop' => env('ELASTICSEARCH_SLOP', 2), // for phrase queries with partial matching
        ],

        'mysql' => [
            'fulltext_search' => [
                'enabled' => env('CUSTOMER_MYSQL_FULLTEXT_ENABLED', true),
                'preprocessing' => [
                    'strip_special_chars' => env('CUSTOMER_STRIP_SPECIAL_CHARS', true),
                    'convert_to_lowercase' => env('CUSTOMER_CONVERT_LOWERCASE', true),
                    'remove_duplicate_spaces' => env('CUSTOMER_REMOVE_DUPLICATE_SPACES', true),
                    'stemming' => env('CUSTOMER_STEMMING_ENABLED', false), // Advanced feature
                ],
                'ranking' => [
                    'relevance_boost' => env('CUSTOMER_RELEVANCE_BOOST', 2.0),
                    'popularity_boost' => env('CUSTOMER_POPULARITY_BOOST', 1.5),
                    'recent_boost' => env('CUSTOMER_RECENT_BOOST', 1.2),
                    'order_count_boost' => env('CUSTOMER_ORDER_COUNT_BOOST', 1.1),
                ]
            ]
        ],

        'caching' => [
            'driver' => env('CUSTOMER_SEARCH_CACHE_DRIVER', 'redis'),
            'prefix' => env('CUSTOMER_SEARCH_CACHE_PREFIX', 'customer_search'),
            'tag_autocomplete' => 'autocomplete',
            'tag_search_results' => 'search_results',
            'tag_customer_data' => 'customer_data',
            'ttl' => [
                'autocomplete' => env('CUSTOMER_AUTOCOMPLETE_CACHE_TTL', 300), // 5 minutes
                'search_results' => env('CUSTOMER_SEARCH_RESULTS_CACHE_TTL', 600), // 10 minutes
                'customer_data' => env('CUSTOMER_DATA_CACHE_TTL', 3600), // 1 hour
            ]
        ],

        'dolibarr' => [
            'sync_enabled' => env('CUSTOMER_DOLIBARR_SYNC_ENABLED', true),
            'sync_frequency' => env('CUSTOMER_DOLIBARR_SYNC_FREQUENCY', 'hourly'),
            'batch_size' => env('CUSTOMER_DOLIBARR_BATCH_SIZE', 100),
            'webhooks_enabled' => env('CUSTOMER_DOLIBARR_WEBHOOKS_ENABLED', true),
            'webhook_secret' => env('CUSTOMER_DOLIBARR_WEBHOOK_SECRET', ''),
            'failed_sync_threshold' => env('CUSTOMER_DOLIBARR_FAILED_SYNC_THRESHOLD', 1000),
            'connection_timeout' => env('CUSTOMER_DOLIBARR_CONNECTION_TIMEOUT', 30),
            'retry_attempts' => env('CUSTOMER_DOLIBARR_RETRY_ATTEMPTS', 3),
            'retry_delay' => env('CUSTOMER_DOLIBARR_RETRY_DELAY', 60), // seconds
        ],

        'performance' => [
            'max_query_time' => env('CUSTOMER_MAX_QUERY_TIME', 2.0), // seconds
            'max_memory_usage' => env('CUSTOMER_MAX_MEMORY_USAGE', '128M'),
            'chunk_size' => env('CUSTOMER_CHUNK_SIZE', 1000),
            'parallel_processing' => env('CUSTOMER_PARALLEL_PROCESSING', false),
            'index_batch_size' => env('CUSTOMER_INDEX_BATCH_SIZE', 500),
        ],

        'security' => [
            'query_validation' => env('CUSTOMER_SEARCH_QUERY_VALIDATION', true),
            'max_query_length' => env('CUSTOMER_MAX_QUERY_LENGTH', 255),
            'disallowed_patterns' => env('CUSTOMER_DISALLOWED_PATTERNS', '/(<script|javascript:|onload=|onerror=|drop table|union select|--)/i'),
            'require_authentication' => env('CUSTOMER_SEARCH_REQUIRE_AUTH', true),
            'role_based_access' => env('CUSTOMER_ROLE_BASED_ACCESS', true),
            'audit_logging_enabled' => env('CUSTOMER_AUDIT_LOGGING', true),
            'rate_limiting' => [
                'enabled' => env('CUSTOMER_RATE_LIMITING_ENABLED', true),
                'autocomplete_limit' => env('CUSTOMER_AUTOCOMPLETE_RATE_LIMIT', 120), // per minute
                'search_limit' => env('CUSTOMER_SEARCH_RATE_LIMIT', 60), // per minute
                'block_duration' => env('CUSTOMER_RATE_LIMIT_BLOCK_DURATION', 900), // 15 minutes
            ],
            'data_protection' => [
                'gdpr_compliant' => env('CUSTOMER_GDPR_COMPLIANT', true),
                'log_retention_period' => env('CUSTOMER_LOG_RETENTION_DAYS', 90),
                'search_anonymization' => env('CUSTOMER_SEARCH_ANONYMIZATION', false),
            ]
        ],

        'mobile_optimization' => [
            'touch_keyboard_optimization' => env('CUSTOMER_TOUCH_KEYBOARD_OPTIMIZE', true),
            'default_input_type' => env('CUSTOMER_DEFAULT_INPUT_TYPE', 'search'),
            'autocomplete_delay' => env('CUSTOMER_AUTOCOMPLETE_DELAY_TOUCH', 500), // milliseconds
            'max_touch_results' => env('CUSTOMER_MAX_TOUCH_RESULTS', 8),
            'keyboard_types' => [
                'name' => env('CUSTOMER_NAME_KEYBOARD_TYPE', 'text'),
                'email' => env('CUSTOMER_EMAIL_KEYBOARD_TYPE', 'email'),
                'phone' => env('CUSTOMER_PHONE_KEYBOARD_TYPE', 'tel'),
                'numeric' => env('CUSTOMER_NUMERIC_KEYBOARD_TYPE', 'tel'),
            ],
            'voice_input_enabled' => env('CUSTOMER_VOICE_INPUT_ENABLED', true),
            'voice_recognition_timeout' => env('CUSTOMER_VOICE_TIMEOUT', 10000), // 10 seconds
        ],

        'accessibility' => [
            'wcag_compliance' => env('CUSTOMER_WCAG_COMPLIANCE', '2.1-AA'),
            'screen_reader_support' => env('CUSTOMER_SCREEN_READER_SUPPORT', true),
            'high_contrast_mode' => env('CUSTOMER_HIGH_CONTRAST_MODE', true),
            'keyboard_navigation' => env('CUSTOMER_KEYBOARD_NAVIGATION', true),
            'aria_labels_enabled' => env('CUSTOMER_ARIA_LABELS', true),
            'color_contrast_ratio' => env('CUSTOMER_COLOR_CONTRAST_RATIO', 4.5),
        ],

        'monitoring' => [
            'performance_metrics' => env('CUSTOMER_SEARCH_METRICS_ENABLED', true),
            'log_slow_queries' => env('CUSTOMER_LOG_SLOW_QUERIES', true),
            'slow_query_threshold' => env('CUSTOMER_SLOW_QUERY_THRESHOLD', 1000), // milliseconds
            'track_search_popularity' => env('CUSTOMER_TRACK_POPULARITY', true),
            'search_analytics' => env('CUSTOMER_SEARCH_ANALYTICS', true),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Global Search Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for global search across multiple entity types
    |
    */
    
    'global' => [
        'enabled_types' => [
            'customers' => env('GLOBAL_SEARCH_CUSTOMERS_ENABLED', true),
            'orders' => env('GLOBAL_SEARCH_ORDERS_ENABLED', true),
            'shipments' => env('GLOBAL_SEARCH_SHIPMENTS_ENABLED', true),
            'products' => env('GLOBAL_SEARCH_PRODUCTS_ENABLED', false),
        ],
        
        'max_results_per_type' => env('GLOBAL_SEARCH_MAX_RESULTS_PER_TYPE', 5),
        'cache_ttl' => env('GLOBAL_SEARCH_CACHE_TTL', 300), // 5 minutes
        'cross_reference_connections' => env('GLOBAL_SEARCH_CROSS_REFERENCES', true),
        
        'relevance' => [
            'priorities' => [
                'customers' => env('GLOBAL_SEARCH_CUSTOMER_PRIORITY', 100),
                'orders' => env('GLOBAL_SEARCH_ORDER_PRIORITY', 80),
                'shipments' => env('GLOBAL_SEARCH_SHIPMENT_PRIORITY', 70),
                'products' => env('GLOBAL_SEARCH_PRODUCT_PRIORITY', 60),
            ]
        ]
    ],

    /*
    |--------------------------------------------------------------------------
    | Integration Test Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for integration testing of search functionality
    |
    */
    
    'testing' => [
        'performance_baseline' => [
            'autocomplete_response_time' => env('SEARCH_AUTOCOMPLETE_BASELINE_MS', 200),
            'search_response_time' => env('SEARCH_RESPONSE_BASELINE_MS', 500),
            'profile_load_time' => env('SEARCH_PROFILE_LOAD_BASELINE_MS', 1000),
        ],
        'test_data_sets' => [
            'customers' => env('SEARCH_TEST_CUSTOMER_DATASET_SIZE', 10000),
            'orders' => env('SEARCH_TEST_ORDER_DATASET_SIZE', 50000),
            'shipments' => env('SEARCH_TEST_SHIPMENT_DATASET_SIZE', 75000),
        ],
        'test_scenarios' => [
            'exact_match' => env('SEARCH_TEST_EXACT_MATCH', true),
            'fuzzy_match' => env('SEARCH_TEST_FUZZY_MATCH', true),
            'partial_match' => env('SEARCH_TEST_PARTIAL_MATCH', true),
            'multilingual' => env('SEARCH_TEST_MULTILINGUAL', false),
            'stress_test' => env('SEARCH_STRESS_TEST', true),
        ]
    ],
];