"""Comprehensive error handling and input validation for Memory Harvester Engine API.

This module provides:
- Custom exception classes with detailed error information
- Input validation utilities with sanitization
- Standardized error response formatting
- Request/response logging and monitoring
- Rate limiting and security validation
"""

from __future__ import annotations
import re
import logging
from typing import Any, Dict, List, Optional, Union, Callable
from datetime import datetime
from functools import wraps
from pydantic import BaseModel, Field, validator
from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.orm.exc import NoResultFound

# Configure logging
logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base API error with structured error information."""
    
    def __init__(
        self,
        message: str,
        error_code: str = "GENERIC_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        field: Optional[str] = None
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        self.field = field
        self.timestamp = datetime.utcnow()
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for JSON response."""
        error_dict = {
            "error": {
                "code": self.error_code,
                "message": self.message,
                "timestamp": self.timestamp.isoformat(),
                "status_code": self.status_code
            }
        }
        
        if self.field:
            error_dict["error"]["field"] = self.field
        
        if self.details:
            error_dict["error"]["details"] = self.details
        
        return error_dict


class ValidationError(APIError):
    """Input validation error."""
    
    def __init__(self, message: str, field: Optional[str] = None, value: Optional[Any] = None):
        details = {}
        if value is not None:
            # Truncate long values and sanitize for logging
            details["invalid_value"] = str(value)[:100] if len(str(value)) > 100 else str(value)
        
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=400,
            details=details,
            field=field
        )


class AuthenticationError(APIError):
    """Authentication/authorization error."""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_ERROR",
            status_code=401
        )


class AuthorizationError(APIError):
    """Authorization error."""
    
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            status_code=403
        )


class NotFoundError(APIError):
    """Resource not found error."""
    
    def __init__(self, resource: str, identifier: Optional[str] = None):
        message = f"{resource} not found"
        if identifier:
            message += f" (ID: {identifier})"
        
        super().__init__(
            message=message,
            error_code="NOT_FOUND",
            status_code=404,
            details={"resource": resource, "identifier": identifier} if identifier else {"resource": resource}
        )


class RateLimitError(APIError):
    """Rate limit exceeded error."""
    
    def __init__(self, limit: int, window: str, retry_after: Optional[int] = None):
        message = f"Rate limit exceeded: {limit} requests per {window}"
        details = {"limit": limit, "window": window}
        if retry_after:
            details["retry_after_seconds"] = retry_after
        
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details=details
        )


class DatabaseError(APIError):
    """Database operation error."""
    
    def __init__(self, message: str, operation: Optional[str] = None):
        details = {}
        if operation:
            details["operation"] = operation
        
        super().__init__(
            message=message,
            error_code="DATABASE_ERROR",
            status_code=500,
            details=details
        )


class ExternalServiceError(APIError):
    """External service error (LLM, embedding service, etc.)."""
    
    def __init__(self, service: str, message: str, upstream_error: Optional[str] = None):
        details = {"service": service}
        if upstream_error:
            details["upstream_error"] = upstream_error
        
        super().__init__(
            message=f"{service} error: {message}",
            error_code="EXTERNAL_SERVICE_ERROR",
            status_code=502,
            details=details
        )


