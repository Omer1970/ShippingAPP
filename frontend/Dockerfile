# Multi-stage build for Angular application

# Stage 1: Build the Angular application
FROM node:18-alpine as build

# Set working directory
WORKDIR /app

# Install global Angular CLI
RUN npm install -g @angular/cli@latest

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the application for production
RUN npm run build -- --configuration production --output-path=dist

# Stage 2: Production server with nginx
FROM nginx:alpine as production

# Install additional packages for security and monitoring
RUN apk add --no-cache \
    curl \
    openssl \
    && rm -rf /var/cache/apk/*

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Create custom error pages
RUN echo '<html><head><title>Maintenance</title></head><body><h1>Service Temporarily Unavailable</h1><p>The service is temporarily unavailable. Please try again later.</p></body></html>' > /usr/share/nginx/html/maintenance.html

# Create nginx cache directory
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginx && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chmod -R 755 /var/cache/nginx

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/app.conf /etc/nginx/conf.d/app.conf

# Add security headers and optimizations
RUN { \
    echo 'server_tokens off;'; \
    echo 'client_max_body_size 20m;'; \
    echo 'client_body_timeout 12;'; \
    echo 'client_header_timeout 12;'; \
    echo 'keepalive_timeout 15;'; \
    echo 'send_timeout 10;'; \
} > /etc/nginx/conf.d/security.conf

# Health check script
COPY docker/healthcheck.sh /usr/local/bin/healthcheck
RUN chmod +x /usr/local/bin/healthcheck

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck || exit 1

# Use non-root user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Stage 3: Development server
FROM node:18-alpine as development

# Set working directory
WORKDIR /app

# Install global Angular CLI
RUN npm install -g @angular/cli@latest

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Expose port for development server
EXPOSE 4200

# Start development server
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--disable-host-check"]

# Stage 4: Testing
FROM node:18-alpine as testing

# Set working directory
WORKDIR /app

# Install Chrome for headless testing
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Run tests
RUN npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage
RUN npm run e2e

# Generate test reports
RUN npm run test:ci

# Stage 5: Lightweight production image
FROM nginx:alpine as lightweight-production

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built Angular app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/lightweight.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]