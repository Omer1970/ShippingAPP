# 1. System Architecture Overview

## 1.1 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │   Web Browsers  │    │   Tablets       │
│   (iOS/Android) │    │   (Chrome/Safari│    │   (iPad/Android)│
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼───────────────┐
                    │     Angular PWA Frontend    │
                    │   (Service Worker, Cache)   │
                    └─────────────┬───────────────┘
                                  │ HTTPS/REST API
                    ┌─────────────▼───────────────┐
                    │      Laravel Backend        │
                    │  (API, Auth, Business Logic)│
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │      Redis Cache/Queue      │
                    │   (Session, Jobs, Cache)    │
                    └─────────────┬───────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼───────────┐ ┌─────────▼───────────┐ ┌─────────▼───────────┐
│   MySQL Database    │ │   File Storage      │ │   Dolibarr ERP      │
│ (App Data, Users)   │ │ (Signatures, Docs)  │ │ (Orders, Customers) │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

## 1.2 Technology Stack

### 1.2.1 Frontend Stack
- **Framework:** Angular 16+ with TypeScript
- **UI Library:** Angular Material + Custom Components
- **PWA:** Service Workers, Web App Manifest
- **State Management:** NgRx (for complex state)
- **HTTP Client:** Angular HttpClient with interceptors
- **Build Tool:** Angular CLI with Webpack

### 1.2.2 Backend Stack
- **Framework:** Laravel 10+ with PHP 8.1+
- **API:** RESTful APIs with JSON responses
- **Authentication:** Laravel Sanctum (SPA authentication)
- **Queue System:** Redis with Laravel Horizon
- **Caching:** Redis for application cache
- **File Storage:** Laravel Storage with S3/local disk

### 1.2.3 Database & Storage
- **Primary Database:** MySQL 8.0+
- **Cache/Sessions:** Redis 6.0+
- **File Storage:** AWS S3 or local storage
- **ERP Database:** Dolibarr MySQL (read-only access)

### 1.2.4 Infrastructure
- **Web Server:** Nginx with PHP-FPM
- **Process Manager:** Supervisor for queue workers
- **SSL/TLS:** Let's Encrypt or commercial certificates
- **Monitoring:** Laravel Telescope + custom logging

---
