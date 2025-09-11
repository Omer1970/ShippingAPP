# ShipmentApp Essential Commands

## Development Environment (Docker)

### System Management
```bash
# Start all services (backend, frontend, db, redis)
docker-compose up -d

# Start with build (fresh builds)
docker-compose up -d --build

# Stop all services
docker-compose down

# View running services
docker-compose ps

# View logs
docker-compose logs -f [service-name]
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart specific service
docker-compose restart [service-name]
```

## Backend (Laravel) Commands

### Database Operations
```bash
# Run database migrations
docker-compose exec backend php artisan migrate

# Rollback migrations
docker-compose exec backend php artisan migrate:rollback

# Fresh migration (drop all, recreate)
docker-compose exec backend php artisan migrate:fresh

# Seed the database
docker-compose exec backend php artisan db:seed

# Create new migration
docker-compose exec backend php artisan make:migration create_table_name

# Reset migrations and re-run
docker-compose exec backend php artisan migrate:refresh
```

### Testing
```bash
# Run all tests
docker-compose exec backend php artisan test

# Run specific test
docker-compose exec backend php artisan test tests/Feature/AuthTest.php

# Run with coverage
docker-compose exec backend php artisan test --coverage
```

### Cache and Optimization
```bash
# Clear all caches
docker-compose exec backend php artisan cache:clear
docker-compose exec backend php artisan config:clear
docker-compose exec backend php artisan route:clear
docker-compose exec backend php artisan view:clear

# Warm cache (production)
docker-compose exec backend php artisan config:cache
docker-compose exec backend php artisan route:cache
docker-compose exec backend php artisan view:cache
```

### Application Key
```bash
# Generate new app key
docker-compose exec backend php artisan key:generate

# Show current key
docker-compose exec backend php artisan key:generate --show
```

## Frontend (Angular) Commands

### Development
```bash
# Install dependencies
cd frontend && npm install

# Start development server
cd frontend && npm start

# Build for development
cd frontend && npm run build

# Build for production
cd frontend && npm run build --configuration production
```

### Testing
```bash
# Run unit tests
cd frontend && npm test

# Run tests in watch mode
cd frontend && npm run test -- --watch

# Run e2e tests
cd frontend && npm run e2e

# Run specific e2e tests
cd frontend && npm run e2e:auth
cd frontend && npm run e2e:security
cd frontend && npm run e2e:integration
```

### Code Generation
```bash
# Generate new component
cd frontend && ng generate component component-name

# Generate new service
cd frontend && ng generate service service-name

# Generate new module
cd frontend && ng generate module module-name

# Show all available generators
cd frontend && ng generate --help
```

## Database Commands

### PostgreSQL
```bash
# Connect to database
docker-compose exec db psql -U shipmentapp -d shipmentapp

# Backup database
docker-compose exec db pg_dump -U shipmentapp shipmentapp > backup.sql

# Restore database
docker-compose exec -T db psql -U shipmentapp -d shipmentapp < backup.sql

# List databases
psql -U shipmentapp -l

# List tables
psql -U shipmentapp -d shipmentapp -c "\dt"
```

### Redis
```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Flush all data
docker-compose exec redis redis-cli FLUSHALL

# Check connection status
docker-compose exec redis redis-cli PING
```

## Git Workflow

```bash
# Check status
git status

# Add files
git add .
git add -p  # interactive staging

# Commit changes
git commit -m "Descriptive commit message"

# Push to repository
git push origin main

# Pull latest changes
git pull origin main

# View recent commits
git log --oneline -10

# Check branch
git branch
git branch -a  # show all branches
```

## Docker System Maintenance

```bash
# Clean up unused containers
docker container prune

# Clean up unused images
docker image prune -a

# Clean up unused volumes (CAREFUL - may delete data)
docker volume prune

# Clean up everything (USE WITH CAUTION)
docker system prune -a

# Check disk usage
docker system df

# View running containers
docker ps

# View all containers
docker ps -a
```

## File System Navigation

```bash
# List files
docker-compose exec backend ls -la

# Check file contents from outside container
cat backend/storage/logs/laravel.log

# Copy files from container
docker cp container_name:/path/in/container /local/path

# Copy files to container
docker cp /local/path container_name:/path/in/container
```

## Common Troubleshooting

```bash
# Check backend health
curl http://localhost:8080/health

# Test API connectivity
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password","device_name":"test"}'

# Check database connection
docker-compose exec backend php artisan tinker
>>> DB::connection()->getPdo();

# Check redis connection
docker-compose exec redis redis-cli ping
```

## Performance Monitoring

```bash
# Check container resource usage
docker stats

# Monitor logs for errors
docker-compose logs --tail=100 -f backend | grep "ERROR"

# Check database performance
docker-compose exec db psql -U shipmentapp -c "SELECT * FROM pg_stat_activity;"

# Redis memory usage
docker-compose exec redis redis-cli info memory
```