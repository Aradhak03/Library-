# Library Management Backend API

FastAPI backend for library seat booking and payment management system.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install pipenv if you don't have it
pip install pipenv

# Install project dependencies
pipenv install
```

### 2. Setup Environment Variables

Create a `.env` file in the root directory:

```bash
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/database_name
```

### 3. Run Database Migrations

**Important: Run this once per database before starting the service**

```bash
# Add payment constraint (prevents overlapping payments)
psql -U your_username -d your_database_name -f migrations/add_payment_constraint.sql

# Or connect to psql and run:
psql -U your_username -d your_database_name
\i migrations/add_payment_constraint.sql
```

### 4. Start the Service

```bash
# Activate virtual environment
pipenv shell

# Run the FastAPI server
uvicorn service:app --reload

# Or run on specific host/port
uvicorn service:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: `http://localhost:8000`

API Documentation (Swagger UI): `http://localhost:8000/docs`

---

## 📋 Important Commands

### Running the Service

```bash
# Development mode (with auto-reload)
pipenv run uvicorn service:app --reload

# Production mode
pipenv run uvicorn service:app --host 0.0.0.0 --port 8000

# With specific workers
pipenv run uvicorn service:app --workers 4
```

### Database Migrations

```bash
# Run payment constraint migration (one-time setup)
psql -U username -d database_name -f migrations/add_payment_constraint.sql

# Check if constraint exists
psql -U username -d database_name -c "SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_periods';"
```

### Virtual Environment

```bash
# Activate virtual environment
pipenv shell

# Install new package
pipenv install package_name

# Install dev dependencies
pipenv install --dev package_name

# Show dependency tree
pipenv graph

# Update dependencies
pipenv update
```

### Database Connection

```bash
# Connect to PostgreSQL
psql -U username -d database_name

# List all tables
\dt

# Describe a table
\d payments

# Exit psql
\q
```

---

## 📁 Project Structure

```
library_backend/
├── app/
│   ├── core/           # Configuration
│   ├── db/             # Database connection and CRUD
│   ├── managers/       # Business logic
│   ├── models/         # SQLAlchemy models
│   └── routers/        # API endpoints
├── migrations/         # Database migration files
├── service.py          # FastAPI application entry point
├── Pipfile             # Python dependencies
└── .env                # Environment variables (create this)
```

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:8000
```

### Main Endpoints

- **Students**: `/students`
- **Seats**: `/seats`
- **Bookings**: `/bookings`
- **Payments**: `/payments`
- **Dashboard**: `/dashboard`

### Interactive API Docs
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 🗄️ Database Setup

### Create Database

```sql
CREATE DATABASE library_db;
```

### Run Migrations

The application automatically creates tables on startup. However, you need to run the payment constraint migration manually:

```bash
psql -U username -d library_db -f migrations/add_payment_constraint.sql
```

### Important Tables

- `students` - Student information
- `seats` - Library seats
- `bookings` - Seat bookings/subscriptions
- `payments` - Payment records

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>
```

### Database Connection Error

1. Check `.env` file exists and has correct `DATABASE_URL`
2. Verify PostgreSQL is running: `pg_isready`
3. Check database credentials

### Migration Errors

If migration fails with "constraint already exists", that's fine - it means it's already applied.

### Import Errors

```bash
# Make sure you're in the virtual environment
pipenv shell

# Reinstall dependencies
pipenv install
```

---

## 📝 Key Features

- ✅ Anniversary-based payment billing
- ✅ Prevents overlapping payment periods (database constraint)
- ✅ Cash accounting (revenue based on payment_date)
- ✅ Active booking management
- ✅ Pending payment tracking

---

## 🛠️ Development

### Code Style

- Follow PEP 8
- Use type hints
- Async/await for database operations

### Adding New Features

1. Create model in `app/models/`
2. Add manager logic in `app/managers/`
3. Create router endpoints in `app/routers/`
4. Register router in `service.py`

---

## ⚠️ Important Notes

1. **Always run the payment constraint migration** before using the payment system
2. **Database URL** must be set in `.env` file
3. **Tables are auto-created** on startup (no need for separate migration)
4. **Payment constraint** prevents overlapping periods automatically

---

## 🚨 Quick Reference

```bash
# Start development server
pipenv shell
uvicorn service:app --reload

# Run migration
psql -U username -d database_name -f migrations/add_payment_constraint.sql

# Check API health
curl http://localhost:8000/

# View API docs
open http://localhost:8000/docs
```

---

## 📞 Need Help?

Check the documentation files in the project root or review the code comments for detailed explanations.

