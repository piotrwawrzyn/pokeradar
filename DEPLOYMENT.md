# Railway Deployment Guide

This guide will help you deploy the Pokemon Price Monitor bot to Railway with automatic deployments on every push.

## Prerequisites

- GitHub account with this repository
- Railway account (free tier available)

## Setup Steps

### 1. Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Sign up with GitHub (recommended for easier integration)

### 2. Create New Project

1. From Railway dashboard, click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository: `piotrwawrzyn/pokebot`
4. Railway will automatically detect it's a Node.js project

### 3. Configure Environment Variables

In the Railway project dashboard:

1. Go to "Variables" tab
2. Add the following environment variables:
   - `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
   - `TELEGRAM_CHAT_ID` - Your Telegram chat ID
   - `SCRAPE_INTERVAL_MS` - `60000` (or your preferred interval)
   - `LOG_LEVEL` - `info` (or `debug` for verbose logging)
   - `NODE_ENV` - `production`

### 4. Install Playwright Dependencies

Railway needs to install Playwright browsers. This is handled automatically by the build command in `railway.json`, but you can verify in the deployment logs.

### 5. Deploy

1. Railway will automatically deploy on the first setup
2. Check the "Deployments" tab to monitor progress
3. View logs in the "Logs" tab

## Automatic Deployments

Once set up, Railway will automatically:
1. Detect pushes to the `main` branch
2. Stop the currently running version
3. Build the new version (`npm install && npm run build`)
4. Start the new version (`npm start`)
5. Monitor the process and restart if it crashes

## Monitoring

### View Logs
- Go to your Railway project
- Click "Logs" tab
- See real-time logs from your bot

### Check Status
- Green indicator = Running
- Red indicator = Crashed/Stopped
- Yellow indicator = Building/Deploying

## Manual Deployment

If you need to manually trigger a deployment:
1. Go to Railway project dashboard
2. Click "Deployments" tab
3. Click "Deploy" button
4. Select the branch/commit to deploy

## Troubleshooting

### Bot not starting
- Check "Logs" tab for error messages
- Verify all environment variables are set correctly
- Ensure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct

### Build failures
- Check if `npm install` succeeded in logs
- Verify `package.json` dependencies are correct
- Check if TypeScript compilation succeeded

### Playwright issues
- Railway should auto-install browsers
- If issues persist, check deployment logs for Playwright installation errors
- May need to add `npx playwright install` to build command

### Out of free tier credits
- Railway free tier: $5/month credit
- Monitor usage in Railway dashboard
- Optimize `SCRAPE_INTERVAL_MS` if needed (increase to reduce usage)

## Cost Optimization

To stay within free tier:
- Keep `SCRAPE_INTERVAL_MS` at 60000 (1 minute) or higher
- Monitor fewer products initially
- Check Railway usage dashboard regularly

## Alternative: Render Deployment

If Railway doesn't work out, Render is another free option:

1. Go to [render.com](https://render.com)
2. Create new "Background Worker"
3. Connect GitHub repository
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Add environment variables
7. Deploy

## Support

- Railway docs: [docs.railway.app](https://docs.railway.app)
- Render docs: [render.com/docs](https://render.com/docs)
- Project issues: [GitHub Issues](https://github.com/piotrwawrzyn/pokebot/issues)
