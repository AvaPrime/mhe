#!/usr/bin/env python3
"""
MHE CLI — v0.3.0

Typer-based CLI for the Memory Harvester Engine.

What's new in v0.3.0 (focused, high-impact UX & reliability)
- **Specific error handling** for connection/timeout/auth/http failures with actionable messages.
- **Config validation** in `HttpConfig.__post_init__` (URL scheme, positive timeouts).
- **Health & Rate commands**: `ingest health` (CI-friendly exit codes) and `ingest rate` (windowed via /metrics timestamps).
- **Tail command**: `ingest tail` for real-time ingestion monitoring (polling; no busy loops).
- **Prometheus parser**: consolidated, handles escaped labels, NaN/Inf/scientific notation, optional sample timestamps for true windowing.
- **Stable output**: float-preserving values in JSON/CSV; deterministic columns.

Env Vars
- MHE_BASE_URL (default: http://localhost:8000)
- MHE_API_TOKEN (optional Bearer token)
- MHE_HTTP_TIMEOUT (default: 10)
- MHE_ERROR_RATE_THRESHOLD (default: 0.01 → 1%)
- MHE_TAIL_INTERVAL (default: 2.0 seconds)

"""
from __future__ import annotations
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

import typer

try:
    import requests
    from requests.adapters import HTTPAdapter
    from requests import exceptions as req_exc
    from urllib3.util.retry import Retry
except ImportError:
    typer.echo("[mhe-cli] Missing dependency: requests (pip install requests)", err=True)
    raise typer.Exit(code=2)

app = typer.Typer(add_completion=False, help="MHE developer CLI — Integration Ecosystem scaffold")
ingest_app = typer.Typer(help="Ingestion operations")
app.add_typer(ingest_app, name="ingest")

# -----------------------------
# Utilities & Config
# -----------------------------

DEFAULT_BASE_URL = os.getenv("MHE_BASE_URL", "http://localhost:8000").rstrip("/")
API_TOKEN = os.getenv("MHE_API_TOKEN")
DEFAULT_TIMEOUT = float(os.getenv("MHE_HTTP_TIMEOUT", "10"))
ERROR_RATE_THRESHOLD = float(os.getenv("MHE_ERROR_RATE_THRESHOLD", "0.01"))
TAIL_INTERVAL = float(os.getenv("MHE_TAIL_INTERVAL", "2.0"))

PROM_HELP_RE = re.compile(r"^# HELP ")
PROM_TYPE_RE = re.compile(r"^# TYPE ")
# name{labels} value [timestamp]
PROM_SAMPLE_RE = re.compile(
    r"^(?P<name>[a-zA-Z_:][a-zA-Z0-9_:]*)\{?(?P<labels>[^}]*)\}?\s+"
    r"(?P<value>NaN|Inf|-Inf|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)"
    r"(?:\s+(?P<ts>\d{9,}))?\s*$"
)

@dataclass
class HttpConfig:
    base_url: str = DEFAULT_BASE_URL
    token: Optional[str] = API_TOKEN
    timeout: float = DEFAULT_TIMEOUT
    retries: int = 3
    backoff_factor: float = 0.25

    def __post_init__(self):
        if not self.base_url.startswith(("http://", "https://")):
            raise typer.BadParameter(f"Invalid URL: {self.base_url}")
        if self.timeout <= 0:
            raise typer.BadParameter("Timeout must be positive")

