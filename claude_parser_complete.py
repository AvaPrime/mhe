"""
Claude Parser - Optimized Implementation Module

A production-ready parser for Claude conversation exports with comprehensive
error handling, optimized regex patterns, type safety, and validation.

Author: Memory Harvester Engine Team
Version: 2.0.0
Compatibility: Claude API v1.x

"""

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import (
    Any, Dict, List, Optional, Union, Tuple, Iterator,
    TypeVar, Generic, Protocol, runtime_checkable, Callable, Set
)
from uuid import uuid4

import typer
from pydantic import BaseModel, ValidationError as PydanticValidationError, validator
from sqlalchemy.orm import Session

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def retry_on_failure(max_retries: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """Decorator to retry functions on failure with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff: Multiplier for delay after each retry
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except RetryableError as e:
                    last_exception = e
                    if attempt < max_retries:
                        logging.warning(
                            f"Attempt {attempt + 1} failed for {func.__name__}: {e}. "
                            f"Retrying in {current_delay:.1f}s..."
                        )
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logging.error(
                            f"All {max_retries + 1} attempts failed for {func.__name__}: {e}"
                        )
                except Exception as e:
                    # Non-retryable errors are raised immediately
                    raise e
            
            # If we get here, all retries failed
            raise last_exception
        return wrapper
    return decorator

# Type definitions
T = TypeVar('T')
MessageDict = Dict[str, Any]
ArtifactDict = Dict[str, Any]
ThreadDict = Dict[str, Any]


class ClaudeParserError(Exception):
    """Base exception for Claude parser errors."""
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.context = context or {}
        self.timestamp = datetime.now(timezone.utc)


class ValidationError(ClaudeParserError):
    """Raised when input validation fails."""
    def __init__(self, message: str, field: Optional[str] = None, value: Optional[Any] = None):
        context = {}
        if field:
            context['field'] = field
        if value is not None:
            context['value'] = str(value)[:100]  # Truncate long values
        super().__init__(message, context)


class ParseError(ClaudeParserError):
    """Raised when parsing operations fail."""
    def __init__(self, message: str, operation: Optional[str] = None, data_type: Optional[str] = None):
        context = {}
        if operation:
            context['operation'] = operation
        if data_type:
            context['data_type'] = data_type
        super().__init__(message, context)


class TimestampError(ClaudeParserError):
    """Raised when timestamp parsing fails."""
    def __init__(self, message: str, timestamp_value: Optional[str] = None):
        context = {}
        if timestamp_value:
            context['timestamp_value'] = str(timestamp_value)[:50]
        super().__init__(message, context)


class RetryableError(ClaudeParserError):
    """Raised when an operation can be retried."""
    def __init__(self, message: str, retry_count: int = 0, max_retries: int = 3):
        super().__init__(message, {'retry_count': retry_count, 'max_retries': max_retries})
        self.retry_count = retry_count
        self.max_retries = max_retries


@runtime_checkable
class Parseable(Protocol):
    """Protocol for parseable content."""
    def parse(self) -> Dict[str, Any]:
        """Parse the content and return structured data."""
        ...


@dataclass(frozen=True)
class ParsedMessage:
    """Immutable data structure for parsed messages."""
    id: str
    role: str
    content: str
    timestamp: datetime
    thread_id: str
    artifacts: List['ParsedArtifact'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self) -> None:
        """Validate message data after initialization."""
        if not self.id or not isinstance(self.id, str):
            raise ValidationError(f"Invalid message ID: {self.id}")
        if self.role not in {'user', 'assistant', 'system'}:
            raise ValidationError(f"Invalid role: {self.role}")
        if not self.content:
            raise ValidationError("Message content cannot be empty")


@dataclass(frozen=True)
class ParsedArtifact:
    """Immutable data structure for parsed artifacts."""
    id: str
    type: str
    title: str
    content: str
    language: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self) -> None:
        """Validate artifact data after initialization."""
        if not self.id or not isinstance(self.id, str):
            raise ValidationError(f"Invalid artifact ID: {self.id}")
        if not self.type:
            raise ValidationError("Artifact type cannot be empty")
        if not self.content:
            raise ValidationError("Artifact content cannot be empty")


@dataclass
class ParseResult(Generic[T]):
    """Generic result container with error handling."""
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    
    @classmethod
    def success_result(cls, data: T) -> 'ParseResult[T]':
        """Create a successful parse result."""
        return cls(success=True, data=data)
    
    @classmethod
    def error_result(cls, error: str) -> 'ParseResult[T]':
        """Create a failed parse result."""
        return cls(success=False, error=error)


class OptimizedRegexPatterns:
    """Optimized regex patterns with minimal backtracking and edge case handling."""
    
    # Optimized fence pattern with atomic grouping and better language detection
    FENCE_PATTERN = re.compile(
        r'^```(?P<language>[a-zA-Z0-9_+-]*+)?\s*\n(?P<content>.*?)\n```\s*$',
        re.MULTILINE | re.DOTALL
    )
    
    # Enhanced thinking block pattern with nested tag handling
    THINKING_PATTERN = re.compile(
        r'<thinking(?:\s[^>]*+)?>\s*(?P<content>(?:[^<]++|<(?!/thinking>))*+)\s*</thinking>',
        re.DOTALL | re.IGNORECASE
    )
    
    # Optimized artifact pattern with possessive quantifiers and attribute validation
    ARTIFACT_PATTERN = re.compile(
        r'<artifact\s+(?P<attrs>(?:[^>]++|(?<=\\)>)*+)>\s*(?P<content>(?:[^<]++|<(?!/artifact>))*+)\s*</artifact>',
        re.DOTALL | re.IGNORECASE
    )
    
    # Enhanced attribute extraction with quote handling
    ATTRIBUTE_PATTERN = re.compile(
        r'(?P<key>[a-zA-Z_][a-zA-Z0-9_-]*+)\s*=\s*(?:["\'](?P<value>(?:[^"\']++|\\["\'])*+)["\']|(?P<unquoted>\S++))',
        re.IGNORECASE
    )
    
    # Comprehensive timestamp patterns with validation
    TIMESTAMP_PATTERNS = [
        re.compile(r'\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?'),
        re.compile(r'\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\s+(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?'),
        re.compile(r'1[0-9]{9,12}')  # Unix timestamp (10-13 digits, starting with 1)
    ]
    
    # Content sanitization patterns
    CONTROL_CHARS_PATTERN = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    EXCESSIVE_WHITESPACE_PATTERN = re.compile(r'\s{3,}')
    
    @classmethod
    def compile_patterns(cls) -> None:
        """Pre-compile all patterns for better performance."""
        # Patterns are already compiled as class attributes
        pass


class InputValidator:
    """Comprehensive input validation with sanitization."""
    
    MAX_CONTENT_SIZE = 50 * 1024 * 1024  # 50MB
    MAX_MESSAGE_COUNT = 100000
    ALLOWED_ROLES = {'user', 'assistant', 'system'}
    
    @classmethod
    def validate_json_structure(cls, data: Any) -> ParseResult[Dict[str, Any]]:
        """Validate basic JSON structure."""
        try:
            if not isinstance(data, dict):
                return ParseResult.error_result("Input must be a JSON object")
            
            if 'messages' not in data:
                return ParseResult.error_result("Missing 'messages' field")
            
            messages = data['messages']
            if not isinstance(messages, list):
                return ParseResult.error_result("'messages' must be a list")
            
            if len(messages) > cls.MAX_MESSAGE_COUNT:
                return ParseResult.error_result(
                    f"Too many messages: {len(messages)} > {cls.MAX_MESSAGE_COUNT}"
                )
            
            return ParseResult.success_result(data)
            
        except Exception as e:
            return ParseResult.error_result(f"JSON validation error: {str(e)}")
    
    @classmethod
    def validate_message(cls, message: Dict[str, Any], index: int) -> ParseResult[Dict[str, Any]]:
        """Validate individual message structure.
        
        Args:
            message: Dictionary containing message data to validate
            index: Zero-based index of the message for error reporting
            
        Returns:
            ParseResult containing the validated message or error information
            
        Note:
            Validates required fields (role, content), role values, and content size limits
        """
        try:
            # Check required fields
            required_fields = ['role', 'content']
            for field in required_fields:
                if field not in message:
                    return ParseResult.error_result(
                        f"Message {index}: Missing required field '{field}'"
                    )
            
            # Validate role
            role = message.get('role', '').lower()
            if role not in cls.ALLOWED_ROLES:
                return ParseResult.error_result(
                    f"Message {index}: Invalid role '{role}'"
                )
            
            # Validate content size
            content = message.get('content', '')
            if isinstance(content, str) and len(content.encode('utf-8')) > cls.MAX_CONTENT_SIZE:
                return ParseResult.error_result(
                    f"Message {index}: Content too large"
                )
            
            return ParseResult.success_result(message)
            
        except Exception as e:
            return ParseResult.error_result(
                f"Message {index} validation error: {str(e)}"
            )
    
    @classmethod
    def sanitize_content(cls, content: str) -> str:
        """Sanitize message content with optimized patterns.
        
        Args:
            content: Raw message content that may contain control characters or malformed text
            
        Returns:
            Sanitized content with normalized line endings and removed control characters
            
        Note:
            Removes control characters, normalizes line endings to \n, and reduces
            excessive whitespace while preserving intentional formatting
        """
        if not isinstance(content, str):
            return str(content)
        
        # Use optimized pattern to remove control characters
        sanitized = OptimizedRegexPatterns.CONTROL_CHARS_PATTERN.sub('', content)
        
        # Normalize line endings
        sanitized = re.sub(r'\r\n', '\n', sanitized)
        sanitized = re.sub(r'\r', '\n', sanitized)
        
        # Reduce excessive whitespace but preserve intentional formatting
        sanitized = OptimizedRegexPatterns.EXCESSIVE_WHITESPACE_PATTERN.sub('  ', sanitized)
        
        return sanitized.strip()


class TimestampParser:
    """Enhanced timestamp parsing with comprehensive format and timezone support."""
    
    # Extended format list with timezone variations
    FORMATS = [
        # ISO 8601 formats with timezone
        '%Y-%m-%dT%H:%M:%S.%f%z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%S.%fZ',
        '%Y-%m-%dT%H:%M:%SZ',
        
        # ISO 8601 formats without timezone
        '%Y-%m-%dT%H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%S',
        
        # Common date-time formats
        '%Y-%m-%d %H:%M:%S.%f %Z',
        '%Y-%m-%d %H:%M:%S %Z',
        '%Y-%m-%d %H:%M:%S.%f',
        '%Y-%m-%d %H:%M:%S',
        
        # Date only formats
        '%Y-%m-%d',
        '%m/%d/%Y %H:%M:%S',
        '%m/%d/%Y',
        '%d/%m/%Y %H:%M:%S',
        '%d/%m/%Y',
        
        # Alternative formats
        '%Y%m%d_%H%M%S',
        '%Y%m%d',
        '%B %d, %Y %H:%M:%S',
        '%B %d, %Y',
    ]
    
    # Common timezone abbreviations to UTC offset mapping
    TIMEZONE_MAP = {
        'UTC': '+0000',
        'GMT': '+0000',
        'EST': '-0500',
        'EDT': '-0400',
        'CST': '-0600',
        'CDT': '-0500',
        'MST': '-0700',
        'MDT': '-0600',
        'PST': '-0800',
        'PDT': '-0700',
    }
    
    @classmethod
    def parse_timestamp(cls, timestamp_str: Union[str, int, float, datetime]) -> datetime:
        """Parse timestamp with comprehensive format and timezone support.
        
        Args:
            timestamp_str: Timestamp in various formats
            
        Returns:
            datetime object with timezone information
            
        Raises:
            TimestampError: If timestamp cannot be parsed
        """
        if not timestamp_str and timestamp_str != 0:
            raise TimestampError("Empty or null timestamp", timestamp_value=str(timestamp_str))
        
        # Handle datetime objects
        if isinstance(timestamp_str, datetime):
            if timestamp_str.tzinfo is None:
                return timestamp_str.replace(tzinfo=timezone.utc)
            return timestamp_str
        
        try:
            # Handle numeric Unix timestamps
            if isinstance(timestamp_str, (int, float)):
                return cls._parse_unix_timestamp(timestamp_str)
            
            # Handle string representations of numbers
            if isinstance(timestamp_str, str):
                # Try to parse as numeric first
                cleaned_str = timestamp_str.strip()
                if cls._is_numeric_timestamp(cleaned_str):
                    return cls._parse_unix_timestamp(float(cleaned_str))
                
                # Preprocess string for better parsing
                processed_str = cls._preprocess_timestamp_string(cleaned_str)
                
                # Try standard formats
                result = cls._try_standard_formats(processed_str)
                if result:
                    return result
                
                # Try dateutil as fallback
                result = cls._try_dateutil_parsing(processed_str)
                if result:
                    return result
            
            raise TimestampError(
                f"Unable to parse timestamp in any known format",
                timestamp_value=str(timestamp_str)[:50]
            )
            
        except TimestampError:
            raise
        except Exception as e:
            raise TimestampError(
                f"Unexpected error parsing timestamp: {e}",
                timestamp_value=str(timestamp_str)[:50]
            )
    
    @classmethod
    def _is_numeric_timestamp(cls, timestamp_str: str) -> bool:
        """Check if string represents a numeric timestamp.
        
        Args:
            timestamp_str: String to check for numeric timestamp format
            
        Returns:
            True if the string can be parsed as a float, False otherwise
        """
        try:
            float(timestamp_str)
            return True
        except ValueError:
            return False
    
    @classmethod
    def _parse_unix_timestamp(cls, timestamp: Union[int, float]) -> datetime:
        """Parse Unix timestamp with automatic unit detection.
        
        Args:
            timestamp: Numeric timestamp (seconds, milliseconds, microseconds, or nanoseconds)
            
        Returns:
            datetime object in UTC timezone
            
        Raises:
            TimestampError: If timestamp is invalid or out of reasonable range
            
        Note:
            Automatically detects timestamp precision based on magnitude and converts to seconds
        """
        try:
            # Handle different timestamp precisions
            if timestamp > 1e12:  # Milliseconds
                timestamp = timestamp / 1000
            elif timestamp > 1e15:  # Microseconds
                timestamp = timestamp / 1e6
            elif timestamp > 1e18:  # Nanoseconds
                timestamp = timestamp / 1e9
            
            # Validate reasonable timestamp range (1970-2100)
            if timestamp < 0 or timestamp > 4102444800:  # 2100-01-01
                raise TimestampError(f"Timestamp out of reasonable range: {timestamp}")
            
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except (ValueError, OSError) as e:
            raise TimestampError(f"Invalid Unix timestamp: {timestamp} - {e}")
    
    @classmethod
    def _preprocess_timestamp_string(cls, timestamp_str: str) -> str:
        """Preprocess timestamp string for better parsing.
        
        Args:
            timestamp_str: Raw timestamp string that may need normalization
            
        Returns:
            Normalized timestamp string with standardized format
            
        Note:
            Replaces timezone abbreviations with offsets, normalizes separators,
            and handles fractional seconds with varying precision
        """
        # Replace timezone abbreviations with offsets
        for tz_abbr, offset in cls.TIMEZONE_MAP.items():
            if timestamp_str.endswith(f' {tz_abbr}'):
                timestamp_str = timestamp_str.replace(f' {tz_abbr}', offset)
                break
        
        # Normalize some common variations
        timestamp_str = timestamp_str.replace('T', ' ').replace('Z', '+0000')
        
        # Handle fractional seconds with varying precision
        import re
        # Normalize fractional seconds to 6 digits
        timestamp_str = re.sub(r'\.(\d{1,6})\d*', r'.\1', timestamp_str)
        
        return timestamp_str
    
    @classmethod
    def _try_standard_formats(cls, timestamp_str: str) -> Optional[datetime]:
        """Try parsing with standard format list.
        
        Args:
            timestamp_str: Preprocessed timestamp string to parse
            
        Returns:
            Parsed datetime object with UTC timezone, or None if no format matches
            
        Note:
            Iterates through predefined format strings and attempts parsing.
            Automatically adds UTC timezone if none is present.
        """
        for fmt in cls.FORMATS:
            try:
                dt = datetime.strptime(timestamp_str, fmt)
                # Add UTC timezone if not present
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue
        return None
    
    @classmethod
    def _try_dateutil_parsing(cls, timestamp_str: str) -> Optional[datetime]:
        """Try parsing with dateutil as fallback."""
        try:
            from dateutil.parser import parse as dateutil_parse
            dt = dateutil_parse(timestamp_str)
            # Ensure timezone is set
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except (ImportError, ValueError):
            return None
            if isinstance(e, TimestampError):
                raise
            raise TimestampError(f"Timestamp parsing error: {str(e)}")


class ClaudeParser:
    """Optimized Claude conversation parser with comprehensive error handling."""
    
    def __init__(self, strict_mode: bool = True, max_retries: int = 3, enable_logging: bool = True) -> None:
        """Initialize parser with configuration options.
        
        Args:
            strict_mode: If True, raise exceptions on validation errors
            max_retries: Maximum number of retry attempts for failed operations
            enable_logging: If True, enable detailed logging
        """
        self.strict_mode: bool = strict_mode
        self.max_retries: int = max_retries
        self.enable_logging: bool = enable_logging
        self.patterns: OptimizedRegexPatterns = OptimizedRegexPatterns()
        self.validator: InputValidator = InputValidator()
        self.timestamp_parser: TimestampParser = TimestampParser()
        self._stats: Dict[str, int] = {
            'messages_parsed': 0,
            'artifacts_extracted': 0,
            'errors_encountered': 0,
            'warnings_generated': 0,
            'retries_attempted': 0,
            'successful_retries': 0
        }
        
        # Configure parser-specific logger
        if self.enable_logging:
            self.logger: logging.Logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        else:
            self.logger: logging.Logger = logging.getLogger('null')
            self.logger.addHandler(logging.NullHandler())
    
    def _load_content(self, content: Union[str, Path]) -> Dict[str, Any]:
        """Load content from file or parse JSON string with enhanced error handling.
        
        Args:
            content: JSON string or path to JSON file
            
        Returns:
            Parsed JSON data
            
        Raises:
            ValidationError: If content cannot be loaded or parsed
            RetryableError: If file reading fails temporarily
        """
        try:
            if isinstance(content, (str, Path)) and Path(content).exists():
                file_path = Path(content)
                self.logger.debug(f"Loading content from file: {file_path}")
                
                # Check file size for memory safety
                file_size = file_path.stat().st_size
                if file_size > 100 * 1024 * 1024:  # 100MB limit
                    raise ValidationError(
                        f"File too large: {file_size / (1024*1024):.1f}MB (max 100MB)",
                        field="file_size"
                    )
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self.logger.debug(f"Successfully loaded {file_size} bytes from file")
                    return data
                except (IOError, OSError) as e:
                    # File I/O errors might be temporary
                    raise RetryableError(f"Failed to read file {file_path}: {e}")
                except UnicodeDecodeError as e:
                    raise ValidationError(f"File encoding error: {e}", field="encoding")
            else:
                # Parse as JSON string
                self.logger.debug("Parsing content as JSON string")
                if isinstance(content, Path):
                    raise ValidationError(f"File not found: {content}", field="file_path")
                
                content_str = str(content)
                if len(content_str) > 50 * 1024 * 1024:  # 50MB limit for strings
                    raise ValidationError(
                        f"Content too large: {len(content_str) / (1024*1024):.1f}MB (max 50MB)",
                        field="content_size"
                    )
                
                return json.loads(content_str)
                
        except json.JSONDecodeError as e:
            raise ValidationError(
                f"Invalid JSON format at line {e.lineno}, column {e.colno}: {e.msg}",
                field="json_syntax"
            )
    
    def _parse_messages_batch(self, messages: List[Dict[str, Any]]) -> List[ParsedMessage]:
        """Parse a batch of messages with comprehensive error handling.
        
        Args:
            messages: List of message dictionaries to parse
            
        Returns:
            List of successfully parsed messages (may be fewer than input if errors occur)
            
        Raises:
            ParseError: If strict_mode is True and any message fails validation
            ValidationError: If strict_mode is True and message structure is invalid
            
        Note:
            In non-strict mode, failed messages are logged as warnings and skipped
        """
        parsed_messages = []
        
        for i, msg_data in enumerate(messages):
            try:
                # Validate individual message
                msg_validation = self.validator.validate_message(msg_data)
                if not msg_validation:
                    error_msg = f"Message {i} validation failed"
                    if self.strict_mode:
                        raise ValidationError(error_msg, field=f"message[{i}]")
                    else:
                        self.logger.warning(error_msg)
                        self._stats['warnings_generated'] += 1
                        continue
                
                # Parse the message
                parsed_msg = self._parse_message(msg_data, i)
                if parsed_msg:
                    parsed_messages.append(parsed_msg)
                    self._stats['messages_parsed'] += 1
                    
                    # Update artifact count
                    self._stats['artifacts_extracted'] += len(parsed_msg.artifacts)
                    
            except (ValidationError, ParseError, TimestampError) as e:
                # Known errors
                error_msg = f"Failed to parse message {i}: {e}"
                self._stats['errors_encountered'] += 1
                
                if self.strict_mode:
                    self.logger.error(error_msg)
                    raise ParseError(error_msg, operation="message_parsing", data_type="message")
                else:
                    self.logger.warning(error_msg)
                    self._stats['warnings_generated'] += 1
                    
            except Exception as e:
                # Unexpected errors
                error_msg = f"Unexpected error parsing message {i}: {e}"
                self._stats['errors_encountered'] += 1
                self.logger.error(error_msg, exc_info=True)
                
                if self.strict_mode:
                    raise ParseError(error_msg, operation="message_parsing")
                else:
                    self._stats['warnings_generated'] += 1
        
        self.logger.info(f"Successfully parsed {len(parsed_messages)} out of {len(messages)} messages")
        return parsed_messages
    
    def get_stats(self) -> Dict[str, int]:
        """Get parsing statistics.
        
        Returns:
            Dictionary containing current parsing statistics including:
            - messages_parsed: Number of successfully parsed messages
            - artifacts_extracted: Number of artifacts found and extracted
            - errors_encountered: Number of errors that occurred
            - warnings_generated: Number of warnings issued
            - retries_attempted: Number of retry operations attempted
            - successful_retries: Number of successful retry operations
        """
        return self._stats.copy()
    
    def reset_stats(self) -> None:
        """Reset parsing statistics.
        
        Note:
            Resets all statistical counters to zero. Useful when reusing
            the same parser instance for multiple parsing operations.
        """
        for key in self._stats:
            self._stats[key] = 0
    
    def parse_export(self, export_data: Union[str, Dict[str, Any]]) -> ParseResult[List[ParsedMessage]]:
        """Parse Claude export data with comprehensive error handling.
        
        Args:
            export_data: JSON string or dictionary containing Claude export
            
        Returns:
            ParseResult containing list of parsed messages or error information
        """
        try:
            # Parse JSON if string provided
            if isinstance(export_data, str):
                try:
                    data = json.loads(export_data)
                except json.JSONDecodeError as e:
                    self._stats['errors_encountered'] += 1
                    return ParseResult.error_result(f"Invalid JSON: {str(e)}")
            else:
                data = export_data
            
            # Validate input structure
            validation_result = self.validator.validate_json_structure(data)
            if not validation_result.success:
                self._stats['errors_encountered'] += 1
                return validation_result
            
            # Extract messages
            messages = data['messages']
            parsed_messages = []
            warnings = []
            
            for i, message_data in enumerate(messages):
                try:
                    # Validate message
                    msg_validation = self.validator.validate_message(message_data, i)
                    if not msg_validation.success:
                        if self.strict_mode:
                            self._stats['errors_encountered'] += 1
                            return ParseResult.error_result(msg_validation.error)
                        else:
                            warnings.append(msg_validation.error)
                            self._stats['warnings_generated'] += 1
                            continue
                    
                    # Parse message
                    parsed_msg = self._parse_message(message_data, i)
                    if parsed_msg:
                        parsed_messages.append(parsed_msg)
                        self._stats['messages_parsed'] += 1
                    
                except Exception as e:
                    error_msg = f"Error parsing message {i}: {str(e)}"
                    if self.strict_mode:
                        self._stats['errors_encountered'] += 1
                        return ParseResult.error_result(error_msg)
                    else:
                        warnings.append(error_msg)
                        self._stats['warnings_generated'] += 1
                        logger.warning(error_msg)
            
            result = ParseResult.success_result(parsed_messages)
            result.warnings = warnings
            return result
            
        except Exception as e:
            self._stats['errors_encountered'] += 1
            return ParseResult.error_result(f"Unexpected error: {str(e)}")
    
    def _parse_message(self, message_data: Dict[str, Any], index: int) -> Optional[ParsedMessage]:
        """Parse individual message with error handling.
        
        Args:
            message_data: Dictionary containing raw message data
            index: Zero-based index of message in the conversation
            
        Returns:
            ParsedMessage object if successful, None if parsing fails in non-strict mode
            
        Raises:
            ParseError: If strict_mode is True and parsing fails
            ValidationError: If message data is invalid and strict_mode is True
            
        Note:
            Extracts artifacts, normalizes timestamps, and enriches with metadata
        """
        try:
            # Extract basic fields
            role = message_data['role'].lower()
            content = self.validator.sanitize_content(message_data.get('content', ''))
            
            # Generate or extract message ID
            msg_id = message_data.get('id', f"msg_{uuid4().hex[:8]}")
            
            # Parse timestamp
            timestamp = self._parse_message_timestamp(message_data)
            
            # Extract thread ID
            thread_id = message_data.get('thread_id', message_data.get('conversation_id', 'default_thread'))
            
            # Extract artifacts
            artifacts = self._extract_artifacts(content)
            
            # Extract metadata
            metadata = {
                'original_index': index,
                'has_artifacts': len(artifacts) > 0,
                'content_length': len(content),
                'processing_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            # Add any additional fields as metadata
            for key, value in message_data.items():
                if key not in {'role', 'content', 'id', 'timestamp', 'created_at', 'thread_id', 'conversation_id'}:
                    metadata[key] = value
            
            return ParsedMessage(
                id=msg_id,
                role=role,
                content=content,
                timestamp=timestamp,
                thread_id=thread_id,
                artifacts=artifacts,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Failed to parse message {index}: {str(e)}")
            if self.strict_mode:
                raise ParseError(f"Message parsing failed: {str(e)}")
            return None
    
    def _parse_message_timestamp(self, message_data: Dict[str, Any]) -> datetime:
        """Parse message timestamp with fallback options.
        
        Args:
            message_data: Dictionary containing message data with potential timestamp fields
            
        Returns:
            Parsed datetime object, defaults to current UTC time if no valid timestamp found
            
        Note:
            Tries multiple common timestamp field names in order of preference
        """
        timestamp_fields: List[str] = ['timestamp', 'created_at', 'date', 'time']
        
        for field in timestamp_fields:
            if field in message_data:
                try:
                    return self.timestamp_parser.parse_timestamp(message_data[field])
                except TimestampError:
                    continue
        
        # Fallback to current time
        logger.warning("No valid timestamp found, using current time")
        return datetime.now(timezone.utc)
    
    def _extract_artifacts(self, content: str) -> List[ParsedArtifact]:
        """Extract artifacts from message content with optimized patterns.
        
        Args:
            content: Raw message content that may contain artifacts and code blocks
            
        Returns:
            List of ParsedArtifact objects found in the content
            
        Raises:
            ParseError: If strict_mode is True and artifact parsing fails
            ValidationError: If artifact structure is invalid and strict_mode is True
            
        Note:
            Extracts both XML-style artifacts and fenced code blocks as artifacts.
            Updates internal statistics for successful extractions.
        """
        artifacts = []
        
        try:
            # Extract artifact blocks
            for match in self.patterns.ARTIFACT_PATTERN.finditer(content):
                try:
                    attrs_str = match.group('attrs')
                    artifact_content = match.group('content').strip()
                    
                    # Parse attributes with enhanced pattern support
                    attributes = {}
                    for attr_match in self.patterns.ATTRIBUTE_PATTERN.finditer(attrs_str):
                        key = attr_match.group('key')
                        # Handle both quoted and unquoted values
                        value = attr_match.group('value') or attr_match.group('unquoted') or ''
                        # Unescape quotes in values
                        if value:
                            value = value.replace('\\"', '"').replace("\\\'", "'")
                        attributes[key] = value
                    
                    # Create artifact
                    artifact_id = attributes.get('identifier', f"artifact_{uuid4().hex[:8]}")
                    artifact_type = attributes.get('type', 'text')
                    title = attributes.get('title', f"Artifact {artifact_id}")
                    language = attributes.get('language')
                    
                    artifact = ParsedArtifact(
                        id=artifact_id,
                        type=artifact_type,
                        title=title,
                        content=artifact_content,
                        language=language,
                        metadata=attributes
                    )
                    
                    artifacts.append(artifact)
                    self._stats['artifacts_extracted'] += 1
                    
                except Exception as e:
                    logger.warning(f"Failed to parse artifact: {str(e)}")
                    if self.strict_mode:
                        raise ParseError(f"Artifact extraction failed: {str(e)}")
            
            # Extract code blocks as artifacts
            for match in self.patterns.FENCE_PATTERN.finditer(content):
                try:
                    language = match.group('language') or 'text'
                    code_content = match.group('content').strip()
                    
                    if code_content:  # Only create artifact if content exists
                        artifact = ParsedArtifact(
                            id=f"code_{uuid4().hex[:8]}",
                            type='code',
                            title=f"Code Block ({language})",
                            content=code_content,
                            language=language,
                            metadata={'extracted_from': 'fence_block'}
                        )
                        
                        artifacts.append(artifact)
                        self._stats['artifacts_extracted'] += 1
                        
                except Exception as e:
                    logger.warning(f"Failed to extract code block: {str(e)}")
                    if self.strict_mode:
                        raise ParseError(f"Code block extraction failed: {str(e)}")
            
        except Exception as e:
            logger.error(f"Artifact extraction error: {str(e)}")
            if self.strict_mode:
                raise
        
        return artifacts
    
    def extract_thinking_blocks(self, content: str) -> List[str]:
        """Extract thinking blocks from content.
        
        Args:
            content: Raw message content that may contain <thinking> blocks
            
        Returns:
            List of thinking block contents (text inside <thinking> tags)
            
        Note:
            Extracts content from XML-style thinking tags, commonly used
            in Claude conversations for internal reasoning
        """
        thinking_blocks = []
        
        try:
            for match in self.patterns.THINKING_PATTERN.finditer(content):
                thinking_content = match.group('content').strip()
                if thinking_content:
                    thinking_blocks.append(thinking_content)
        except Exception as e:
            logger.warning(f"Failed to extract thinking blocks: {str(e)}")
            if self.strict_mode:
                raise ParseError(f"Thinking block extraction failed: {str(e)}")
        
        return thinking_blocks


# CLI Integration
app = typer.Typer(
    name="claude-parser",
    help="Claude conversation parser with advanced features",
    add_completion=False
)


@app.command()
def parse_file(
    file_path: Path = typer.Argument(..., help="Path to Claude export JSON file"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Output file path"),
    strict: bool = typer.Option(True, "--strict/--lenient", help="Enable strict validation mode"),
    stats: bool = typer.Option(False, "--stats", help="Show parsing statistics")
) -> None:
    """Parse Claude export file and optionally save results.
    
    Args:
        file_path: Path to the Claude export JSON file to parse
        output: Optional path to save parsed results as JSON
        strict: Whether to use strict validation mode (raises on errors)
        stats: Whether to display parsing statistics after completion
        
    Raises:
        typer.Exit: If file not found, parsing fails, or validation errors occur
    """
    try:
        # Validate input file
        if not file_path.exists():
            typer.echo(f"Error: File not found: {file_path}", err=True)
            raise typer.Exit(1)
        
        if not file_path.is_file():
            typer.echo(f"Error: Path is not a file: {file_path}", err=True)
            raise typer.Exit(1)
        
        # Read and parse file
        typer.echo(f"Parsing file: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            export_data = f.read()
        
        parser = ClaudeParser(strict_mode=strict)
        result = parser.parse_export(export_data)
        
        if not result.success:
            typer.echo(f"Error: {result.error}", err=True)
            raise typer.Exit(1)
        
        # Display results
        messages = result.data or []
        typer.echo(f"Successfully parsed {len(messages)} messages")
        
        if result.warnings:
            typer.echo(f"Warnings: {len(result.warnings)}")
            for warning in result.warnings:
                typer.echo(f"  - {warning}", err=True)
        
        # Show statistics if requested
        if stats:
            parser_stats = parser.get_stats()
            typer.echo("\nParsing Statistics:")
            for key, value in parser_stats.items():
                typer.echo(f"  {key.replace('_', ' ').title()}: {value}")
        
        # Save output if requested
        if output:
            output_data = {
                'messages': [{
                    'id': msg.id,
                    'role': msg.role,
                    'content': msg.content,
                    'timestamp': msg.timestamp.isoformat(),
                    'thread_id': msg.thread_id,
                    'artifacts': [{
                        'id': art.id,
                        'type': art.type,
                        'title': art.title,
                        'content': art.content,
                        'language': art.language,
                        'metadata': art.metadata
                    } for art in msg.artifacts],
                    'metadata': msg.metadata
                } for msg in messages],
                'statistics': parser.get_stats(),
                'warnings': result.warnings
            }
            
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
            typer.echo(f"Results saved to: {output}")
        
    except Exception as e:
        typer.echo(f"Unexpected error: {str(e)}", err=True)
        raise typer.Exit(1)


@app.command()
def validate(
    file_path: Path = typer.Argument(..., help="Path to Claude export JSON file")
) -> None:
    """Validate Claude export file without full parsing.
    
    Args:
        file_path: Path to the Claude export JSON file to validate
        
    Raises:
        typer.Exit: If file not found, invalid JSON, or validation fails
        
    Note:
        Performs lightweight validation of file structure and message format
        without extracting artifacts or performing full parsing
    """
    try:
        if not file_path.exists():
            typer.echo(f"Error: File not found: {file_path}", err=True)
            raise typer.Exit(1)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        validator = InputValidator()
        result = validator.validate_json_structure(data)
        
        if result.success:
            typer.echo("✓ File structure is valid")
            
            # Validate individual messages
            messages = data.get('messages', [])
            valid_count = 0
            
            for i, message in enumerate(messages):
                msg_result = validator.validate_message(message, i)
                if msg_result.success:
                    valid_count += 1
                else:
                    typer.echo(f"✗ {msg_result.error}", err=True)
            
            typer.echo(f"✓ {valid_count}/{len(messages)} messages are valid")
            
            if valid_count == len(messages):
                typer.echo("✓ All validations passed")
            else:
                raise typer.Exit(1)
        else:
            typer.echo(f"✗ Validation failed: {result.error}", err=True)
            raise typer.Exit(1)
            
    except json.JSONDecodeError as e:
        typer.echo(f"✗ Invalid JSON: {str(e)}", err=True)
        raise typer.Exit(1)
    except Exception as e:
        typer.echo(f"✗ Validation error: {str(e)}", err=True)
        raise typer.Exit(1)


if __name__ == "__main__":
    app()