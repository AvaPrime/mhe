"""Comprehensive test suite for Claude Parser with fixtures and pytest configuration.

This module provides extensive test coverage for all components of the Claude parser,
including edge cases, error conditions, and performance scenarios.
"""

import pytest
import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any
from unittest.mock import Mock, patch, mock_open

from claude_parser_complete import (
    ClaudeParser,
    ParsedMessage,
    ParsedArtifact,
    ParseResult,
    OptimizedRegexPatterns,
    InputValidator,
    TimestampParser,
    ClaudeParserError,
    ValidationError,
    TimestampError
)


class TestFixtures:
    """Test fixtures and sample data for Claude parser tests."""
    
    @staticmethod
    def sample_claude_export() -> Dict[str, Any]:
        """Generate a sample Claude export JSON structure."""
        return {
            "messages": [
                {
                    "id": "msg_001",
                    "role": "user",
                    "content": "Hello, can you help me with Python?",
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-15T10:30:00Z"
                },
                {
                    "id": "msg_002",
                    "role": "assistant",
                    "content": "Of course! Here's a simple Python example:\n\n```python\ndef hello_world():\n    print('Hello, World!')\n\nhello_world()\n```\n\nThis function prints a greeting message.",
                    "created_at": "2024-01-15T10:30:15Z",
                    "updated_at": "2024-01-15T10:30:15Z"
                },
                {
                    "id": "msg_003",
                    "role": "user",
                    "content": "Can you create a web component?",
                    "created_at": "2024-01-15T10:31:00Z",
                    "updated_at": "2024-01-15T10:31:00Z"
                },
                {
                    "id": "msg_004",
                    "role": "assistant",
                    "content": "<thinking>\nThe user wants a web component. I should create a simple but functional example.\n</thinking>\n\nHere's a custom web component:\n\n<artifact identifier=\"button-component\" type=\"text/html\" title=\"Custom Button Component\">\n<!DOCTYPE html>\n<html>\n<head>\n    <title>Custom Button</title>\n</head>\n<body>\n    <custom-button>Click me!</custom-button>\n    \n    <script>\n    class CustomButton extends HTMLElement {\n        constructor() {\n            super();\n            this.addEventListener('click', this.handleClick);\n        }\n        \n        handleClick() {\n            alert('Button clicked!');\n        }\n    }\n    \n    customElements.define('custom-button', CustomButton);\n    </script>\n</body>\n</html>\n</artifact>\n\nThis creates a reusable custom button element.",
                    "created_at": "2024-01-15T10:31:30Z",
                    "updated_at": "2024-01-15T10:31:30Z"
                }
            ],
            "conversation_id": "conv_12345",
            "title": "Python and Web Development Help",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:31:30Z"
        }
    
    @staticmethod
    def malformed_export() -> Dict[str, Any]:
        """Generate a malformed Claude export for error testing."""
        return {
            "messages": [
                {
                    "id": "msg_001",
                    "role": "invalid_role",  # Invalid role
                    "content": None,  # Invalid content
                    "created_at": "invalid_date"  # Invalid timestamp
                }
            ]
        }
    
    @staticmethod
    def large_content_export() -> Dict[str, Any]:
        """Generate export with large content for performance testing."""
        large_content = "A" * 10000  # 10KB of content
        return {
            "messages": [
                {
                    "id": f"msg_{i:03d}",
                    "role": "user" if i % 2 == 0 else "assistant",
                    "content": f"Message {i}: {large_content}",
                    "created_at": f"2024-01-15T10:{30 + i}:00Z"
                }
                for i in range(100)
            ]
        }


@pytest.fixture
def parser():
    """Create a ClaudeParser instance for testing."""
    return ClaudeParser(strict_mode=True, enable_logging=False)


@pytest.fixture
def sample_export():
    """Provide sample Claude export data."""
    return TestFixtures.sample_claude_export()


@pytest.fixture
def temp_json_file(sample_export):
    """Create a temporary JSON file with sample export data."""
    import tempfile
    import os
    
    # Create temp file
    fd, temp_path_str = tempfile.mkstemp(suffix='.json', text=True)
    temp_path = Path(temp_path_str)
    
    try:
        # Write data to file
        with os.fdopen(fd, 'w') as f:
            json.dump(sample_export, f, indent=2)
        
        yield temp_path
    finally:
        # Cleanup
        try:
            if temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass  # Ignore cleanup errors


@pytest.fixture
def malformed_export():
    """Provide malformed export data for error testing."""
    return TestFixtures.malformed_export()