class ApiClient:
    def __init__(self, cfg: HttpConfig):
        self.cfg = cfg
        self.session = requests.Session()
        retry = Retry(
            total=cfg.retries,
            read=cfg.retries,
            connect=cfg.retries,
            backoff_factor=cfg.backoff_factor,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET", "POST"),
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def _headers(self) -> Dict[str, str]:
        h = {"User-Agent": "mhe-cli/0.3.0"}
        if self.cfg.token:
            h["Authorization"] = f"Bearer {self.cfg.token}"
        return h

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> requests.Response:
        url = urljoin(self.cfg.base_url + "/", path.lstrip("/"))
        return self.session.get(url, headers=self._headers(), params=params or {}, timeout=self.cfg.timeout)

    def post(self, path: str, json_body: Dict[str, Any]) -> requests.Response:
        url = urljoin(self.cfg.base_url + "/", path.lstrip("/"))
        return self.session.post(url, headers=self._headers(), json=json_body, timeout=self.cfg.timeout)

# -----------------------------
# Time helpers
# -----------------------------

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def parse_since(since: Optional[str]) -> Optional[datetime]:
    if not since:
        return None
    s = since.strip()
    low = s.lower()
    if low.endswith("h") and low[:-1].isdigit():
        return _now_utc() - timedelta(hours=int(low[:-1]))
    if low.endswith("d") and low[:-1].isdigit():
        return _now_utc() - timedelta(days=int(low[:-1]))
    if low.endswith("w") and low[:-1].isdigit():
        return _now_utc() - timedelta(weeks=int(low[:-1]))
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        raise typer.BadParameter("Use '24h'|'7d'|'2w' or ISO-8601, e.g., 2025-09-01T00:00:00Z")

# -----------------------------
# Prometheus parsing (single path)
# -----------------------------

def _coerce_value(tok: str) -> float:
    if tok == "NaN":
        return float("nan")
    if tok == "Inf":
        return float("inf")
    if tok == "-Inf":
        return float("-inf")
    return float(tok)

def _parse_labels(raw: str) -> Dict[str, str]:
    labels: Dict[str, str] = {}
    i = 0
    n = len(raw)
    while i < n:
        while i < n and raw[i] in ", \t":
            i += 1
        if i >= n:
            break
        k_start = i
        while i < n and raw[i] != "=":
            i += 1
        if i >= n or raw[i] != "=":
            break
        key = raw[k_start:i]
        i += 1
        if i >= n or raw[i] != '"':
            break
        i += 1
        val_chars: List[str] = []
        while i < n:
            ch = raw[i]
            if ch == '\\':
                i += 1
                if i < n:
                    val_chars.append(raw[i]); i += 1
                continue
            if ch == '"':
                i += 1
                break
            val_chars.append(ch); i += 1
        labels[key] = "".join(val_chars)
        while i < n and raw[i] in ", \t":
            i += 1
    return labels

def parse_prometheus_text(text: str, since: Optional[datetime] = None) -> List[Tuple[str, Dict[str, str], float, Optional[int]]]:
    rows: List[Tuple[str, Dict[str, str], float, Optional[int]]] = []
    since_ms = int(since.timestamp() * 1000) if since else None
    for line in text.splitlines():
        if not line or PROM_HELP_RE.match(line) or PROM_TYPE_RE.match(line):
            continue
        m = PROM_SAMPLE_RE.match(line)
        if not m:
            continue
        name = m.group("name")
        labels = _parse_labels(m.group("labels") or "")
        value = _coerce_value(m.group("value"))
        ts_ms: Optional[int] = None
        if m.group("ts") is not None:
            ts_int = int(m.group("ts"))
            ts_ms = ts_int if ts_int > 10_000_000_000 else ts_int * 1000
            if since_ms is not None and ts_ms < since_ms:
                continue
        rows.append((name, labels, value, ts_ms))
    return rows

# -----------------------------
# Output helpers (deterministic)
# -----------------------------

def print_json(obj: Any):
    typer.echo(json.dumps(obj, indent=2, sort_keys=True, default=str))

def print_csv(rows: List[Dict[str, Any]], columns: List[str]):
    if not rows:
        return
    writer = csv.DictWriter(sys.stdout, fieldnames=columns)
    writer.writeheader()
    for r in rows:
        writer.writerow({c: r.get(c, "") for c in columns})

def print_table(rows: List[Dict[str, Any]], columns: List[str]):
    if not rows:
        typer.echo("(no data)")
        return
    widths = {c: max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in columns}
    def line(sep: str = "+"):
        typer.echo(sep + sep.join("-" * (widths[c] + 2) for c in columns) + sep)
    def row(r: Dict[str, Any]):
        typer.echo("|" + "|".join(f" {str(r.get(c, '')):<{widths[c]}} " for c in columns) + "|")
    line(); row({c: c for c in columns}); line()
    for r in rows: row(r)
    line()

# -----------------------------
# Shared helpers for ingest views
# -----------------------------

def _aggregate_metrics(samples: List[Tuple[str, Dict[str, str], float, Optional[int]]]) -> Dict[str, Dict[str, float]]:
    totals: Dict[str, Dict[str, float]] = {"ingest_messages_total": {}, "artifacts_created_total": {}, "redactions_applied_total": {}}
    for name, labels, value, _ in samples:
        if not name.startswith("mhe_"):
            continue
        short = name.replace("mhe_", "")
        if short not in totals:
            continue
        if short == "ingest_messages_total":
            key = f"{labels.get('source','unknown')}:{labels.get('status','unknown')}"
        elif short == "artifacts_created_total":
            key = f"{labels.get('kind','unknown')}:{labels.get('status','unknown')}"
        else:  # redactions_applied_total
            key = f"{labels.get('pattern_type','unknown')}"
        totals[short][key] = totals[short].get(key, 0.0) + (0.0 if str(value)=='nan' else float(value))
    return totals

# -----------------------------
# Commands
# -----------------------------

@ingest_app.command("status")
def ingest_status(
    since: Optional[str] = typer.Option(None, help="Window: '24h'|'7d'|'2w' or ISO-8601"),
    output: str = typer.Option("table", "--format", case_sensitive=False, help="table|json|csv"),
    base_url: str = typer.Option(DEFAULT_BASE_URL, envvar="MHE_BASE_URL"),
    token: Optional[str] = typer.Option(API_TOKEN, envvar="MHE_API_TOKEN"),
    warn_on_fallback: bool = typer.Option(True, help="Warn when using /metrics fallback"),
) -> None:
    cfg = HttpConfig(base_url=base_url, token=token)
    api = ApiClient(cfg)
    window = parse_since(since)

    def format_ts(dt: Optional[datetime]) -> Optional[str]:
        return dt and dt.astimezone(timezone.utc).isoformat()

    params: Dict[str, Any] = {"since": format_ts(window)} if window else {}
    data: Dict[str, Any]
    used_metrics_fallback = False
    try:
        resp = api.get("/ingest/status", params=params)
        resp.raise_for_status()
        data = resp.json()
    except req_exc.ConnectionError:
        typer.echo("ERROR: Cannot connect to MHE. Is the service running?", err=True)
        typer.echo(f"Tried: {base_url}", err=True)
        raise typer.Exit(code=2)
    except req_exc.Timeout:
        typer.echo("ERROR: Request timed out. Service may be overloaded.", err=True)
        raise typer.Exit(code=2)
    except req_exc.HTTPError as e:
        code = e.response.status_code if e.response else 'unknown'
        if code == 401:
            typer.echo("ERROR: Authentication failed. Check MHE_API_TOKEN.", err=True)
        elif code == 503:
            typer.echo("ERROR: Service unavailable. Try again later.", err=True)
        else:
            typer.echo(f"ERROR: HTTP {code} from /ingest/status", err=True)
        used_metrics_fallback = True
    except Exception:
        used_metrics_fallback = True

    if used_metrics_fallback:
        try:
            m = api.get("/metrics"); m.raise_for_status()
            samples = parse_prometheus_text(m.text, since=window)
            totals = _aggregate_metrics(samples)
            data = {
                "window": {"since": format_ts(window), "note": "/metrics snapshot — timestamp-filtered where available"},
                "counts": {"ingest": totals["ingest_messages_total"], "artifacts": totals["artifacts_created_total"], "redactions": totals["redactions_applied_total"]},
                "status": "ok", "source": "metrics", "generated_at": _now_utc().isoformat(),
            }
        except req_exc.RequestException as e:
            typer.echo(f"ERROR: failed to retrieve ingest status via /metrics: {e}", err=True)
            raise typer.Exit(code=2)

    # Rows (stable schema)
    rows: List[Dict[str, Any]] = []
    for key, v in sorted(data.get("counts", {}).get("ingest", {}).items()):
        src, *rest = key.split(":"); status = rest[0] if rest else "unknown"
        rows.append({"metric": "ingest_messages_total", "source": src, "status": status, "value": float(v)})
    for key, v in sorted(data.get("counts", {}).get("artifacts", {}).items()):
        kind, *rest = key.split(":"); status = rest[0] if rest else "unknown"
        rows.append({"metric": "artifacts_created_total", "kind": kind, "status": status, "value": float(v)})
    for key, v in sorted(data.get("counts", {}).get("redactions", {}).items()):
        rows.append({"metric": "redactions_applied_total", "pattern_type": key, "value": float(v)})

    # Error-rate health across ingest+artifacts
    totals_by_metric: Dict[str, float] = {}
    errors_by_metric: Dict[str, float] = {}
    for r in rows:
        metric = r.get("metric", ""); val = float(r.get("value", 0.0))
        totals_by_metric[metric] = totals_by_metric.get(metric, 0.0) + val
        if r.get("status") == "error":
            errors_by_metric[metric] = errors_by_metric.get(metric, 0.0) + val
    error_rates = {m: (errors_by_metric.get(m, 0.0) / v if v else 0.0) for m, v in totals_by_metric.items()}
    degraded = any(error_rates.get(m, 0.0) > ERROR_RATE_THRESHOLD for m in ("ingest_messages_total", "artifacts_created_total"))

    columns = ["metric", "source", "kind", "status", "pattern_type", "value"]
    if output.lower() == "json":
        print_json({"base_url": base_url, **data, "rows": rows, "degraded": degraded, "error_rates": error_rates, "error_rate_threshold": ERROR_RATE_THRESHOLD})
    elif output.lower() == "csv":
        print_csv(rows, columns)
    else:
        typer.echo(f"MHE @ {base_url}")
        if since: typer.echo(f"Window since: {since}")
        print_table(rows, columns)
        typer.echo("Status: DEGRADED" if degraded else "Status: OK")
    raise typer.Exit(code=1 if degraded else 0)

@ingest_app.command("health")
def ingest_health(
    base_url: str = typer.Option(DEFAULT_BASE_URL, envvar="MHE_BASE_URL"),
    token: Optional[str] = typer.Option(API_TOKEN, envvar="MHE_API_TOKEN"),
) -> None:
    """Quick health probe using /health/{live,ready,status}. Exit codes are CI-friendly."""
    cfg = HttpConfig(base_url=base_url, token=token); api = ApiClient(cfg)
    try:
        live = api.get("/health/live"); ready = api.get("/health/ready"); status = api.get("/health/status")
        code = 0
        if live.status_code != 200: typer.echo("live: FAIL", err=True); code = 1
        if ready.status_code != 200: typer.echo("ready: FAIL", err=True); code = 1
        if status.status_code == 200:
            payload = status.json(); typer.echo(json.dumps({"status": payload.get("status")}, indent=2))
            if payload.get("status") in ("degraded", "unhealthy"): code = 1
        else:
            typer.echo("status: UNAVAILABLE", err=True)
            code = 1
        raise typer.Exit(code=code)
    except req_exc.RequestException as e:
        typer.echo(f"ERROR: health probe failed: {e}", err=True)
        raise typer.Exit(code=2)

@ingest_app.command("rate")
def ingest_rate(
    window: str = typer.Option("1h", help="Window '15m'|'1h'|'24h' (metrics must include timestamps)"),
    base_url: str = typer.Option(DEFAULT_BASE_URL, envvar="MHE_BASE_URL"),
    token: Optional[str] = typer.Option(API_TOKEN, envvar="MHE_API_TOKEN"),
) -> None:
    """Show ingestion rate over a window using /metrics sample timestamps (best effort)."""
    cfg = HttpConfig(base_url=base_url, token=token); api = ApiClient(cfg)
    # parse window to timedelta
    m = re.match(r"^(\d+)([smhdw])$", window.strip().lower())
    if not m:
        raise typer.BadParameter("Use '15m'|'1h'|'24h'|'2w'")
    mult = int(m.group(1)); unit = m.group(2)
    td = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days", "w": "weeks"}[unit]
    since = _now_utc() - timedelta(**{td: mult})
    try:
        r = api.get("/metrics"); r.raise_for_status()
        samples = parse_prometheus_text(r.text, since=since)
        totals = _aggregate_metrics(samples)
        # compute total successes+errors for ingest
        ingest_total = sum(v for k, v in totals["ingest_messages_total"].items() if not k.endswith(":error")) + \
                       sum(v for k, v in totals["ingest_messages_total"].items() if k.endswith(":error"))
        rate = ingest_total / max(1.0, (timedelta(**{td: mult}).total_seconds()))
        print_json({"window": window, "since": since.isoformat(), "ingest_rate_per_sec": rate})
        raise typer.Exit(code=0)
    except req_exc.RequestException as e:
        typer.echo(f"ERROR: rate calculation failed: {e}", err=True)
        raise typer.Exit(code=2)

@ingest_app.command("tail")
def ingest_tail(
    base_url: str = typer.Option(DEFAULT_BASE_URL, envvar="MHE_BASE_URL"),
    token: Optional[str] = typer.Option(API_TOKEN, envvar="MHE_API_TOKEN"),
    interval: float = typer.Option(TAIL_INTERVAL, help="Poll interval seconds"),
) -> None:
    """Stream ingestion counters in near real time (polls /metrics and prints deltas)."""
    cfg = HttpConfig(base_url=base_url, token=token); api = ApiClient(cfg)
    last_totals: Optional[Dict[str, Dict[str, float]]] = None
    typer.echo("Press Ctrl+C to stop.")
    try:
        while True:
            r = api.get("/metrics"); r.raise_for_status()
            samples = parse_prometheus_text(r.text)
            totals = _aggregate_metrics(samples)
            if last_totals is not None:
                delta = {
                    m: {k: totals[m].get(k, 0.0) - last_totals[m].get(k, 0.0) for k in set(totals[m]) | set(last_totals[m])}
                    for m in totals
                }
                now = _now_utc().isoformat()
                typer.echo(json.dumps({"at": now, "delta": delta}))
            last_totals = totals
            time.sleep(max(0.2, interval))
    except KeyboardInterrupt:
        typer.echo("(stopped)")
    except req_exc.RequestException as e:
        typer.echo(f"ERROR: tail failed: {e}", err=True)
        raise typer.Exit(code=2)

# -----------------------------
# Entrypoint
# -----------------------------

if __name__ == "__main__":
    app()
