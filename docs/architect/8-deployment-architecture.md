# 8. Deployment Architecture

## 8.1 Infrastructure Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   CDN/CloudFlare│    │   SSL Termination│
│   (Nginx/HAProxy)│    │   (Static Assets)│    │   (Let's Encrypt) │
└─────────┬───────┘    └─────────────────┘    └─────────────────┘
          │
┌─────────▼───────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Server 1  │    │   Web Server 2  │    │   Web Server N  │
│   (Nginx+PHP-FPM)│    │   (Nginx+PHP-FPM)│    │   (Nginx+PHP-FPM)│
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
┌─────────▼───────┐    ┌─────────▼───────┐    ┌─────────▼───────┐
│   MySQL Master │    │   Redis Cluster │    │   File Storage  │
│   (Primary DB)  │    │   (Cache/Queue) │    │   (S3/Local)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │
┌─────────▼───────┐
│   MySQL Slave   │
│   (Read Replica)│
└─────────────────┘
```

## 8.2 Environment Configurations

### 8.2.1 Production Environment
```bash
# .env.production
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.shipmentapp.com

DB_CONNECTION=mysql
DB_HOST=mysql-master.internal
DB_PORT=3306
DB_DATABASE=shipmentapp
DB_USERNAME=app_user
DB_PASSWORD=secure_password

REDIS_HOST=redis-cluster.internal
REDIS_PASSWORD=redis_password
REDIS_PORT=6379

DOLIBARR_DB_HOST=dolibarr-db.internal
DOLIBARR_DB_DATABASE=dolibarr
DOLIBARR_DB_USERNAME=readonly_user
DOLIBARR_DB_PASSWORD=readonly_password

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=shipmentapp-files
```

### 8.2.2 Docker Configuration
```dockerfile
# Dockerfile
FROM php:8.1-fpm-alpine

# Install dependencies
RUN apk add --no-cache     nginx     supervisor     mysql-client     redis

# Install PHP extensions
RUN docker-php-ext-install     pdo_mysql     redis     gd     zip

# Copy application
COPY . /var/www/html
WORKDIR /var/www/html

# Install Composer dependencies
RUN composer install --no-dev --optimize-autoloader

# Set permissions
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

## 8.3 Deployment Pipeline

### 8.3.1 CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.1
      - name: Install dependencies
        run: composer install
      - name: Run tests
        run: php artisan test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh user@server 'cd /var/www/html && git pull'
          ssh user@server 'cd /var/www/html && composer install --no-dev'
          ssh user@server 'cd /var/www/html && php artisan migrate --force'
          ssh user@server 'cd /var/www/html && php artisan config:cache'
          ssh user@server 'sudo systemctl reload nginx'
```

---