class TestClaudeParser:
    """Test cases for the main ClaudeParser class."""
    
    def test_parser_initialization(self):
        """Test parser initialization with different configurations."""
        # Default configuration
        parser = ClaudeParser()
        assert parser.strict_mode is True
        assert parser.max_retries == 3
        assert parser.enable_logging is True
        
        # Custom configuration
        parser = ClaudeParser(strict_mode=False, max_retries=5, enable_logging=False)
        assert parser.strict_mode is False
        assert parser.max_retries == 5
        assert parser.enable_logging is False
    
    def test_parse_export_success(self, parser, sample_export):
        """Test successful parsing of valid export data."""
        result = parser.parse_export(sample_export)
        
        assert result.success is True
        assert len(result.data) == 4  # 4 messages in sample
        assert result.error is None
        
        # Check first message
        first_msg = result.data[0]
        assert first_msg.role == "user"
        assert "Python" in first_msg.content
        assert first_msg.id == "msg_001"
    
    def test_parse_export_with_artifacts(self, parser, sample_export):
        """Test parsing messages with artifacts."""
        result = parser.parse_export(sample_export)
        
        # Find message with artifact
        artifact_msg = None
        for msg in result.data:
            if msg.artifacts:
                artifact_msg = msg
                break
        
        assert artifact_msg is not None
        assert len(artifact_msg.artifacts) == 1
        
        artifact = artifact_msg.artifacts[0]
        assert artifact.type == "code"
        assert artifact.title == "Code Block (python)"
        assert "def" in artifact.content or "import" in artifact.content
    
    def test_parse_export_file(self, parser, temp_json_file):
        """Test parsing from file path."""
        result = parser.parse_export(str(temp_json_file))
        
        assert result.success is True
        assert len(result.data) == 4
    
    def test_parse_export_invalid_file(self, parser):
        """Test parsing non-existent file."""
        result = parser.parse_export("non_existent_file.json")
        assert result.success is False
        assert "not found" in result.error.lower() or "no such file" in result.error.lower() or "invalid json" in result.error.lower()
    
    def test_parse_export_malformed_data(self, parser, malformed_export):
        """Test parsing malformed export data."""
        result = parser.parse_export(malformed_export)
        
        assert result.success is False
        assert result.error is not None
        assert "invalid_role" in result.error or "Invalid role" in result.error
    
    def test_stats_tracking(self, parser, sample_export):
        """Test statistics tracking during parsing."""
        initial_stats = parser.get_stats()
        assert initial_stats['messages_parsed'] == 0
        
        parser.parse_export(sample_export)
        
        final_stats = parser.get_stats()
        assert final_stats['messages_parsed'] == 4
        assert final_stats['artifacts_extracted'] == 2
    
    def test_stats_reset(self, parser, sample_export):
        """Test statistics reset functionality."""
        parser.parse_export(sample_export)
        assert parser.get_stats()['messages_parsed'] > 0
        
        parser.reset_stats()
        stats = parser.get_stats()
        assert all(value == 0 for value in stats.values())


class TestOptimizedRegexPatterns:
    """Test cases for regex pattern optimization."""
    
    def test_fence_pattern_matching(self):
        """Test code fence pattern matching."""
        patterns = OptimizedRegexPatterns()
        
        # Valid code fence
        content = "```python\nprint('hello')\n```"
        match = patterns.FENCE_PATTERN.search(content)
        assert match is not None
        assert match.group('language') == 'python'
        assert "print('hello')" in match.group('content')
        
        # Fence without language
        content = "```\nsome code\n```"
        match = patterns.FENCE_PATTERN.search(content)
        assert match is not None
        assert match.group('language') is None or match.group('language') == ''
    
    def test_thinking_pattern_matching(self):
        """Test thinking block pattern matching."""
        patterns = OptimizedRegexPatterns()
        
        content = "<thinking>\nThis is my thought process\n</thinking>"
        match = patterns.THINKING_PATTERN.search(content)
        assert match is not None
        assert "thought process" in match.group('content')
    
    def test_artifact_pattern_matching(self):
        """Test artifact pattern matching."""
        patterns = OptimizedRegexPatterns()
        
        content = '<artifact identifier="test" type="text/html">\n<h1>Hello</h1>\n</artifact>'
        match = patterns.ARTIFACT_PATTERN.search(content)
        assert match is not None
        assert 'identifier="test"' in match.group('attrs')
        assert '<h1>Hello</h1>' in match.group('content')


