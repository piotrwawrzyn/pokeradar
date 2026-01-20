# Railway Deployment Guide

This guide will help you deploy the Pokemon Price Monitor bot to Railway with automatic deployments on every push.

## Why Railway?

- **Simple setup**: Connect GitHub and deploy in minutes
- **Auto-deploy**: Automatically redeploys on every push to main
- **Automatic restarts**: Process monitoring and auto-restart on crashes
- **Built-in logging**: Real-time logs in the dashboard
- **Hobby tier**: $5/month for hobby projects

## Prerequisites

- GitHub account with this repository
- Railway account
- Credit card (for Hobby tier - $5/month)

## Setup Steps

### 1. Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Login"
3. Sign in with GitHub (recommended)

### 2. Create New Project

1. From Railway dashboard, click "New Project"
2. Select "Deploy from GitHub repo"
3. Authorize Railway to access your GitHub account
4. Choose your repository: `piotrwawrzyn/pokebot`
5. Click "Deploy Now"

Railway will automatically:
- Detect it's a Node.js project
- Use the `railway.json` configuration
- Install dependencies
- Build TypeScript
- Start the bot

### 3. Upgrade to Hobby Tier

By default, Railway deploys on the Trial plan which has limitations.

1. In your project dashboard, click "Settings"
2. Scroll to "Plan"
3. Click "Upgrade to Hobby"
4. Add payment method (credit card)
5. Confirm upgrade

**Hobby tier**: $5/month flat rate, includes:
- 5GB RAM
- 5GB disk
- Unlimited builds
- No execution time limits

### 4. Configure Environment Variables

In the Railway project dashboard:

1. Click on your service
2. Go to "Variables" tab
3. Click "New Variable" for each:

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token (from BotFather) |
| `TELEGRAM_CHAT_ID` | Your chat ID |
| `SCRAPE_INTERVAL_MS` | `60000` |
| `LOG_LEVEL` | `info` |
| `NODE_ENV` | `production` |

4. Click "Deploy" after adding variables

**Important**: Keep `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secret!

### 5. Install Playwright Browsers

Railway needs to install Playwright browsers. Add a build command:

1. Go to "Settings" tab
2. Scroll to "Build Command"
3. Override with: `npm install && npx playwright install chromium && npm run build`
4. Save

The deployment will restart automatically with Playwright installed.

### 6. Verify Deployment

1. Go to "Deployments" tab
2. Check the latest deployment status
3. Click on it to see build logs
4. Once status shows "Success", go to "Logs" tab
5. You should see your bot starting up
6. Check Telegram for the test notification

## Automatic Deployments

Once set up, Railway automatically:
1. Detects pushes to the `main` branch via GitHub webhook
2. Stops the currently running version
3. Builds the new version
4. Starts the new version
5. Monitors the process and restarts if it crashes

**No configuration needed** - it just works!

## Monitoring

### View Logs

1. Go to your Railway project
2. Click on your service
3. Click "Logs" tab
4. See real-time logs from your bot
5. Use the filter box to search logs

### Check Metrics

1. Go to "Metrics" tab
2. View:
   - CPU usage
   - Memory usage
   - Network traffic
   - Request rate

### Deployment History

1. Go to "Deployments" tab
2. See all deployments
3. Click any deployment to see:
   - Build logs
   - Deployment status
   - Commit that triggered it
   - Duration

## Managing Your Service

### Restart Service

1. Go to "Settings" tab
2. Scroll to "Service"
3. Click "Restart"

### Redeploy

1. Go to "Deployments" tab
2. Click "Deploy" button
3. Select "Redeploy" to deploy the latest code

### Stop Service (Temporarily)

1. Go to "Settings" tab
2. Scroll to "Sleep Service"
3. Click "Sleep"
4. Wake up later by clicking "Wake"

### Update Environment Variables

1. Go to "Variables" tab
2. Click the variable you want to change
3. Update value
4. Service automatically redeploys

## Troubleshooting

### Bot Not Starting

Check logs for error messages:
1. Go to "Logs" tab
2. Look for red error messages
3. Common issues:
   - Missing environment variables
   - Invalid `TELEGRAM_BOT_TOKEN`
   - Playwright installation failed

### Build Failures

1. Go to "Deployments" → Click failed deployment
2. Check build logs
3. Common issues:
   - `npm install` failed (check dependencies)
   - TypeScript compilation errors
   - Playwright installation timeout (retry deploy)

### Playwright Issues

If Playwright fails to install:
1. Check build command includes `npx playwright install chromium`
2. Redeploy to retry
3. Check logs for specific error

### High Memory Usage

Monitor memory in "Metrics" tab:
- Hobby tier provides 5GB RAM (plenty for this bot)
- If issues occur, increase `SCRAPE_INTERVAL_MS`
- Or reduce number of products being monitored

### Service Keeps Restarting

1. Check "Logs" for crash errors
2. Common causes:
   - Uncaught exceptions in code
   - Out of memory (unlikely on Hobby)
   - Invalid configuration

## Railway CLI (Optional)

For advanced users, install Railway CLI:

```bash
npm i -g @railway/cli
railway login
railway link  # Link to your project
railway logs  # View logs from terminal
railway run npm run dev  # Run locally with Railway env vars
```

## Cost Management

**Hobby Tier**: $5/month flat rate
- No usage-based billing
- Unlimited builds and deploys
- Generous resource limits

**Tips**:
- One project can have multiple services
- You're only charged once for the Hobby plan
- Monitor usage in Railway dashboard

## GitHub Integration

Railway automatically:
- Watches your `main` branch
- Deploys on every push
- Shows commit info in deployments
- Links to GitHub commits in deployment history

No GitHub Actions needed - Railway handles everything!

## Production Best Practices

1. **Monitoring**: Check logs daily for errors
2. **Alerts**: Enable Railway notifications (Settings → Notifications)
3. **Testing**: Test locally before pushing to main
4. **Backups**: Keep watchlist and configs in git
5. **Updates**: Keep dependencies updated regularly

## Useful Railway Features

### Environment Groups

Share environment variables across services:
1. Go to project Settings
2. Create Environment Group
3. Add shared variables
4. Link to services

### Custom Domains (Optional)

If you add a web interface later:
1. Go to "Settings" tab
2. Scroll to "Domains"
3. Add custom domain
4. Configure DNS

### Webhooks (Advanced)

Get notified of deployments:
1. Settings → Webhooks
2. Add webhook URL
3. Select events (deploy success/failure)

## Rollback (If Needed)

If a deployment breaks something:
1. Go to "Deployments" tab
2. Find the last working deployment
3. Click three dots → "Redeploy"
4. This redeploys the old version

## Support

- Railway docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Project issues: [GitHub Issues](https://github.com/piotrwawrzyn/pokebot/issues)

## Next Steps After Deployment

1. ✅ Verify bot is running (check Telegram)
2. ✅ Monitor logs for first few scan cycles
3. ✅ Verify products are being scraped correctly
4. Add more products to watchlist
5. Add more shops to config
6. Set up monitoring alerts in Railway

## Summary

Your deployment workflow:
1. Make changes locally
2. Commit and push to `main`
3. Railway automatically deploys
4. Check logs to verify
5. Get Telegram notifications when products match criteria

That's it! Railway handles everything else.
