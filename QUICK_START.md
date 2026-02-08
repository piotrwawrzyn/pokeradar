# Quick Start: Railway Deployment

Follow these steps to deploy PokeRadar to production in ~30 minutes.

## 🚀 TL;DR

1. Set up MongoDB (Railway or Atlas)
2. Create 4 Railway services from your GitHub repo
3. Add environment variables to each service
4. Configure your OVH domain DNS
5. Test and go live!

---

## Step-by-Step Deployment

### 1️⃣ Set Up MongoDB (5 minutes)

**Option A: Railway MongoDB** (Easiest)
1. Go to Railway → New → Database → MongoDB
2. Copy the `MONGO_URL` variable
3. Use this as `MONGODB_URI` for all services

**Option B: MongoDB Atlas** (Better for production)
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster
3. Create database user
4. Whitelist IP: `0.0.0.0/0`
5. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/pokeradar`

---

### 2️⃣ Create Railway Services (10 minutes)

Go to [railway.app/dashboard](https://railway.app/dashboard)

1. **New Project** → "Empty Project" → Name: "pokeradar"
2. Click **"New"** 4 times to create 4 services:

   **Service 1: API**
   - New → GitHub Repo → Select your repo
   - Name: `pokeradar-api`
   - Root Directory: `pokeradar-api`

   **Service 2: Client**
   - New → GitHub Repo → Select your repo
   - Name: `pokeradar-client`
   - Root Directory: `pokeradar-client`

   **Service 3: Notifications**
   - New → GitHub Repo → Select your repo
   - Name: `pokeradar-notifications`
   - Root Directory: `pokeradar-notifications`

   **Service 4: Scraper**
   - New → GitHub Repo → Select your repo
   - Name: `pokeradar-scrapper`
   - Root Directory: `pokeradar-scrapper`

Railway will automatically deploy using the `railway.json` configs.

---

### 3️⃣ Add Environment Variables (10 minutes)

For each service, click on it → **Variables** tab → **Raw Editor** → Paste the variables below:

#### 🔹 API Service

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=your_mongodb_connection_string_from_step_1
GOOGLE_CLIENT_ID=get_from_google_cloud_console
GOOGLE_CLIENT_SECRET=get_from_google_cloud_console
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback
JWT_SECRET=run_this_command_to_generate_one_see_below
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get Google OAuth Credentials:**
- Go to: [console.cloud.google.com](https://console.cloud.google.com)
- Create project → Enable Google+ API
- Credentials → Create OAuth 2.0 Client ID
- Authorized redirect: `https://api.yourdomain.com/auth/google/callback`

#### 🔹 Client Service

```env
VITE_API_URL=https://api.yourdomain.com
```

#### 🔹 Notifications Service

```env
MONGODB_URI=same_as_api_service
TELEGRAM_BOT_TOKEN=get_from_botfather
APP_URL=https://yourdomain.com
LOG_LEVEL=info
```

**Get Telegram Bot Token:**
- Open Telegram → Search `@BotFather`
- Send: `/newbot`
- Follow instructions
- Copy token

#### 🔹 Scraper Service

```env
MONGODB_URI=same_as_api_service
LOG_LEVEL=info
SHOP_ENGINE=all
MAX_RETRY_ATTEMPTS=1
```

After adding variables, Railway will automatically redeploy.

---

### 4️⃣ Configure Custom Domains (5 minutes)

#### In Railway:

**API Service:**
1. Click API service → Settings → Domains
2. Add Custom Domain: `api.yourdomain.com`
3. Copy the CNAME target shown (looks like: `pokeradar-api-production-xxxx.up.railway.app`)

**Client Service:**
1. Click Client service → Settings → Domains
2. Add Custom Domain: `yourdomain.com`
3. Copy the CNAME/A record target shown

#### In OVH:

1. Go to [ovh.com/manager](https://www.ovh.com/manager)
2. Select your domain → DNS Zone
3. Add these records:

```
Type: CNAME
Name: api
Target: pokeradar-api-production-xxxx.up.railway.app
TTL: 300

Type: CNAME
Name: @ (or leave blank for root)
Target: pokeradar-client-production-xxxx.up.railway.app
TTL: 300

Type: CNAME
Name: www
Target: yourdomain.com
TTL: 300
```

4. Save and wait 5-30 minutes for DNS propagation

#### Update Environment Variables:

After domains are live, update these in Railway:

**API Service:**
```env
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback
CORS_ORIGIN=https://yourdomain.com
```

**Client Service:**
```env
VITE_API_URL=https://api.yourdomain.com
```

**Notifications Service:**
```env
APP_URL=https://yourdomain.com
```

Also update Google Cloud Console:
- Credentials → Edit OAuth Client
- Authorized origins: `https://yourdomain.com`
- Authorized redirect: `https://api.yourdomain.com/auth/google/callback`

Railway will auto-redeploy when you save variables.

---

### 5️⃣ Verify Deployment (5 minutes)

Wait for all deployments to complete, then:

1. ✅ Visit `https://yourdomain.com` → Should load your app
2. ✅ Visit `https://api.yourdomain.com` → Should see API response
3. ✅ Test login with Google
4. ✅ Create a test price alert
5. ✅ Check Railway logs for all services (no errors)
6. ✅ Test Telegram bot (send `/start` command)

---

## 🎉 You're Live!

Your app is now running in production!

### Monitoring

Check Railway logs regularly:
1. Go to each service
2. Click "Deployments" → Latest
3. "View Logs"

### What's Running

- **API**: Handles authentication, price alerts, user management
- **Client**: Frontend UI served to users
- **Notifications**: Listens to MongoDB changes and sends Telegram messages
- **Scraper**: Runs in background, scrapes shop prices

---

## 🐛 Troubleshooting

**DNS not working?**
- Wait up to 48 hours (usually 5-30 mins)
- Check: `nslookup yourdomain.com`
- Try incognito mode

**Login fails?**
- Check `CORS_ORIGIN` matches frontend URL exactly
- Check `GOOGLE_CALLBACK_URL` in both Railway and Google Console

**Scraper crashes?**
- Check Railway logs
- Patchright should auto-install Chrome during build
- May need more memory → upgrade Railway plan

**Notifications not working?**
- MongoDB must support change streams (replica sets)
- Railway MongoDB and Atlas work out of the box
- Check Telegram token is correct

---

## 📚 Resources

- Full deployment guide: See `DEPLOYMENT.md`
- Environment templates: `*/.env.production.example`
- Railway docs: [docs.railway.app](https://docs.railway.app)
- MongoDB Atlas: [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

---

## 💰 Cost

- **Free Tier**: Railway $5/month credit + MongoDB Atlas free tier
- **Recommended**: Railway Pro ($20/month) for better performance
- **Production**: Railway Pro + MongoDB M10 = ~$80/month

---

## 🔒 Security Checklist

- [x] All secrets in Railway environment variables (never in code)
- [x] JWT_SECRET is 32+ random characters
- [x] HTTPS enabled (Railway does this automatically)
- [x] Rate limiting enabled
- [x] CORS configured to your domain only
- [ ] MongoDB IP whitelist (optional: use `0.0.0.0/0` to allow Railway)
- [ ] Enable 2FA on Railway account
- [ ] Regular dependency updates

---

Need help? Check the full `DEPLOYMENT.md` guide!
