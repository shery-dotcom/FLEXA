# Flexa Registration & Development Setup Guide

## Quick Start - Fix Registration Issues

### 1. Backend Setup (First Time)

```bash
cd flexa-backend

# Copy environment template
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Initialize database
# (the app does this automatically on startup)

# Run the backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup (First Time)

```bash
cd flexa-frontend

# Copy environment template (already created: .env.local)
# Verify content matches your setup

# Install dependencies
npm install

# Run the frontend
npm start
# Or for Vite:
npm run dev
```

### 3. Critical Configuration Checklist

**Backend (.env file required)**

- [ ] DATABASE_URL points to your PostgreSQL database
- [ ] FRONTEND_URL matches your frontend port (usually http://localhost:3000)
- [ ] ALLOWED_ORIGINS includes http://localhost:3000 and http://localhost:5173
- [ ] SECRET_KEY is set to a long random string (min 32 chars)
- [ ] REDIS_URL is configured if you have Redis (optional for dev)

**Frontend (.env.local already created)**

- [ ] REACT_APP_API_URL=http://localhost:8000/api/v1
- [ ] Check it can reach the backend at this URL

### 4. Verify Backend is Running

Open your browser and go to:

```
http://localhost:8000/api/v1/docs
```

If you see the Swagger documentation, the backend is running correctly.

### 5. Test Registration Endpoint

Using curl:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

You should get a 201 response with tokens.

### 6. Common Issues & Fixes

#### ❌ "Network error. Please check your internet connection"

**Solution:**

1. Verify backend is running: `http://localhost:8000/api/v1/docs`
2. Check REACT_APP_API_URL in .env.local matches backend URL
3. Check browser console (F12) for actual error details

#### ❌ "CORS error" or "Referrer Policy strict-origin-when-cross-origin"

**Solution:**

1. Verify ALLOWED_ORIGINS in backend .env includes your frontend URL
2. Backend CORS middleware is now configured with OPTIONS handler
3. Restart backend after changing .env file
4. Clear browser cache: Ctrl+Shift+Delete

#### ❌ "Database connection failed"

**Solution:**

1. Verify PostgreSQL is running
2. Check DATABASE_URL in .env is correct
3. Verify database exists or migrations run automatically
4. Check firewall allows port 5432

#### ❌ Registration says "Email already exists" but it's new

**Solution:**

1. Check if user exists in database (maybe from old test)
2. Clear browser localStorage: `localStorage.clear()` in console
3. Use a different email for testing

#### ❌ "Registration failed. Please try again in a moment" (500 error)

**Solution:**

1. Check backend console for error details
2. Check database is connected and migrations ran
3. Verify all required fields are sent:
   - email (valid email format)
   - password (min 8 characters)
   - phone (optional)

### 7. Check Logs for Debugging

**Backend logs** (where you ran `python -m uvicorn`)

- Look for "[AUTH]" prefixed messages
- Any error traces will help identify the issue

**Browser console** (F12)

- Look for "[AUTH]" prefixed console.log messages
- Network tab shows actual HTTP requests and responses

### 8. Permanent Fix Summary

What was fixed:
✅ Added CORS preflight handler (OPTIONS method) for auth endpoints
✅ Improved error handling in registration endpoint
✅ Enhanced frontend error messages with better debugging
✅ Set proper axios configuration with increased timeout
✅ Added input validation and trimming to prevent whitespace issues
✅ Created .env.local with proper API URL configuration

### 9. Development Workflow

Each time you work on the project:

```bash
# 1. Start backend
cd flexa-backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2. In new terminal, start frontend
cd flexa-frontend
npm start  # or npm run dev for Vite

# 3. Registration should now work at:
# http://localhost:3000/register (or your frontend URL)
```

### 10. If Issues Persist

1. **Check backend is actually restarted** after changes
2. **Clear all browser cache and localStorage**
3. **Verify no firewall is blocking ports 3000, 5173, or 8000**
4. **Check both .env files are properly configured**
5. **Look at actual HTTP response** in browser Network tab (F12)
6. **Check console logs** for [AUTH] debug messages

---

**Note:** This setup ensures registration works permanently. The fixes include:

- Proper CORS handling for all browsers
- Better error messages for debugging
- Environment variable configuration
- Input validation on both frontend and backend
