# Fly.io Deployment Guide

This guide will help you deploy the Pokemon Price Monitor bot to Fly.io with automatic deployments.

## Why Fly.io?

- **True free tier**: 3 shared-cpu VMs with 256MB RAM each (plenty for this bot)
- **No credit card required**: Actually free
- **Auto-deploy**: GitHub Actions integration for auto-deploy
- **Global CDN**: Fast deployment from anywhere
- **Automatic restarts**: Built-in process monitoring

## Free Tier Resources

Fly.io free tier includes:
- Up to 3 shared-cpu-1x 256MB VMs
- 3GB persistent volume storage
- 160GB outbound data transfer

Perfect for this bot!

## Prerequisites

- GitHub account with this repository
- Fly.io account (free, no credit card needed)

## Setup Steps

### 1. Install Fly CLI

On Windows (PowerShell):
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

On macOS/Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Sign Up and Authenticate

```bash
flyctl auth signup
```

Or if you already have an account:
```bash
flyctl auth login
```

### 3. Launch Your App

From your project directory:

```bash
cd c:\Users\polsk\Desktop\pokebot_2.0
flyctl launch
```

This will:
- Detect the Dockerfile
- Ask you some questions
- Create a `fly.toml` configuration file

**Answer the prompts:**
- App name: `pokebot` (or choose your own)
- Region: `waw` (Warsaw, Poland - closest to you)
- Would you like to set up PostgreSQL: **No**
- Would you like to set up Redis: **No**
- Would you like to deploy now: **No** (we need to set secrets first)

### 4. Set Environment Variables (Secrets)

```bash
flyctl secrets set TELEGRAM_BOT_TOKEN=8567378980:AAHszCIZJbuSvL7LsQozsRwzJtgUK3rClFE
flyctl secrets set TELEGRAM_CHAT_ID=439458898
flyctl secrets set SCRAPE_INTERVAL_MS=60000
flyctl secrets set LOG_LEVEL=info
```

### 5. Deploy

```bash
flyctl deploy
```

This will:
- Build the Docker image
- Push to Fly.io registry
- Deploy to your VM
- Start the bot

First deployment takes 3-5 minutes (building Docker image with Playwright).

### 6. Check Status

```bash
flyctl status
```

### 7. View Logs

```bash
flyctl logs
```

## Auto-Deploy with GitHub Actions

To enable auto-deploy on every push:

### 1. Get Fly.io API Token

```bash
flyctl auth token
```

Copy the token.

### 2. Add Token to GitHub Secrets

1. Go to your GitHub repo: https://github.com/piotrwawrzyn/pokebot
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `FLY_API_TOKEN`
5. Value: Paste the token from step 1
6. Click "Add secret"

### 3. Create GitHub Actions Workflow

The repo already has the workflow file at `.github/workflows/fly.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy app
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Now every push to `main` will automatically deploy!

## Monitoring

### View Logs

Real-time logs:
```bash
flyctl logs
```

Tail logs (follow):
```bash
flyctl logs -f
```

### Check VM Status

```bash
flyctl status
```

### SSH into VM (for debugging)

```bash
flyctl ssh console
```

### View Metrics

```bash
flyctl metrics
```

Or view in dashboard: https://fly.io/dashboard

## Managing Your App

### Scale Down (to save resources)

```bash
flyctl scale count 1
```

### Restart App

```bash
flyctl apps restart pokebot
```

### Stop App (to save resources when not needed)

```bash
flyctl scale count 0
```

### Start App Again

```bash
flyctl scale count 1
```

### Update Secrets

```bash
flyctl secrets set SCRAPE_INTERVAL_MS=120000
```

### View All Secrets

```bash
flyctl secrets list
```

## Troubleshooting

### Build Failures

If Docker build fails:
1. Check logs: `flyctl logs`
2. Common issue: Playwright installation timeout
3. Try deploying again: `flyctl deploy`

### Bot Not Starting

```bash
flyctl logs
```

Check for:
- Missing environment variables
- Telegram token issues
- Playwright browser installation errors

### Out of Memory

The free tier provides 256MB RAM per VM. If you see OOM errors:

1. Reduce concurrent scraping (increase `SCRAPE_INTERVAL_MS`)
2. Monitor fewer products
3. Or upgrade VM size (costs money):
   ```bash
   flyctl scale vm shared-cpu-2x
   ```

### App Not Responding

Restart the app:
```bash
flyctl apps restart pokebot
```

## Cost Optimization

To stay within free tier:
- Keep to 1 VM (free tier includes up to 3)
- 256MB RAM is included free
- Keep `SCRAPE_INTERVAL_MS` at 60000 or higher
- Monitor fewer products initially

## Manual Deployment

If auto-deploy isn't set up or you want to deploy manually:

```bash
flyctl deploy
```

## Useful Commands Reference

```bash
# Deploy
flyctl deploy

# View logs
flyctl logs
flyctl logs -f  # follow mode

# Check status
flyctl status

# Restart
flyctl apps restart pokebot

# SSH into VM
flyctl ssh console

# Set secrets
flyctl secrets set KEY=value

# List secrets
flyctl secrets list

# Scale VMs
flyctl scale count 1

# View metrics
flyctl metrics

# Open dashboard
flyctl dashboard
```

## GitHub Actions Auto-Deploy

Once set up, your workflow is:
1. Make code changes locally
2. Commit and push to `main`
3. GitHub Actions automatically builds and deploys
4. Check deployment in Actions tab on GitHub
5. View logs with `flyctl logs`

## Free Tier Monitoring

Keep an eye on your usage:
- Dashboard: https://fly.io/dashboard
- Check current month usage
- Free tier is generous for this bot

## Support

- Fly.io docs: [fly.io/docs](https://fly.io/docs)
- Fly.io community: [community.fly.io](https://community.fly.io)
- Project issues: [GitHub Issues](https://github.com/piotrwawrzyn/pokebot/issues)

## Next Steps After Deployment

1. Test bot is working: Check Telegram for test notification
2. Monitor logs for first few cycles: `flyctl logs -f`
3. Verify products are being scraped correctly
4. Set up auto-deploy (GitHub Actions)
5. Add more products to watchlist
6. Add more shops to config
