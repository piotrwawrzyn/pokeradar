# PokeRadar Production Deployment Guide

This guide will walk you through deploying all 4 services to Railway with your OVH domain.

## Architecture Overview

Your application consists of 4 services:

1. **pokeradar-api** - Backend API (Express.js + MongoDB)
2. **pokeradar-client** - Frontend (React + Vite)
3. **pokeradar-notifications** - Telegram Bot Service
4. **pokeradar-scrapper** - Web Scraper (Patchright/Playwright)

## Prerequisites

- ✅ Railway account (you have this)
- ✅ OVH domain (you have this)
- ⬜ MongoDB database (we'll set this up)
- ⬜ Google OAuth credentials
- ⬜ Telegram Bot token

---

## Step 1: Set Up MongoDB Database

You have two options:

### Option A: Railway MongoDB (Recommended for simplicity)

1. Go to your Railway project
2. Click "New" → "Database" → "Add MongoDB"
3. Once deployed, copy the `MONGO_URL` from the Variables tab
4. This will be your `MONGODB_URI`

### Option B: MongoDB Atlas (Recommended for production)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (or paid for better performance)
3. Create a database user
4. Whitelist Railway IPs: `0.0.0.0/0` (or use Railway's IP addresses)
5. Get your connection string (should look like: `mongodb+srv://username:password@cluster.mongodb.net/pokeradar`)

**Important**: For the notifications service to work, MongoDB must support **change streams** (replica sets). Railway MongoDB and Atlas both support this by default.

---

## Step 2: Create Railway Services

### 2.1 Create a New Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Empty Project"
4. Name it "pokeradar"

### 2.2 Connect Your GitHub Repository

1. In the Railway project, click "New"
2. Select "GitHub Repo"
3. Authorize Railway to access your repository
4. Select your `pokeradar` repository

### 2.3 Deploy Each Service

Railway will detect your monorepo. You need to create 4 separate services:

#### Service 1: API Backend

1. Click "New" → "GitHub Repo" → Select your repo
2. Configure:
   - **Name**: `pokeradar-api`
   - **Root Directory**: `pokeradar-api`
   - **Branch**: `main`
3. Railway will auto-detect the `railway.json` config

#### Service 2: Frontend Client

1. Click "New" → "GitHub Repo" → Select your repo
2. Configure:
   - **Name**: `pokeradar-client`
   - **Root Directory**: `pokeradar-client`
   - **Branch**: `main`

#### Service 3: Notifications Service

1. Click "New" → "GitHub Repo" → Select your repo
2. Configure:
   - **Name**: `pokeradar-notifications`
   - **Root Directory**: `pokeradar-notifications`
   - **Branch**: `main`

#### Service 4: Scraper Service

1. Click "New" → "GitHub Repo" → Select your repo
2. Configure:
   - **Name**: `pokeradar-scrapper`
   - **Root Directory**: `pokeradar-scrapper`
   - **Branch**: `main`

---

## Step 3: Configure Environment Variables

### 3.1 API Service (`pokeradar-api`)

Go to the API service → Variables tab → Add these:

```env
NODE_ENV=production
PORT=3000

# MongoDB (use the connection string from Step 1)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokeradar

# Google OAuth (get from https://console.cloud.google.com)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback

# JWT (generate a secure random string, at least 32 characters)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_long_random_string
JWT_EXPIRES_IN=7d

# CORS (your frontend URL - we'll update this after deploying client)
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**How to get Google OAuth credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Web application"
6. Authorized redirect URIs: `https://api.yourdomain.com/auth/google/callback`
7. Copy Client ID and Client Secret

**Generate JWT_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.2 Client Service (`pokeradar-client`)

The client is a static React app. You need to set build-time environment variables:

```env
# API endpoint (Railway will give you this URL after deploying the API)
VITE_API_URL=https://api.yourdomain.com
```

**Important**: Vite environment variables are embedded at build time. If you change `VITE_API_URL`, you must redeploy.

### 3.3 Notifications Service (`pokeradar-notifications`)

```env
# MongoDB (same as API)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokeradar

# Telegram Bot Token (get from @BotFather on Telegram)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Frontend URL (for bot command links)
APP_URL=https://yourdomain.com

# Logging
LOG_LEVEL=info
```

**How to get Telegram Bot Token:**

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow instructions
3. Copy the token provided

### 3.4 Scraper Service (`pokeradar-scrapper`)

```env
# MongoDB (same as API)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokeradar

# Scraper Configuration
LOG_LEVEL=info
SHOP_ENGINE=all
MAX_RETRY_ATTEMPTS=1

# Playwright/Patchright will auto-install Chrome
```

**Note**: The scraper uses Patchright (Playwright fork). Railway's build command includes `npx patchright install chrome`.

---

## Step 4: Configure Custom Domains

Railway provides default URLs like `pokeradar-api.up.railway.app`, but you want to use your OVH domain.

### 4.1 Get Railway URLs

After deployment, Railway assigns URLs to each service. Note them down:

- API: `pokeradar-api-production-xxxx.up.railway.app`
- Client: `pokeradar-client-production-xxxx.up.railway.app`

### 4.2 Add Custom Domain to API Service

1. Go to API service in Railway
2. Click "Settings" → "Domains"
3. Click "Custom Domain"
4. Enter: `api.yourdomain.com`
5. Railway will show you a CNAME record to add

### 4.3 Add Custom Domain to Client Service

1. Go to Client service in Railway
2. Click "Settings" → "Domains"
3. Click "Custom Domain"
4. Enter: `yourdomain.com` (root domain)
5. Railway will show you DNS records to add

### 4.4 Configure DNS in OVH

1. Log into [OVH Control Panel](https://www.ovh.com/manager/)
2. Go to your domain → DNS Zone
3. Add the following records:

**For API:**

```
Type: CNAME
Name: api
Target: pokeradar-api-production-xxxx.up.railway.app
TTL: 300
```

**For Frontend (Root Domain):**

If Railway gives you a CNAME:

```
Type: CNAME
Name: @
Target: pokeradar-client-production-xxxx.up.railway.app
TTL: 300
```

If Railway requires A records (for root domain):

```
Type: A
Name: @
Target: [IP provided by Railway]
TTL: 300
```

Also add www subdomain:

```
Type: CNAME
Name: www
Target: yourdomain.com
TTL: 300
```

4. Click "Save"
5. Wait 5-30 minutes for DNS propagation

**Note**: The notifications and scraper services don't need public domains - they run as background services.

---

## Step 5: Update Environment Variables with Actual Domains

After setting up your domains, update these environment variables:

### API Service

```env
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback
CORS_ORIGIN=https://yourdomain.com
```

Also update Google OAuth settings:

1. Go to Google Cloud Console → Credentials
2. Edit your OAuth 2.0 Client
3. Update Authorized JavaScript origins: `https://yourdomain.com`
4. Update Authorized redirect URIs: `https://api.yourdomain.com/auth/google/callback`

### Client Service

```env
VITE_API_URL=https://api.yourdomain.com
```

**Important**: After updating `VITE_API_URL`, redeploy the client service.

### Notifications Service

```env
APP_URL=https://yourdomain.com
```

---

## Step 6: Verify Deployment

### 6.1 Check Service Health

1. **API**: Visit `https://api.yourdomain.com/health` (or whatever health endpoint you have)
2. **Client**: Visit `https://yourdomain.com`
3. **Check Railway Logs**:
   - Go to each service
   - Click "Deployments" → Latest deployment
   - Check "View Logs" for any errors

### 6.2 Test the Flow

1. Open your frontend: `https://yourdomain.com`
2. Try logging in with Google OAuth
3. Create a price alert
4. Verify the scraper is running (check Railway logs)
5. Test Telegram notifications (send a message to your bot)

---

## Step 7: Database Backups (Important!)

### Railway MongoDB

- Railway Pro plan includes automatic backups
- Export manually: Railway dashboard → MongoDB service → Backups

### MongoDB Atlas

- Automatic backups are included in free tier
- Configure backup schedule in Atlas dashboard

---

## Troubleshooting

### Issue: "CORS error" when logging in

**Fix**: Make sure `CORS_ORIGIN` in API matches your frontend domain exactly (including https://)

### Issue: "Cannot find module" errors

**Fix**: Railway build might need workspace dependencies. Check `railway.json` buildCommand includes `cd .. && npm install`

### Issue: Scraper crashes with "Chrome not found"

**Fix**: Ensure `postinstall` script runs: `npx patchright install chrome`. Check Railway build logs.

### Issue: Notifications not working

**Fix**: MongoDB must support change streams (replica sets). Use Railway MongoDB or Atlas (not standalone MongoDB).

### Issue: Google OAuth redirect fails

**Fix**:

1. Check `GOOGLE_CALLBACK_URL` matches actual domain
2. Update Google Cloud Console → Credentials → Authorized redirect URIs

### Issue: DNS not resolving

**Fix**:

1. Wait up to 48 hours for full propagation (usually 5-30 minutes)
2. Check DNS with: `nslookup yourdomain.com` or `dig yourdomain.com`
3. Clear browser cache and try incognito mode

---

## Production Checklist

Before going live:

- [ ] MongoDB database set up with backups enabled
- [ ] All 4 services deployed on Railway
- [ ] Environment variables configured for all services
- [ ] Custom domains added and DNS configured
- [ ] Google OAuth credentials created and configured
- [ ] Telegram bot created and token added
- [ ] SSL certificates active (Railway handles this automatically)
- [ ] Test login flow end-to-end
- [ ] Test scraper functionality
- [ ] Test Telegram notifications
- [ ] Monitor Railway logs for errors
- [ ] Set up Railway alerts for service downtime
- [ ] Document your MongoDB connection string securely
- [ ] Consider upgrading Railway plan for production (better performance, backups)

---

## Cost Estimates

### Railway

- **Hobby Plan** (free): $5/month credit, good for testing
- **Pro Plan** ($20/month): Better for production
  - More resources
  - Automatic backups
  - Priority support

### MongoDB Atlas

- **Free Tier**: 512MB storage (good for starting)
- **M10** (~$57/month): Recommended for production

### Total Estimated Monthly Cost

- **Minimal**: ~$20-30 (Railway Pro + MongoDB Free)
- **Production**: ~$80-100 (Railway Pro + MongoDB M10)

---

## Maintenance

### Regular Tasks

1. Monitor Railway logs weekly
2. Check MongoDB storage usage
3. Review scraper performance
4. Update dependencies monthly
5. Rotate JWT_SECRET every 6-12 months

### Scaling

- If traffic grows, upgrade Railway plan or add more replicas
- MongoDB Atlas can auto-scale
- Consider adding Redis for caching (Railway has a Redis addon)

---

## Security Best Practices

1. ✅ All secrets in Railway environment variables (never in code)
2. ✅ Use strong JWT_SECRET (32+ random characters)
3. ✅ Enable Railway's automatic HTTPS (done by default)
4. ✅ Whitelist only necessary MongoDB IPs
5. ✅ Enable rate limiting in API (already configured)
6. ✅ Keep dependencies updated
7. ✅ Monitor Railway logs for suspicious activity
8. ✅ Use Railway's built-in DDoS protection

---

## Next Steps

1. Follow Steps 1-6 above
2. Test everything thoroughly
3. Monitor for 24-48 hours
4. If stable, update DNS TTL to higher values (e.g., 3600)
5. Set up monitoring alerts
6. Consider adding error tracking (Sentry, LogRocket, etc.)

Need help? Check Railway docs: https://docs.railway.app