class TestInputValidator:
    """Test cases for input validation."""
    
    def test_validate_json_structure_valid(self, sample_export):
        """Test validation of valid JSON structure."""
        validator = InputValidator()
        result = validator.validate_json_structure(sample_export)
        
        assert result.success is True
        assert result.error is None
    
    def test_validate_json_structure_invalid(self):
        """Test validation of invalid JSON structure."""
        validator = InputValidator()
        
        # Missing messages field
        invalid_data = {"conversation_id": "test"}
        result = validator.validate_json_structure(invalid_data)
        assert result.success is False
        assert "messages" in result.error
        
        # Non-dict input
        result = validator.validate_json_structure([])
        assert result.success is False
        assert "JSON object" in result.error
    
    def test_validate_message_valid(self):
        """Test validation of valid message."""
        validator = InputValidator()
        
        valid_message = {
            "id": "msg_001",
            "role": "user",
            "content": "Hello world",
            "created_at": "2024-01-15T10:30:00Z"
        }
        
        result = validator.validate_message(valid_message, 0)
        assert result.success is True
    
    def test_validate_message_invalid_role(self):
        """Test validation of message with invalid role."""
        validator = InputValidator()
        
        invalid_message = {
            "id": "msg_001",
            "role": "invalid_role",
            "content": "Hello world",
            "created_at": "2024-01-15T10:30:00Z"
        }
        
        result = validator.validate_message(invalid_message, 0)
        assert result.success is False
        assert "role" in result.error
    
    def test_sanitize_content(self):
        """Test content sanitization."""
        validator = InputValidator()
        
        # Content with control characters
        dirty_content = "Hello\x00\x01World\x7F"
        clean_content = validator.sanitize_content(dirty_content)
        assert "\x00" not in clean_content
        assert "\x01" not in clean_content
        assert "\x7F" not in clean_content
        assert "HelloWorld" in clean_content


class TestTimestampParser:
    """Test cases for timestamp parsing."""
    
    def test_parse_iso_timestamp(self):
        """Test parsing ISO format timestamps."""
        parser = TimestampParser()
        
        timestamp_str = "2024-01-15T10:30:00Z"
        result = parser.parse_timestamp(timestamp_str)
        
        assert isinstance(result, datetime)
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15
        assert result.hour == 10
        assert result.minute == 30
    
    def test_parse_unix_timestamp(self):
        """Test parsing Unix timestamps."""
        parser = TimestampParser()
        
        # Unix timestamp for 2024-01-15T10:30:00Z
        unix_timestamp = 1705316200
        result = parser.parse_timestamp(unix_timestamp)
        
        assert isinstance(result, datetime)
        assert result.year == 2024
    
    def test_parse_invalid_timestamp(self):
        """Test parsing invalid timestamps."""
        parser = TimestampParser()
        
        with pytest.raises(TimestampError):
            parser.parse_timestamp("invalid_timestamp")
    
    def test_parse_datetime_object(self):
        """Test parsing datetime objects."""
        parser = TimestampParser()
        
        dt = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        result = parser.parse_timestamp(dt)
        
        assert result == dt


class TestErrorHandling:
    """Test cases for error handling and edge cases."""
    
    def test_large_content_handling(self):
        """Test handling of large content."""
        parser = ClaudeParser()
        large_export = TestFixtures.large_content_export()
        
        result = parser.parse_export(large_export)
        assert result.success is True
        assert len(result.data) == 100
    
    def test_empty_messages_list(self, parser):
        """Test handling of empty messages list."""
        empty_export = {"messages": []}
        result = parser.parse_export(empty_export)
        
        assert result.success is True
        assert len(result.data) == 0
    
    def test_missing_optional_fields(self, parser):
        """Test handling of messages with missing optional fields."""
        minimal_export = {
            "messages": [
                {
                    "role": "user",
                    "content": "Hello"
                }
            ]
        }
        
        result = parser.parse_export(minimal_export)
        assert result.success is True
        assert len(result.data) == 1
        
        msg = result.data[0]
        assert msg.role == "user"
        assert msg.content == "Hello"
        assert msg.id is not None  # Should be auto-generated


class TestPerformance:
    """Performance and stress tests."""
    
    @pytest.mark.slow
    def test_large_export_performance(self):
        """Test performance with large export files."""
        parser = ClaudeParser()
        large_export = TestFixtures.large_content_export()
        
        import time
        start_time = time.time()
        result = parser.parse_export(large_export)
        end_time = time.time()
        
        assert result.success is True
        assert (end_time - start_time) < 10.0  # Should complete within 10 seconds
    
    def test_memory_usage(self, parser):
        """Test memory usage during parsing."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # Parse multiple times
        large_export = TestFixtures.large_content_export()
        for _ in range(10):
            parser.parse_export(large_export)
            parser.reset_stats()
        
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (less than 100MB)
        assert memory_increase < 100 * 1024 * 1024


if __name__ == "__main__":
    pytest.main([__file__, "-v"])