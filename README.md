# Backend Ledger

Backend Ledger is a REST API for managing users, bank accounts, balances, and money transfers. It records every balance change in an immutable ledger so account balances can always be calculated from transaction history.

## Features

- User registration, login, and logout
- JWT authentication with cookie and Bearer token support
- Token blacklist for logged-out sessions
- Automatic blacklist cleanup using a MongoDB TTL index
- Account creation and account balance lookup
- System-only initial funding for accounts
- Account-to-account transfers
- Idempotency keys to prevent duplicate transfers
- MongoDB transactions for atomic debit and credit operations
- Immutable ledger records for balance auditing
- Registration and transaction email notifications

## Technology Stack

- Node.js
- Express.js
- MongoDB Atlas or MongoDB Community Server
- Mongoose
- JSON Web Tokens (`jsonwebtoken`)
- bcryptjs
- Nodemailer
- cookie-parser
- dotenv

## Project Structure

```text
backendledger/
├── src/
│   ├── config/          # MongoDB connection setup
│   ├── controllers/     # Route business logic
│   ├── middleware/      # JWT and system-user checks
│   ├── models/          # Mongoose schemas and models
│   ├── routes/          # API route definitions
│   ├── services/        # Email service
│   └── app.js           # Express application configuration
├── .env.example         # Safe environment-variable template
├── server.js            # Application entry point
└── package.json
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/parmarramnik/Backend-Ledger.git
cd Backend-Ledger
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment variables

Copy the example file:

```bash
copy .env.example .env
```

For macOS or Linux:

```bash
cp .env.example .env
```

Set these values in `.env`:

```env
MONGO_URI=
JWT_SECRET=
EMAIL_USER=
CLIENT_ID=
CLIENT_SECRET=
REFRESH_TOKEN=
```

Do not commit `.env`. It contains private credentials.

### 4. Start the server

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The server runs at:

```text
http://localhost:3000
```

## Authentication

Login and registration return a JWT token. Send it with protected requests using:

```text
Authorization: Bearer YOUR_TOKEN
```

The API also stores the token in a `token` cookie for browser clients.

## API Reference

### Register a user

```text
POST /api/auth/register
```

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Example User"
}
```

### Login

```text
POST /api/auth/login
```

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Logout

```text
POST /api/auth/logout
Authorization: Bearer YOUR_TOKEN
```

The current token is stored in the blacklist. MongoDB removes the blacklist record automatically after three days.

### Create an account

```text
POST /api/accounts/
Authorization: Bearer YOUR_TOKEN
```

No request body is required.

### List the current user's accounts

```text
GET /api/accounts/
Authorization: Bearer YOUR_TOKEN
```

### Get an account balance

```text
GET /api/accounts/balance/:accountId
Authorization: Bearer YOUR_TOKEN
```

### Transfer funds between accounts

```text
POST /api/transactions/
Authorization: Bearer YOUR_TOKEN
```

```json
{
  "fromAccount": "SOURCE_ACCOUNT_ID",
  "toAccount": "DESTINATION_ACCOUNT_ID",
  "amount": 2000,
  "idempotencyKey": "transfer-unique-key-001"
}
```

Use a new `idempotencyKey` for every new transfer. Reusing the same key prevents the transfer from running twice.

### Add initial funds

```text
POST /api/transactions/system/initial-funds
Authorization: Bearer SYSTEM_USER_TOKEN
```

```json
{
  "toAccount": "DESTINATION_ACCOUNT_ID",
  "amount": 10000,
  "idempotencyKey": "initial-funds-unique-key-001"
}
```

This route requires a user with `systemUser: true`.

## System User Setup

Register a normal user, then set `systemUser` to `true` in the MongoDB `users` collection for that user. Create an account while logged in as that system user before calling the initial-funds endpoint.

## Database Collections

| Collection | Purpose |
| --- | --- |
| `users` | Registered users and password hashes |
| `accounts` | Accounts owned by users |
| `transactions` | Transfer records and their status |
| `ledgers` | Immutable debit and credit balance entries |
| `tokenblacklists` | Tokens invalidated by logout |

## Balance Calculation

Balances are derived from ledger entries:

```text
Balance = total credits - total debits
```

Each completed transfer creates two ledger entries:

1. A `DEBIT` entry for the sender.
2. A `CREDIT` entry for the receiver.

## Security Notes

- Passwords are hashed with bcrypt before storage.
- Password fields are excluded from normal queries.
- JWT tokens expire after three days.
- Blacklisted tokens are rejected by protected routes.
- Ledger entries cannot be updated or deleted through the Mongoose model.
- Account balance requests verify that the account belongs to the authenticated user.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the server with Nodemon |
| `npm start` | Start the server with Node.js |

