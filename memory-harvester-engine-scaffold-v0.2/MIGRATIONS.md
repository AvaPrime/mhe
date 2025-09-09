# Alembic Migrations

## Initialize
```bash
alembic init -t async alembic
```

This scaffold already includes an `alembic/` folder and an `env.py` wired to the SQLAlchemy metadata.

## Configure URL
Set `MHE_DB_*` in `.env`, then verify `alembic.ini` or the env loader in `alembic/env.py`.

## Generate initial migration
```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

> Note: during early development, you can bootstrap tables with `python -m mhe.access.api --init-db`. Prefer Alembic for shared environments.
