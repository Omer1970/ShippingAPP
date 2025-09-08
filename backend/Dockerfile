# Multi-stage build for Laravel application
FROM php:8.2-fpm-alpine as base

# Set working directory
WORKDIR /var/www/html

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    zip \
    unzip \
    git \
    sqlite \
    sqlite-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    oniguruma-dev \
    postgresql-dev \
    nodejs \
    npm \
    && rm -rf /var/cache/apk/*

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        pdo_pgsql \
        pgsql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
        opcache \
    && pecl install redis \
    && docker-php-ext-enable redis

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install Laravel Envoy (for deployment tasks)
RUN composer global require laravel/envoy
ENV PATH="/root/.composer/vendor/bin:${PATH}"

# Create system user to run Composer and Artisan Commands
RUN addgroup -g 1000 www && \
    adduser -u 1000 -s /bin/sh --disabled-password -G www www

# Copy existing application directory contents
COPY . /var/www/html

# Set permissions
RUN chown -R www:www /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 777 /var/www/html/storage \
    && chmod -R 777 /var/www/html/bootstrap/cache

# Copy PHP configuration
COPY docker/php/php.ini /usr/local/etc/php/conf.d/app.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Copy nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy supervisor configuration
COPY docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create necessary directories
RUN mkdir -p /var/log/nginx /var/log/php /var/log/supervisor

# Install dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Generate optimized autoloader
RUN composer dump-autoload --optimize

# Clear and cache config
RUN php artisan config:cache || true
RUN php artisan route:cache || true
RUN php artisan view:cache || true

# Build frontend assets (if using Laravel Mix)
# RUN npm install && npm run production

# Expose port 9000 for PHP-FPM
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

# Development stage
FROM base as development

# Install Xdebug for development
RUN pecl install xdebug \
    && docker-php-ext-enable xdebug

# Copy development PHP configuration
COPY docker/php/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini

# Install development dependencies
RUN composer install --optimize-autoloader --no-interaction

# Set development environment
ENV APP_ENV=development
ENV APP_DEBUG=true

# Production stage
FROM base as production

# Remove development packages
RUN apk del --purge git nodejs npm \
    && rm -rf /var/cache/apk/*

# Remove development files
RUN rm -rf /var/www/html/tests \
    /var/www/html/.git \
    /var/www/html/.gitignore \
    /var/www/html/docker \
    /var/www/html/docker-compose.yml \
    /var/www/html/Dockerfile \
    /var/www/html/README.md

# Set production environment
ENV APP_ENV=production
ENV APP_DEBUG=false

# Create non-root user for production
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -s /bin/sh --disabled-password -G appgroup appuser && \
    chown -R appuser:appgroup /var/www/html

USER appuser

# Final optimizations
RUN php artisan config:cache && \
    php artisan route:cache && \
    php artisan view:cache && \
    php artisan event:cache