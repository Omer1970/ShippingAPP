# ShipmentApp Project Overview

## Project Description
ShipmentApp is a full-stack web application for managing shipments and orders, built with Laravel backend API and Angular frontend. The application integrates with Dolibarr ERP system and provides user authentication, shipment tracking, and order management capabilities.

## Tech Stack

### Backend
- **Framework**: Laravel 10.x (PHP 8.1+)
- **Authentication**: Laravel Sanctum (token-based authentication)
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Test Framework**: PHPUnit 10.x

### Frontend
- **Framework**: Angular 20.x
- **Language**: TypeScript
- **Styling**: SCSS
- **Test Framework**: Karma + Jasmine

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Web Server**: Apache (backend), Nginx (frontend)
- **Version Control**: Git

## Key Features
- User authentication with JWT tokens
- Shipment management and tracking
- Order management
- Integration with Dolibarr ERP system
- Real-time data synchronization
- Responsive web interface
- Comprehensive error handling
- Unit and integration testing

## Architecture Overview
The application follows a microservices architecture with separate API and frontend services:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Angular       │───▶|Laravel API     │───▶|PostgreSQL      │
│   Frontend      │    │   Backend       │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │  & Dolibarr     │
                       │  Integration    │
                       └─────────────────┘
```

## Development Workflow
The project supports development with Docker Compose, providing a consistent development environment across all team members.