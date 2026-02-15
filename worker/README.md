# CMS Worker

This Cloudflare Worker provides a minimal write API for `data/cms.json` in this repo.

## Endpoints

- `GET /cms` -> reads current CMS JSON from GitHub.
- `POST /cms` -> writes updated CMS JSON to GitHub (auth required).

## Environment

Set in `wrangler.toml` / Cloudflare dashboard:

- `REPO_OWNER` (default: `arrowtoinfinity`)
- `REPO_NAME` (default: `deecarrera.com`)
- `REPO_BRANCH` (default: `main`)
- `CMS_PATH` (default: `data/cms.json`)
- `ALLOWED_ORIGIN` (default: `https://deecarrera.com`)

Secrets:

- `GITHUB_TOKEN` (GitHub fine-grained PAT with contents read/write)
- `ADMIN_KEY` (shared admin bearer key)

## Deploy

```bash
cd worker
wrangler secret put GITHUB_TOKEN
wrangler secret put ADMIN_KEY
wrangler deploy
```

Then configure the deployed Worker URL inside `admin.html` when prompted.
