# SmartMetrix - Backend Foundation

SmartMetrix is a pure software platform for Legal Metrology Verification. This repository contains the backend foundation services.

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB with Mongoose
- **Configuration:** dotenv
- **Middleware:** CORS, Express JSON parser, centralized error handler

## Project Structure

```
backend/
├── src/
│   ├── config/             # Configuration modules (e.g., database connection)
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Custom Express middlewares (error handling, etc.)
│   ├── models/             # Mongoose schemas & models
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic
│   └── utils/              # Helper functions & utilities
├── src/app.ts              # Express application configuration
├── src/server.ts           # Server entrypoint and lifecycle
├── package.json            # Dependencies and npm scripts
├── tsconfig.json           # TypeScript configuration
├── .env.example            # Sample environment variables
├── .gitignore              # Git ignore rules
└── README.md               # Backend documentation
```

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (local instance running on `localhost:27017` or a MongoDB Atlas URI)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and adjust the variables if needed:
```bash
cp .env.example .env
```

Default variables:
- `PORT`: Port on which the server listens (default: `5000`)
- `NODE_ENV`: Environment mode (`development` | `production`)
- `MONGODB_URI`: MongoDB connection string (default: `mongodb://localhost:27017/smartmetrix`)
- `CORS_ORIGIN`: Allowed origins for CORS (default: `*`)
- `JWT_SECRET`: Secret key for JWT signing (required)
- `JWT_EXPIRES_IN`: JWT expiration time (default: `7d`)
- `ADMIN_NAME`: Name for initial seeded Admin
- `ADMIN_EMAIL`: Email for initial seeded Admin
- `ADMIN_PASSWORD`: Secure password for initial seeded Admin

### 4. Admin Bootstrap Seed
To safely create the first ADMIN account using environment variables:
```bash
npm run seed:admin
```

### 5. Running the Server

#### Development Mode (with hot reloading):
```bash
npm run dev
```

#### Production Build & Start:
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
- **Endpoint:** `GET /api/health`
- **Access:** Public
- **Description:** Verifies that the SmartMetrix backend service is active and responsive.

### Authentication & User Management
- **`POST /api/auth/register`** (Public)
  - Registers a new user. Always assigns `OWNER` role (prevents privilege escalation).
  - Body: `{ "name": "...", "email": "...", "password": "..." }`
- **`POST /api/auth/login`** (Public)
  - Authenticates credentials and returns a signed JWT token.
  - Body: `{ "email": "...", "password": "..." }`
- **`POST /api/auth/logout`** (Protected: Any authenticated user)
  - Increments `tokenVersion` on user document, immediately invalidating active JWTs.
- **`GET /api/auth/me`** (Protected: Any authenticated user)
  - Returns authenticated user details.
- **`POST /api/auth/inspector`** (Protected: ADMIN only)
  - Creates an `INSPECTOR` account.
  - Body: `{ "name": "...", "email": "...", "password": "..." }`

### Role-Based Access Control (RBAC) Verification Routes
- **`GET /api/test/owner`** (Protected: OWNER only)
- **`GET /api/test/inspector`** (Protected: INSPECTOR only)
- **`GET /api/test/admin`** (Protected: ADMIN only)