class InputValidator:
    """Comprehensive input validation with sanitization."""
    
    # Security patterns
    SQL_INJECTION_PATTERNS = [
        r"('|(\-\-)|(;)|(\||\|)|(\*|\*))",
        r"(union|select|insert|delete|update|drop|create|alter|exec|execute)",
        r"(script|javascript|vbscript|onload|onerror|onclick)"
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>.*?</iframe>"
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e%2f",
        r"%2e%2e%5c"
    ]
    
    # Limits
    MAX_STRING_LENGTH = 10000
    MAX_LIST_LENGTH = 1000
    MAX_DICT_KEYS = 100
    MAX_QUERY_LENGTH = 500
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    @classmethod
    def validate_string(
        cls,
        value: str,
        field_name: str,
        min_length: int = 0,
        max_length: Optional[int] = None,
        allow_empty: bool = True,
        pattern: Optional[str] = None,
        sanitize: bool = True
    ) -> str:
        """Validate and sanitize string input."""
        if not isinstance(value, str):
            raise ValidationError(f"{field_name} must be a string", field=field_name, value=value)
        
        if not allow_empty and not value.strip():
            raise ValidationError(f"{field_name} cannot be empty", field=field_name)
        
        if len(value) < min_length:
            raise ValidationError(
                f"{field_name} must be at least {min_length} characters",
                field=field_name,
                value=value
            )
        
        max_len = max_length or cls.MAX_STRING_LENGTH
        if len(value) > max_len:
            raise ValidationError(
                f"{field_name} must be at most {max_len} characters",
                field=field_name,
                value=value
            )
        
        if pattern and not re.match(pattern, value):
            raise ValidationError(
                f"{field_name} format is invalid",
                field=field_name,
                value=value
            )
        
        if sanitize:
            value = cls.sanitize_string(value, field_name)
        
        return value
    
    @classmethod
    def sanitize_string(cls, value: str, field_name: str) -> str:
        """Sanitize string to prevent injection attacks."""
        # Check for SQL injection patterns
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                logger.warning(f"Potential SQL injection attempt in {field_name}: {value[:100]}")
                raise ValidationError(
                    f"{field_name} contains potentially malicious content",
                    field=field_name
                )
        
        # Check for XSS patterns
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                logger.warning(f"Potential XSS attempt in {field_name}: {value[:100]}")
                raise ValidationError(
                    f"{field_name} contains potentially malicious content",
                    field=field_name
                )
        
        # Check for path traversal
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                logger.warning(f"Potential path traversal attempt in {field_name}: {value[:100]}")
                raise ValidationError(
                    f"{field_name} contains invalid path characters",
                    field=field_name
                )
        
        # Basic HTML entity encoding for safety
        value = value.replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;")
        
        return value.strip()
    
    @classmethod
    def validate_integer(
        cls,
        value: Any,
        field_name: str,
        min_value: Optional[int] = None,
        max_value: Optional[int] = None
    ) -> int:
        """Validate integer input."""
        try:
            int_value = int(value)
        except (ValueError, TypeError):
            raise ValidationError(f"{field_name} must be an integer", field=field_name, value=value)
        
        if min_value is not None and int_value < min_value:
            raise ValidationError(
                f"{field_name} must be at least {min_value}",
                field=field_name,
                value=value
            )
        
        if max_value is not None and int_value > max_value:
            raise ValidationError(
                f"{field_name} must be at most {max_value}",
                field=field_name,
                value=value
            )
        
        return int_value
    
    @classmethod
    def validate_float(
        cls,
        value: Any,
        field_name: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None
    ) -> float:
        """Validate float input."""
        try:
            float_value = float(value)
        except (ValueError, TypeError):
            raise ValidationError(f"{field_name} must be a number", field=field_name, value=value)
        
        if min_value is not None and float_value < min_value:
            raise ValidationError(
                f"{field_name} must be at least {min_value}",
                field=field_name,
                value=value
            )
        
        if max_value is not None and float_value > max_value:
            raise ValidationError(
                f"{field_name} must be at most {max_value}",
                field=field_name,
                value=value
            )
        
        return float_value
    
    @classmethod
    def validate_list(
        cls,
        value: Any,
        field_name: str,
        max_length: Optional[int] = None,
        item_validator: Optional[Callable] = None
    ) -> List[Any]:
        """Validate list input."""
        if not isinstance(value, list):
            raise ValidationError(f"{field_name} must be a list", field=field_name, value=value)
        
        max_len = max_length or cls.MAX_LIST_LENGTH
        if len(value) > max_len:
            raise ValidationError(
                f"{field_name} must contain at most {max_len} items",
                field=field_name,
                value=f"List with {len(value)} items"
            )
        
        if item_validator:
            validated_items = []
            for i, item in enumerate(value):
                try:
                    validated_items.append(item_validator(item))
                except ValidationError as e:
                    raise ValidationError(
                        f"{field_name}[{i}]: {e.message}",
                        field=f"{field_name}[{i}]",
                        value=item
                    )
            return validated_items
        
        return value
    
    @classmethod
    def validate_dict(
        cls,
        value: Any,
        field_name: str,
        max_keys: Optional[int] = None,
        required_keys: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Validate dictionary input."""
        if not isinstance(value, dict):
            raise ValidationError(f"{field_name} must be a dictionary", field=field_name, value=value)
        
        max_k = max_keys or cls.MAX_DICT_KEYS
        if len(value) > max_k:
            raise ValidationError(
                f"{field_name} must contain at most {max_k} keys",
                field=field_name,
                value=f"Dict with {len(value)} keys"
            )
        
        if required_keys:
            missing_keys = [key for key in required_keys if key not in value]
            if missing_keys:
                raise ValidationError(
                    f"{field_name} missing required keys: {', '.join(missing_keys)}",
                    field=field_name,
                    value=list(value.keys())
                )
        
        return value
    
    @classmethod
    def validate_search_query(cls, query: str) -> str:
        """Validate search query with specific rules."""
        query = cls.validate_string(
            query,
            "search_query",
            min_length=1,
            max_length=cls.MAX_QUERY_LENGTH,
            allow_empty=False
        )
        
        # Additional search-specific validation
        if len(query.split()) > 50:  # Limit number of search terms
            raise ValidationError(
                "Search query contains too many terms (max 50)",
                field="search_query",
                value=query
            )
        
        return query


def handle_api_errors(func: Callable) -> Callable:
    """Decorator to handle API errors and convert them to proper HTTP responses."""
    
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        
        except APIError as e:
            logger.error(f"API Error in {func.__name__}: {e.message}", extra=e.details)
            return JSONResponse(
                status_code=e.status_code,
                content=e.to_dict()
            )
        
        except ValidationError as e:
            logger.warning(f"Validation Error in {func.__name__}: {e.message}")
            return JSONResponse(
                status_code=e.status_code,
                content=e.to_dict()
            )
        
        except SQLAlchemyError as e:
            logger.error(f"Database Error in {func.__name__}: {str(e)}")
            db_error = DatabaseError(
                "Database operation failed",
                operation=func.__name__
            )
            return JSONResponse(
                status_code=db_error.status_code,
                content=db_error.to_dict()
            )
        
        except Exception as e:
            logger.error(f"Unexpected Error in {func.__name__}: {str(e)}", exc_info=True)
            generic_error = APIError(
                "An unexpected error occurred",
                error_code="INTERNAL_ERROR",
                status_code=500
            )
            return JSONResponse(
                status_code=generic_error.status_code,
                content=generic_error.to_dict()
            )
    
    return wrapper


class ErrorResponse(BaseModel):
    """Standardized error response model."""
    
    error: Dict[str, Any] = Field(..., description="Error details")
    
    class Config:
        schema_extra = {
            "example": {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input provided",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "status_code": 400,
                    "field": "search_query",
                    "details": {
                        "invalid_value": "<script>alert('xss')</script>"
                    }
                }
            }
        }


def create_error_handler_middleware():
    """Create middleware for global error handling."""
    
    async def error_handler_middleware(request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        
        except HTTPException as e:
            # Let FastAPI handle its own HTTP exceptions
            raise e
        
        except APIError as e:
            logger.error(f"API Error: {e.message}", extra=e.details)
            return JSONResponse(
                status_code=e.status_code,
                content=e.to_dict()
            )
        
        except Exception as e:
            logger.error(f"Unhandled Error: {str(e)}", exc_info=True)
            generic_error = APIError(
                "An unexpected error occurred",
                error_code="INTERNAL_ERROR",
                status_code=500
            )
            return JSONResponse(
                status_code=generic_error.status_code,
                content=generic_error.to_dict()
            )
    
    return error_handler_middleware


# Utility functions for common validations

def validate_pagination(offset: int, limit: int) -> tuple[int, int]:
    """Validate pagination parameters."""
    offset = InputValidator.validate_integer(offset, "offset", min_value=0)
    limit = InputValidator.validate_integer(limit, "limit", min_value=1, max_value=100)
    return offset, limit


def validate_date_range(date_from: Optional[datetime], date_to: Optional[datetime]) -> tuple[Optional[datetime], Optional[datetime]]:
    """Validate date range parameters."""
    if date_from and date_to and date_from > date_to:
        raise ValidationError(
            "date_from must be before date_to",
            field="date_range",
            value=f"{date_from} to {date_to}"
        )
    
    # Check for reasonable date ranges (not too far in the past or future)
    now = datetime.utcnow()
    max_past = datetime(2020, 1, 1)  # Reasonable minimum date
    max_future = datetime(now.year + 1, 12, 31)  # One year in the future
    
    if date_from and date_from < max_past:
        raise ValidationError(
            f"date_from cannot be before {max_past.date()}",
            field="date_from",
            value=date_from
        )
    
    if date_to and date_to > max_future:
        raise ValidationError(
            f"date_to cannot be after {max_future.date()}",
            field="date_to",
            value=date_to
        )
    
    return date_from, date_to


def validate_assistant_filter(assistant_filter: Optional[List[str]]) -> Optional[List[str]]:
    """Validate assistant filter list."""
    if assistant_filter is None:
        return None
    
    validated_filter = InputValidator.validate_list(
        assistant_filter,
        "assistant_filter",
        max_length=20,  # Reasonable limit on number of assistants
        item_validator=lambda x: InputValidator.validate_string(
            x, "assistant_name", min_length=1, max_length=100
        )
    )
    
    return validated_filter