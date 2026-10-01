# KNEC Digital Assistant WhatsApp Bot

Official backend application foundation for KNEC services, examination registration, verification, and candidate inquiries.

## Project Purpose
The KNEC Digital Assistant is an automated backend foundation designed to deliver verified, authoritative information regarding Kenya National Examinations Council (KNEC) procedures, guidelines, registration timelines, and FAQs.

## Architecture Overview
The application follows a clean layered architecture:

- **Layer 1: Knowledge Base Repository (`src/repository/kbRepository.js`)** — Loads, schema-validates, indexes, and deep-freezes JSON articles in memory on startup.
- **Layer 2: Core Domain Services (`src/services/kbService.js`)** — Business logic abstraction serving knowledge base queries.
- **Layer 3: Express HTTP Server & Middleware (`src/app.js`)** — Centralized environment validation, Winston-style lightweight logging, Helmet security, CORS restrictions, and centralized error handling.

## Directory Structure
Set-Content -Path "src\config\index.js" -Value @'
...
