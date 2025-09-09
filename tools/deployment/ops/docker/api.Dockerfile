FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml README-START.md /app/
COPY src /app/src
ENV PYTHONPATH=/app/src
RUN pip install --no-cache-dir -e .
EXPOSE 8000
CMD ["uvicorn", "mhe.access.api:app", "--host", "0.0.0.0", "--port", "8000"]
