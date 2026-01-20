# Render Deployment Guide

This guide will help you deploy the Pokemon Price Monitor bot to Render with automatic deployments on every push.

## Why Render?

- **Free tier**: Background workers can run 24/7 on free tier
- **Auto-deploy**: Automatically deploys when you push to GitHub
- **No credit card required**: True free tier
- **Automatic restarts**: Process monitoring and auto-restart on crashes

## Prerequisites

- GitHub account with this repository
- Render account (free, no credit card needed)

## Setup Steps

### 1. Create Render Account

1. Go to [render.com](https://render.com)
2. Click "Get Started"
3. Sign up with GitHub (recommended for easier integration)

### 2. Create New Background Worker

1. From Render dashboard, click "New +"
2. Select "Background Worker"
3. Connect your GitHub account if not already connected
4. Choose your repository: `piotrwawrzyn/pokebot`
5. Click "Connect"

### 3. Configure the Worker

Render will show a configuration form:

**Basic Settings:**
- **Name**: `pokebot` (or any name you prefer)
- **Runtime**: `Node`
- **Region**: Choose closest to Poland (e.g., Frankfurt)
- **Branch**: `main`

**Build & Deploy:**
- **Build Command**: `npm install && npx playwright install --with-deps chromium && npm run build`
- **Start Command**: `npm start`

**Instance Type:**
- Select **Free** plan

### 4. Configure Environment Variables

Scroll down to "Environment Variables" section and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `TELEGRAM_BOT_TOKEN` | Your bot token (from BotFather) |
| `TELEGRAM_CHAT_ID` | Your chat ID |
| `SCRAPE_INTERVAL_MS` | `60000` |
| `LOG_LEVEL` | `info` |

**Important**: Keep `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secret!

### 5. Auto-Deploy from GitHub (Optional but Recommended)

Render can auto-deploy using the `render.yaml` file in your repo:

1. Instead of manual setup, when creating the service select "Use render.yaml"
2. Render will read the configuration from the file
3. You'll only need to add the secret environment variables manually:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

### 6. Deploy

1. Click "Create Background Worker"
2. Render will start building and deploying
3. Watch the logs in real-time
4. First deployment takes 3-5 minutes (installing Playwright browsers)

## Automatic Deployments

Once set up, Render will automatically:
1. Detect pushes to the `main` branch
2. Stop the currently running version
3. Build the new version
4. Start the new version
5. Monitor the process and restart if it crashes

## Monitoring

### View Logs
- Go to your service dashboard
- Click "Logs" tab
- See real-time logs from your bot
- Logs are retained for 7 days on free tier

### Check Status
- **Live**: Service is running
- **Building**: New version is being built
- **Failed**: Check logs for errors
- **Suspended**: Free tier services suspend after 90 days of inactivity (restarts automatically when needed)

### Events
- View deployment history
- See when auto-deploys happened
- Check build times and status

## Manual Deployment

If you need to manually trigger a deployment:
1. Go to service dashboard
2. Click "Manual Deploy"
3. Select "Deploy latest commit" or choose a specific commit

## Troubleshooting

### Bot not starting
- Check "Logs" for error messages
- Verify environment variables are set correctly
- Ensure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct
- Check if build completed successfully

### Build failures
- Common issue: Playwright installation timeout
  - Solution: Build should retry automatically
  - If persists, check if `--with-deps` flag is in build command
- Check if `npm install` succeeded in logs
- Verify TypeScript compilation completed

### Playwright browser installation issues
- The build command includes `npx playwright install --with-deps chromium`
- This installs Chromium browser and all system dependencies
- First build takes longer (3-5 minutes)
- Subsequent builds are faster (cached)

### Service suspended
- Free tier services can suspend after 90 days of inactivity
- They automatically wake up when needed
- Or manually restart from dashboard

### High memory usage
- Playwright can use significant memory
- Free tier provides 512MB RAM
- If issues occur, increase `SCRAPE_INTERVAL_MS` to reduce concurrent browser instances

## Free Tier Limits

Render free tier for background workers:
- **RAM**: 512MB
- **CPU**: Shared
- **Disk**: 512MB
- **Network**: Shared
- **Uptime**: 24/7 (no sleep like web services)
- **Build time**: 400 build minutes per month
- **Logs**: 7 day retention

This should be more than enough for the bot!

## Cost Optimization

To maximize free tier:
- Keep `SCRAPE_INTERVAL_MS` at 60000 (1 minute) or higher
- Monitor fewer products initially
- Check service metrics in dashboard
- Optimize code to reduce memory usage if needed

## Updates and Deployments

Every time you push to `main`:
1. GitHub triggers webhook to Render
2. Render pulls latest code
3. Runs build command
4. Deploys new version
5. Old version is stopped gracefully
6. New version starts

You'll get email notifications about deployment status.

## Monitoring Best Practices

1. **Check logs regularly**: Monitor for errors
2. **Set up alerts**: Render can email you on failed deployments
3. **Watch metrics**: CPU and memory usage visible in dashboard
4. **Test notifications**: Ensure Telegram notifications work

## Alternative: Fly.io

If Render doesn't work out, Fly.io is another option with a generous free tier:

1. Install Fly CLI: `npm install -g flyctl`
2. Sign up: `flyctl auth signup`
3. Launch app: `flyctl launch` (follow prompts)
4. Set secrets: `flyctl secrets set TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx`
5. Deploy: `flyctl deploy`

## Support

- Render docs: [render.com/docs](https://render.com/docs)
- Render community: [community.render.com](https://community.render.com)
- Project issues: [GitHub Issues](https://github.com/piotrwawrzyn/pokebot/issues)
