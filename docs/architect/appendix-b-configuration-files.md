# Appendix B: Configuration Files

## Laravel Configuration
```php
// config/database.php - Dolibarr Connection
'dolibarr' => [
    'driver' => 'mysql',
    'host' => env('DOLIBARR_DB_HOST', '127.0.0.1'),
    'port' => env('DOLIBARR_DB_PORT', '3306'),
    'database' => env('DOLIBARR_DB_DATABASE', 'dolibarr'),
    'username' => env('DOLIBARR_DB_USERNAME', 'readonly'),
    'password' => env('DOLIBARR_DB_PASSWORD', ''),
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix' => '',
    'strict' => true,
    'engine' => null,
    'options' => [
        PDO::ATTR_TIMEOUT => 5,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ],
],
```

---

**Document Prepared By:** Alex - System Architect  
**Review Status:** Ready for Development Team Review  
**Next Steps:** Begin Phase 1 implementation with backend foundation  

---
*This technical architecture document provides comprehensive guidance for implementing ShipmentApp with scalable, secure, and maintainable code. All architectural decisions are based on industry best practices and optimized for the specific requirements outlined in the PRD.*
