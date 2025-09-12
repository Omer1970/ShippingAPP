# Story 003: Customer Search and Profile Management
# Environment Setup Requirements

**Story ID:** STORY-003  
**Status:** QA PASS - Ready for Production  
**Document Version:** 1.0  

---

## Overview

This document outlines the complete environment setup requirements for deploying the Story 003 Customer Search and Profile Management features. It covers infrastructure, software dependencies, network configuration, security requirements, and performance baselines.

---

## 1. Infrastructure Requirements

### 1.1 Server Infrastructure

#### Primary Application Servers
```yaml
# Minimum Requirements
specifications:
  web_server:
    cpu: "4 cores (Intel Xeon or AMD EPYC)"
    memory: "8GB RAM"
    storage: "100GB SSD (with 20GB free)"
    network: "1Gbps dedicated bandwidth"
    
  database_server:
    cpu: "4 cores (Intel Xeon or AMD EPYC)"  
    memory: "16GB RAM"
    storage: "200GB SSD (with 50GB free)"
    network: "1Gbps dedicated bandwidth"
    
  cache_server:
    cpu: "2 cores"
    memory: "8GB RAM"
    storage: "50GB SSD"
    network: "1Gbps dedicated bandwidth"
    
# Recommended Production Specifications
production_recommendations:
  web_server:
    cpu: "8 cores"
    memory: "16GB RAM"
    storage: "200GB NVMe SSD"
    network: "10Gbps dedicated bandwidth"
    
  database_server:
    cpu: "8 cores"
    memory: "32GB RAM"
    storage: "500GB NVMe SSD"
    network: "10Gbps dedicated bandwidth"
    raid: "RAID 10 for redundancy"
```

#### Load Balancing & High Availability
```yaml
load_balancer:
  type: "HAProxy or Nginx Plus"
  configuration:
    - "Round-robin distribution"
    - "Health check every 5 seconds"
    - "Automatic failover"
    - "SSL termination"
    - "Rate limiting enabled"

high_availability:
  web_servers: "Minimum 2x (Active-Passive or Active-Active)"
  database: "Master-Slave replication required"
  cache_cluster: "Redis Cluster with 3+ nodes"
  backup_storage: "Off-site backup daily"
```

### 1.2 Operating System Requirements

#### Supported Operating Systems
```bash
# Ubuntu Server 20.04 LTS or 22.04 LTS (Recommended)
# CentOS 8 or Rocky Linux 8
# Red Hat Enterprise Linux 8+
# Amazon Linux 2

# System Updates
sudo apt update && sudo apt upgrade -y  # Ubuntu/Debian
sudo yum update -y                       # CentOS/RHEL

# Required Packages
sudo apt install -y curl wget git nano vim htop iotop netstat unzip zip
sudo apt install -y supervisor nginx mysql-client redis-tools
```

#### System Optimization
```bash
# Increase system limits for web applications
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* soft nproc 32768" | sudo tee -a /etc/security/limits.conf
echo "* hard nproc 32768" | sudo tee -a /etc/security/limits.conf

# TCP/IP optimizations
echo "net.core.somaxconn = 65535" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.ip_local_port_range = 1024 65535" | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

---

## 2. Software Dependencies

### 2.1 Backend Dependencies (Laravel)

#### PHP Requirements
```bash
# PHP Version: 8.1+ (PHP 8.2 recommended)
php -v  # Should show PHP 8.1.0+

# Required PHP Extensions
sudo apt install -y php8.2-fpm php8.2-mysql php8.2-redis php8.2-pgsql
sudo apt install -y php8.2-gd php8.2-zip php8.2-xml php8.2-mbstring
sudo apt install -y php8.2-curl php8.2-json php8.2-bcmath php8.2-intl

# Optional Performance Extensions
sudo apt install -y php8.2-opcache php8.2-memcached php8.2-imap
```

#### PHP Configuration
```ini
# /etc/php/8.2/fpm/php.ini
memory_limit = 256M
max_execution_time = 120
max_input_time = 60
post_max_size = 50M
upload_max_filesize = 50M

