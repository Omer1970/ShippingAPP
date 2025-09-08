# ShipmentApp Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the ShipmentApp authentication system in a production environment. The deployment includes the Laravel backend API, Angular frontend, database, and supporting infrastructure.

## Prerequisites

### System Requirements

- **Server**: Ubuntu 20.04+ or CentOS 8+
- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB minimum (50GB recommended)
- **Network**: Public IP with ports 80, 443, 22 access

### Software Requirements

- Docker 20.10+
- Docker Compose 1.29+
- Git 2.25+
- SSL Certificate (Let's Encrypt or commercial)

### Domain Requirements

- Primary domain (e.g., shipmentapp.com)
- API subdomain (e.g., api.shipmentapp.com)
- Valid SSL certificates for all domains

## Deployment Architecture

```
┌─────────────────┐
│   CloudFlare    │
│   (CDN/DNS)     │
└────────┬────────┘
         │
┌────────▼────────┐
│   Nginx Proxy   │
│   (SSL/Load)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼───┐
│Angular│ │Laravel│
│Frontend│ │ API   │
└───┬───┘ └──┬───┘
    │        │
    │   ┌────▼────┐
    └───┤PostgreSQL│
        │Database │
        └─────────┘
```

## Step 1: Server Setup

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw software-properties-common
```

### 1.2 Create Deployment User

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo su - deploy
```

### 1.3 Configure Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 2: Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install Docker
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker deploy
```

## Step 3: Application Setup

### 3.1 Clone Repository

```bash
cd /home/deploy
git clone https://github.com/your-org/shipmentapp.git
cd shipmentapp
```

### 3.2 Configure Environment Variables

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Generate application key
docker run --rm -v $(pwd)/backend:/app composer:latest bash -c "cd /app && php artisan key:generate --show"

# Edit .env file with your production values
nano backend/.env
```

### 3.3 Environment Variables Configuration

Edit `backend/.env` with production values:

```env
# Application
APP_NAME=ShipmentApp
APP_ENV=production
APP_KEY=base64:your-generated-key-here
APP_DEBUG=false
APP_URL=https://api.shipmentapp.com

# Database
DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=shipmentapp
DB_USERNAME=shipmentapp
DB_PASSWORD=your-secure-password

# Sanctum
SANCTUM_STATEFUL_DOMAINS=shipmentapp.com,www.shipmentapp.com
SESSION_DOMAIN=.shipmentapp.com

# Cache & Session
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

# Redis
REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379

# Mail Configuration
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=noreply@shipmentapp.com
MAIL_PASSWORD=your-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@shipmentapp.com
MAIL_FROM_NAME="${APP_NAME}"

# Security
AUTH_RATE_LIMIT=60
SESSION_LIFETIME=120

# Logging
LOG_CHANNEL=stack
LOG_LEVEL=info
```

## Step 4: SSL Certificate Setup

### 4.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 4.2 Generate SSL Certificates

```bash
# Generate certificates
sudo certbot certonly --standalone -d shipmentapp.com -d www.shipmentapp.com -d api.shipmentapp.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Step 5: Database Setup

### 5.1 Create Database Directory

```bash
mkdir -p /home/deploy/shipmentapp/database
sudo chown -R 999:999 /home/deploy/shipmentapp/database
```

### 5.2 Database Backup Script

Create `/home/deploy/backup-database.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="shipmentapp_db_1"

docker exec $CONTAINER_NAME pg_dump -U shipmentapp shipmentapp > "$BACKUP_DIR/db_backup_$DATE.sql"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
```

```bash
chmod +x /home/deploy/backup-database.sh
mkdir -p /home/deploy/backups
```

### 5.3 Set Up Cron for Backups

```bash
# Daily backup at 2 AM
0 2 * * * /home/deploy/backup-database.sh
```

## Step 6: Application Deployment

### 6.1 Build and Start Services

```bash
cd /home/deploy/shipmentapp

# Build and start services
docker-compose up -d --build

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 6.2 Run Database Migrations

```bash
# Run migrations
docker-compose exec backend php artisan migrate --force

# Seed database (if needed)
docker-compose exec backend php artisan db:seed --force
```

### 6.3 Set Up Laravel Scheduler

```bash
# Add to crontab
crontab -e

# Add line:
* * * * * docker exec shipmentapp_backend_1 php artisan schedule:run >> /dev/null 2>&1
```

## Step 7: Monitoring and Logging

### 7.1 Set Up Log Rotation

Create `/etc/logrotate.d/shipmentapp`:

```
/home/deploy/shipmentapp/storage/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        docker-compose exec backend kill -USR1 $(cat /var/run/php-fpm.pid)
    endscript
}
```

### 7.2 Install Monitoring Tools

```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Install Node Exporter for Prometheus
wget https://github.com/prometheus/node_exporter/releases/download/v1.3.1/node_exporter-1.3.1.linux-amd64.tar.gz
tar xvf node_exporter-1.3.1.linux-amd64.tar.gz
sudo cp node_exporter-1.3.1.linux-amd64/node_exporter /usr/local/bin/

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

## Step 8: Security Hardening

### 8.1 Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 8.2 Set Up Fail2Ban

```bash
sudo apt install -y fail2ban

# Configure Fail2Ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 8.3 Configure UFW Rules

```bash
# Deny all incoming by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow specific ports
sudo ufw allow from any to any port 22 proto tcp
sudo ufw allow from any to any port 80 proto tcp
sudo ufw allow from any to any port 443 proto tcp

# Enable firewall
sudo ufw enable
```

## Step 9: Performance Optimization

### 9.1 PHP-FPM Optimization

Edit PHP-FPM configuration:

```bash
# Edit PHP-FPM pool configuration
docker-compose exec backend bash -c "
cat > /usr/local/etc/php-fpm.d/www.conf <<EOF
[www]
user = www-data
group = www-data
listen = 9000

pm = dynamic
pm.max_children = 50
pm.start_servers = 5
pm.min_spare_servers = 5
pm.max_spare_servers = 35
pm.max_requests = 500

; Logging
access.log = /var/log/php-fpm/access.log
php_admin_flag[log_errors] = on
EOF
"
```

### 9.2 Nginx Optimization

Add to nginx configuration:

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/atom+xml
    image/svg+xml;

# Browser caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## Step 10: Health Checks and Monitoring

### 10.1 Application Health Check

Create health check endpoint monitoring:

```bash
# Add to crontab for health monitoring
*/5 * * * * curl -f https://api.shipmentapp.com/health || echo "API Health Check Failed" | mail -s "ShipmentApp Alert" admin@shipmentapp.com
```

### 10.2 Docker Health Checks

Add health checks to docker-compose.yml:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Step 11: Backup and Recovery

### 11.1 Database Backup Strategy

```bash
# Create backup script
sudo tee /home/deploy/backup-strategy.sh > /dev/null <<EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"

# Database backup
docker-compose exec -T db pg_dump -U shipmentapp shipmentapp > "\$BACKUP_DIR/db_\$DATE.sql"

# Application files backup
tar -czf "\$BACKUP_DIR/app_\$DATE.tar.gz" /home/deploy/shipmentapp

# Keep only last 30 days
find \$BACKUP_DIR -name "*.sql" -mtime +30 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

# Sync to S3 (if configured)
# aws s3 sync \$BACKUP_DIR s3://your-backup-bucket/shipmentapp/
EOF

chmod +x /home/deploy/backup-strategy.sh
```

### 11.2 Recovery Procedures

```bash
# Database recovery
docker-compose exec -T db psql -U shipmentapp < backup_file.sql

# Full application recovery
# 1. Restore application files
# 2. Restore database
# 3. Restart services
docker-compose down
docker-compose up -d
```

## Step 12: Final Verification

### 12.1 Security Checklist

- [ ] SSL certificates installed and auto-renewal configured
- [ ] Firewall configured with minimal required ports
- [ ] Fail2Ban protecting SSH and web services
- [ ] Root login disabled
- [ ] Strong passwords for all accounts
- [ ] Database not accessible from external networks
- [ ] Application running with non-root user
- [ ] Regular backups configured and tested
- [ ] Monitoring and alerting in place
- [ ] Log rotation configured

### 12.2 Performance Checklist

- [ ] PHP-FPM optimized for production load
- [ ] Nginx configured with compression and caching
- [ ] Database indexes optimized
- [ ] CDN configured for static assets
- [ ] Application caching enabled
- [ ] Queue workers configured
- [ ] Database connection pooling

### 12.3 Functionality Tests

```bash
# Test API endpoints
curl -X GET https://api.shipmentapp.com/health
curl -X POST https://api.shipmentapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password","device_name":"test"}'

# Test database connectivity
docker-compose exec backend php artisan tinker
>>> DB::connection()->getPdo();

# Test email functionality
docker-compose exec backend php artisan tinker
>>> Mail::raw('Test email', function ($message) {
...     $message->to('admin@shipmentapp.com')->subject('Test');
... });
```

## Maintenance

### Regular Maintenance Tasks

1. **Daily**: Check application logs and monitoring alerts
2. **Weekly**: Review security logs and failed login attempts
3. **Monthly**: Update system packages and Docker images
4. **Quarterly**: Review and test backup procedures
5. **Annually**: Security audit and penetration testing

### Update Procedures

```bash
# Update application
cd /home/deploy/shipmentapp
git pull origin main
docker-compose build --no-cache
docker-compose up -d

# Update system
sudo apt update && sudo apt upgrade -y
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check database container status
   - Verify environment variables
   - Check network connectivity

2. **SSL Certificate Issues**
   - Verify certificate paths in nginx configuration
   - Check certificate expiration dates
   - Review Certbot renewal logs

3. **Performance Issues**
   - Monitor system resources (CPU, memory, disk)
   - Check application logs for errors
   - Review database query performance

4. **Authentication Issues**
   - Verify Sanctum configuration
   - Check CORS settings
   - Review rate limiting configuration

### Log Locations

- Application logs: `/home/deploy/shipmentapp/backend/storage/logs/`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`
- Docker logs: `docker-compose logs [service-name]`

## Support

For deployment support:
- Check application logs first
- Review system monitoring
- Contact development team with specific error messages
- Include relevant log excerpts in support requests

## Security Notice

This deployment guide provides a baseline security configuration. For production environments:
- Conduct regular security audits
- Keep all software up to date
- Monitor security advisories
- Implement additional security measures as needed
- Consider using a Web Application Firewall (WAF)
- Implement intrusion detection systems (IDS)
- Regular penetration testing is recommended