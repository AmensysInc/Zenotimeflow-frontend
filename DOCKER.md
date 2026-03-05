# Docker deployment (Linux VPS)

Deploy Zeno Time Flow (frontend + backend + MySQL + Redis) using Docker Compose.

## Layout

- **zeno-time-flow** (this repo): frontend (Vite/React) + `docker-compose.yml`
- **zeno-time-backend**: Django API (sibling directory)

Both must be present. Example:

```
your-project/
├── zeno-time-flow/      # this repo (run compose here)
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env
└── zeno-time-backend/
    ├── Dockerfile
    ├── entrypoint.sh
    └── ...
```

## Steps on Linux VPS

1. **Install Docker and Docker Compose**
   - Docker Engine: https://docs.docker.com/engine/install/
   - Compose V2: usually included with Docker Desktop or `docker compose` plugin

2. **Clone both repos (as siblings)**
   ```bash
   git clone <zeno-time-flow-repo> zeno-time-flow
   git clone <zeno-time-backend-repo> zeno-time-backend
   cd zeno-time-flow
   ```

3. **Configure environment**
   ```bash
   cp .env.docker.example .env
   # Edit .env: set SECRET_KEY, DB_PASSWORD, MYSQL_ROOT_PASSWORD, etc.
   ```

4. **Build and run**
   ```bash
   docker compose up -d --build
   ```

5. **Open the app**
   - App: http://localhost (port 80)
   - API is at `/api/` (proxied to backend)

6. **Create superuser (optional)**
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

## Services

| Service   | Image / build        | Port  | Notes                          |
|----------|----------------------|------|--------------------------------|
| frontend | zeno-time-flow       | 80   | Nginx serves SPA + proxies /api |
| backend  | zeno-time-backend    | -    | Gunicorn (internal 8000)       |
| mysql    | mysql:8.0            | -    | DB for Django                  |
| redis    | redis:7-alpine       | -    | Channels / cache               |

## Env vars (backend)

Set in `.env` (and optionally override in `docker-compose.yml`):

- `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`
- `DB_HOST` / `REDIS_HOST` are set by Compose to `mysql` and `redis`

## Production

- Set `DEBUG=False` and a strong `SECRET_KEY` in `.env`.
- Set `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` to your domain(s).
- Put a reverse proxy (e.g. Nginx or Caddy) in front of the frontend container for HTTPS and your domain.