date.timezone = "UTC"

# OPcache settings
opcache.enable = 1
opcache.memory_consumption = 128
opcache.max_accelerated_files = 20000
opcache.revalidate_freq = 60
```

#### Composer
```bash
# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer
composer --version  # Should show version 2.x
```

### 2.2 Frontend Dependencies (Angular)

#### Node.js Requirements
```bash
# Node.js Version: 18.x LTS (required for Angular 16+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v  # Should show v18.x.x
npm -v   # Should show 9.x.x
```

#### Angular CLI
```bash
# Install Angular CLI globally
sudo npm install -g @angular/cli
ng version  # Should show Angular CLI 16.x

# Install Angular Material
npm install @angular/material @angular/cdk
```

### 2.3 Database Systems

#### MySQL Server
```bash
# Install MySQL 8.0
sudo apt update
sudo apt install -y mysql-server-8.0

# Configure MySQL
sudo mysql_secure_installation

# Verify installation
mysql --version  # Should show 8.0.x
```

#### MySQL Configuration
```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]

# Basic Settings
default_storage_engine = InnoDB
sql_mode = NO_ENGINE_SUBSTITUTION,STRICT_TRANS_TABLES

# Connection Settings
max_connections = 200
max_user_connections = 50
wait_timeout = 600
interactive_timeout = 600

# Memory Settings  
key_buffer_size = 256M
innodb_buffer_pool_size = 1G
innodb_log_buffer_size = 64M
innodb_log_file_size = 256M

# Performance Settings
query_cache_type = 1
query_cache_size = 64M
query_cache_limit = 2M
max_query_cache_size = 128M

# FULLTEXT Search
ft_min_word_len = 2
innodb_ft_min_token_size = 2
```

#### PostgreSQL (For Dolibarr ERP)
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib postgresql-client

# Configure PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Verify version
psql --version  # Should show 13+ or 14+
```

### 2.4 Cache & Session Storage

#### Redis Server
```bash
# Install Redis
sudo apt update
sudo apt install -y redis-server

# Configure Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

redis-server --version  # Should show 6.0+
```

#### Redis Configuration
```bash
# /etc/redis/redis.conf
# Uncomment and modify these settings:

maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

timeout 300
tcp-keepalive 300
```

### 2.5 Web Server

#### Nginx
```bash
# Install Nginx
sudo apt update
sudo apt install -y nginx

# Verify installation  
nginx -v  # Should show 1.20+
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 3. Network & Security Configuration

### 3.1 Firewall Configuration

#### UFW (Ubuntu Firewall)
```bash
# Enable firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow necessary ports
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 3306/tcp   # MySQL (if connecting from application servers)
sudo ufw allow 6379/tcp   # Redis (if connecting from application servers)

# Check status
sudo ufw status verbose
```

#### Cloud Provider Security Groups
```yaml
# For AWS/EC2 Security Groups  
inbound_rules:
  - port: 22     source: "0.0.0.0/0"     protocol: tcp   # SSH access   
  - port: 80     source: "0.0.0.0/0"     protocol: tcp   # HTTP traffic
  - port: 443    source: "0.0.0.0/0"     protocol: tcp   # HTTPS traffic
  - port: 3306   source: "10.0.0.0/16"   protocol: tcp   # MySQL (private subnet)
  - port: 6379   source: "10.0.0.0/16"   protocol: tcp   # Redis (private subnet)

outbound_rules:
  - port: all   destination: "0.0.0.0/0"  protocol: all   # Allow all outbound
