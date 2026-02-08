# Disabled Shops

This document tracks shops that have been disabled and the reasons why.

## BattleStash

- **Shop ID**: `battlestash`
- **URL**: https://battlestash.pl
- **Disabled**: 2026-01-23
- **Reason**: Cloudflare protection blocks product page access

### Details

Search pages work correctly with the stealth plugin, allowing product discovery. However, when navigating to individual product pages to extract price and availability, Cloudflare's managed challenge blocks the request causing timeouts.

The shop config remains in place in case Cloudflare protection changes or a workaround becomes available.

## BoosterPoint

- **Shop ID**: `boosterpoint`
- **URL**: https://boosterpoint.pl
- **Reason**: Website is very slow and has limited product inventory

## LofiCards

- **Shop ID**: `loficards`
- **URL**: https://loficards.pl
- **Reason**: Does not carry products from the watchlist