```

### 3.2 SSL/TLS Certificate Setup

#### Let's Encrypt SSL
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d api.shipmentapp.com -d shipmentapp.com

# Enable auto-renewal
sudo systemctl enable certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

#### SSL Configuration
```nginx
# /etc/nginx/sites-available/shipmentapp
server {
    listen 443 ssl http2;
    server_name api.shipmentapp.com;
    
    ssl_certificate /etc/letsencrypt/live/api.shipmentapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.shipmentapp.com/privkey.pem;
    
    # SSL Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Pass to PHP-FPM
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

### 3.3 API Rate Limiting

#### Nginx Rate Limiting
```nginx
# In /etc/nginx/nginx.conf
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=120r/m;
limit_req_zone $binary_remote_addr zone=search_limit:10m rate=60r/m;

server {
    # Apply rate limiting to API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req zone=search_limit burst=10 nodelay;
        
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 4. Application-Specific Requirements

### 4.1 Laravel Application Configuration

#### Directory Structure
```bash
# Set up application directory
sudo mkdir -p /var/www/shipmentapp
cd /var/www/shipmentapp
git clone your-repository.git backend/

# Set permissions
sudo chown -R www-data:www-data /var/www/shipmentapp
sudo chmod -R 755 /var/www/shipmentapp/backend
sudo chmod -R 775 /var/www/shipmentapp/backend/storage
sudo chmod -R 775 /var/www/shipmentapp/bootstrap/cache
```

#### Environment Configuration
```bash
# Copy and configure environment file
cp .env.example .env.production

# Generate application key
php artisan key:generate --env=production

# Set production environment
php artisan config:cache --env=production
php artisan route:cache --env=production
php artisan view:cache --env=production
```

### 4.2 Angular Frontend Build

#### Build Configuration
```bash
# Frontend build setup
cd frontend
npm install

# Production build
npm run build:production

# Copy to web directory
sudo cp -r dist/* /var/www/shipmentapp/public/
sudo chown -R www-data:www-data /var/www/shipmentapp/public
```

### 4.3 Database Migrations

#### Migration Steps
```bash
# Run database migrations
cd /var/www/shipmentapp/backend
php artisan migrate --force

# Seed database (if needed)
php artisan db:seed --force

# Build search indexes
php artisan scout:import "App\Models\Customer"
```

---

## 5. Performance Optimization

### 5.1 Application Server Optimization

#### PHP-FPM Configuration
```ini
# /etc/php/8.2/fpm/pool.d/www.conf
[www]
user = www-data
group = www-data
listen = /var/run/php/php8.2-fpm.sock
listen.owner = www-data
listen.group = www-data

pm = dynamic
pm.max_children = 50
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 20
pm.max_requests = 1000

; Performance settings
pm.process_idle_timeout = 10s
request_terminate_timeout = 120s

; Child process environment
env[HOSTNAME] = $HOSTNAME
env[PATH] = /usr/local/bin:/usr/bin:/bin
env[TMP] = /tmp
env[TMPDIR] = /tmp
env[TEMP] = /tmp
```

#### Nginx Performance
```nginx
# Performance optimizations
worker_processes auto;
worker_connections 10240;
use epoll;

http {
    # Caching
    open_file_cache max=200000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Static file serving
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 30;
    
    # Large client headers
    large_client_header_buffers 4 32k;
    client_max_body_size 50M;
}
```

### 5.2 Database Performance

#### MySQL Performance Optimization
```sql
-- Search index optimization
CREATE INDEX idx_customer_name ON customers(name);
CREATE INDEX idx_customer_email ON customers(email);
CREATE INDEX idx_customer_type ON customers(customer_type);
CREATE INDEX idx_customer_credit_status ON customers(credit_status);

-- Full-text search indexes
ALTER TABLE customers ADD FULLTEXT fulltext_search (name, email, search_vector);
ALTER TABLE customer_search_indices ADD FULLTEXT search_terms_index (search_terms);

-- Query cache optimization
SET GLOBAL query_cache_size = 67108864;  -- 64MB
SET GLOBAL query_cache_limit = 2097152;  -- 2MB
```

---

## 6. Monitoring & Logging Requirements

### 6.1 Logging Configuration

#### Laravel Logging
```bash
# Configure logging in .env.production
LOG_CHANNEL=daily
LOG_LEVEL=info
LOG_SLACK_WEBHOOK_URL=your_slack_webhook
```

#### Nginx Logging
```nginx
# Enhanced logging
access_log /var/log/nginx/shipmentapp.access.log combined;
error_log /var/log/nginx/shipmentapp.error.log warn;

# Custom log format for API requests
log_format api_log '$remote_addr - $remote_user [$time_local] '
                   '"$request" $status $body_bytes_sent '
                   '"$http_referer" "$http_user_agent" '
                   '$request_time $upstream_response_time';
```

### 6.2 Monitoring Tools

#### Server Monitoring
```bash
# Install monitoring tools
sudo apt install -y netdata nagios-nrpe-server

# Start monitoring services
sudo systemctl enable --now netdata
sudo systemctl enable --now nagios-nrpe-server
```

#### Application Monitoring
```bash
# Install New Relic/Datadog agents (optional)
wget -O - https://download.newrelic.com/548C16BF.gpg | sudo apt-key add -
echo "deb https://apt.newrelic.com/debian/ newrelic non-free" | sudo tee -a /etc/apt/sources.list.d/newrelic.list
sudo apt update
sudo apt install -y newrelic-php5
```

---

## 7. Security Requirements

### 7.1 SSL/TLS Requirements
- **Minimum TLS Version:** 1.2
- **Recommended:** TLS 1.3
- **Certificate Authority:** Let's Encrypt (recommended) or commercial CA
- **Certificate Validity:** Maximum 90 days (Let's Encrypt) or 1 year (commercial)
- **Key Length:** RSA 2048-bit minimum or ECDSA 256-bit

### 7.2 Access Control
```bash
# User access restrictions
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG www-data deploy
sudo chown -R deploy:www-data /var/www/shipmentapp

# SSH key-based authentication only (disable password authentication)
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### 7.3 Application Security
- **Authentication:** Laravel Sanctum with expiration tokens
- **API Rate Limiting:** 120 requests/minute for autocomplete, 60 requests/minute for search
- **Input Validation:** All search queries sanitized
- **SQL Injection Prevention:** Prepared statements and ORM validation
- **XSS Prevention:** Output escaping in Laravel Blade templates

---

## 8. Performance Targets

### 8.1 Response Time Targets
```yaml
performance_targets:
  autocomplete_response:
    target: "<200ms"
    max_acceptable: "500ms"
    percentile: "95th"
    
  customer_search_response:
    target: "<500ms"
    max_acceptable: "1000ms"
    percentile: "95th"
    
  customer_profile_load:
    target: "<1000ms"
    max_acceptable: "2000ms"
    percentile: "95th"
    
  cache_hit_rate:
    target: ">85%"
    min_acceptable: "75%"
```

### 8.2 Infrastructure Performance
```yaml
infrastructure_targets:
  availability: ">99.9%"
  concurrent_users: "1000+"
  requests_per_second: "100+"
  uptime: "24/7 operations"
  disaster_recovery: "<1 hour RTO, <15 minutes RPO"
```

---

## 9. Integration Requirements

### 9.1 Dolibarr ERP Integration
```bash
# PostgreSQL connection requirements
host: "dolibarr-db.internal"  # Private network
port: "5432"
database: "dolibarr"
username: "readonly_user"
ssl_mode: "require"

# Required permissions
SELECT ON: llx_societe, llx_socpeople, llx_societe_address
SELECT ON: llx_categorie_societe, llx_cond_reglement
```

### 9.2 Redis Cache Configuration
```yaml
redis_configuration:
  driver: "predis"  # or "phpredis"
  persistent_connection: true
  timeout: "30"
  retry_interval: "10"
  
cache_limits:
  ttl_autocomplete: "300"        # 5 minutes
  ttl_search_results: "300"       # 5 minutes  
  ttl_customer_profile: "1800"    # 30 minutes
  ttl_orders_history: "900"       # 15 minutes
```

---

## 10. Backup & Recovery

### 10.1 Database Backup
```bash
# Automated backup script
#!/bin/bash
# /opt/backup/database-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/database"

# MySQL backup
mysqldump -u root -p production_database > "$BACKUP_DIR/shipmentapp_$DATE.sql"

# PostgreSQL backup (Dolibarr)
pgs_dump -U readonly_user dolibarr > "$BACKUP_DIR/dolibarr_$DATE.sql"

# Redis backup  
redis-cli SAVE > "$BACKUP_DIR/redis_$DATE.rdb"

# Cleanup (keep 7 days)
find "$BACKUP_DIR" -name "*.sql" -type f -mtime +7 -delete
```

### 10.2 Application Backup
```bash
# Application files backup
rsync -avz --delete /var/www/shipmentapp /backup/application/

# Configuration backup
cp -r /etc/nginx /backup/configs/
cp -r /etc/redis /backup/configs/
cp /etc/mysql/mysql.conf.d/mysqld.cnf /backup/configs/
```

---

## 11. Compliance & Security Audit

### 11.1 Security Checklist
- [ ] SSL/TLS certificates installed and valid
- [ ] Firewall rules configured and tested
- [ ] Rate limiting implemented on API endpoints
- [ ] Authentication working (Sanctum tokens)
- [ ] Input validation active on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS prevention measures in place
- [ ] Access logs configured and active
- [ ] Error monitoring in place
- [ ] Security headers configured

### 11.2 Performance Audit
- [ ] Response time targets achieved
- [ ] Database indexes optimized
- [ ] Cache hit rates monitored
- [ ] Memory usage within limits
- [ ] CPU utilization acceptable
- [ ] Disk I/O performance verified
- [ ] Network throughput sufficient

---

## 12. Deployment Verification

### 12.1 Pre-Deployment Checklist
```bash
# Run comprehensive system checks
./scripts/check-system-requirements.sh
./scripts/check-dependencies.sh
./scripts/check-permissions.sh
./scripts/check-network-connectivity.sh
./scripts/test-database-connectivity.sh
```

### 12.2 Post-Deployment Validation
```bash
# Execute validation scripts
./scripts/validate-api-health.sh
./scripts/validate-performance.sh
./scripts/validate-security.sh
./scripts/validate-functionality.sh
```

---

## 13. Support & Maintenance

### 13.1 Monitoring Setup
```bash
# Install monitoring agents
curl -L -O https://assets.monitor.sh/install-monitoring.sh
sudo bash install-monitoring.sh --app-token YOUR_TOKEN

# Configure alerting
export ALERT_WEBHOOK_URL="https://hooks.slack.com/your-webhook"
export ALERT_EMAIL="ops@shipmentapp.com"
```

### 13.2 Update Strategy
```yaml
update_schedule:
  security_updates: "Immediate (automated)"
  minor_updates: "Weekly review, monthly deployment"
  major_updates: "Quarterly planning with notification"
  
maintenance_windows:
  planned: "Sundays 2:00 AM - 6:00 AM UTC"
  emergency: "30 minutes advance notice"
  rollback_time: "<1 hour"
```

---

## Environment Setup Command Summary

### Quick Setup Commands
```bash
# Clone the complete setup script
curl -sSL https://your-repo.com/setup-environment.sh | bash

# Or step-by-step setup
sudo bash setup-system.sh
sudo bash install-dependencies.sh
sudo bash configure-services.sh
sudo bash setup-security.sh
sudo bash deploy-application.sh
sudo bash run-tests.sh
```

### Manual Quick Commands
```bash
# System preparation (5 minutes)
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nginx mysql-server redis-server php8.2-fpm
```

---

**Important:** This environment setup should be completed **before** deploying Story 003. All systems must be properly configured and tested before proceeding with the application deployment.

**Certification:** Complete all validation scripts in POST-DEPLOYMENT-VALIDATION.md to ensure your environment meets all requirements for Story 003 deployment success.