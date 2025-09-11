"""
Message normalization module.
Converts raw conversation data into standardized event structure.
"""

import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class NormalizedEvent:
    """Standardized event structure for all conversation sources."""
    thread_id: str
    message_id: str  
    author: str
    role: str
    text: str
    timestamp: str  # ISO-8601 format
    tokens: int
    metadata: Dict[str, Any]
    source_hash: str

class MessageNormalizer:
    """Normalizes messages from various conversation sources."""
    
    def __init__(self):
        self.min_text_length = 10  # Minimum characters for meaningful content
        self.supported_authors = ['assistant', 'user']
        
    def normalize_messages(self, raw_messages: List[Dict[str, Any]], 
                          source_metadata: Dict[str, Any]) -> List[NormalizedEvent]:
        """
        Convert raw messages to normalized event structure.
        
        Args:
            raw_messages: List of raw message dictionaries
            source_metadata: Metadata about the source conversation
            
        Returns:
            List of normalized events
        """
        normalized_events = []
        
        for raw_message in raw_messages:
            try:
                event = self._normalize_single_message(raw_message, source_metadata)
                if event and self._is_valid_event(event):
                    normalized_events.append(event)
                    
            except Exception as e:
                logger.warning(f"Error normalizing message {raw_message.get('message_id', 'unknown')}: {e}")
                continue
        
        # Sort by timestamp to ensure chronological order
        normalized_events.sort(key=lambda x: x.timestamp)
        
        logger.info(f"Normalized {len(normalized_events)} events from {len(raw_messages)} raw messages")
        return normalized_events
    
    def _normalize_single_message(self, raw_message: Dict[str, Any], 
                                 source_metadata: Dict[str, Any]) -> Optional[NormalizedEvent]:
        """Normalize a single message to standard format."""
        
        # Extract core fields with validation
        thread_id = raw_message.get('thread_id', source_metadata.get('thread_id', ''))
        message_id = raw_message.get('message_id', str(uuid.uuid4()))
        author = raw_message.get('author', 'unknown')
        role = raw_message.get('role', author)
        text = raw_message.get('text', '').strip()
        
        # Skip if essential fields missing
        if not thread_id or not text:
            return None
            
        # Validate and normalize timestamp
        timestamp = self._normalize_timestamp(raw_message.get('timestamp'))
        if not timestamp:
            logger.warning(f"Invalid timestamp in message {message_id}")
            return None
            
        # Estimate or use provided token count
        tokens = raw_message.get('tokens', self._estimate_tokens(text))
        
        # Build metadata
        metadata = {
            'original_author': raw_message.get('metadata', {}).get('original_author', {}),
            'content_type': raw_message.get('metadata', {}).get('content_type', 'text'),
            'normalized_at': datetime.utcnow().isoformat(),
            'normalizer_version': '1.0.0'
        }
        
        # Add source metadata
        metadata.update({
            'source_title': source_metadata.get('title', ''),
            'source_create_time': source_metadata.get('create_time', ''),
            'source_file': source_metadata.get('source_file', '')
        })
        
        # Generate content hash for integrity
        source_hash = source_metadata.get('source_hash', '')
        
        return NormalizedEvent(
            thread_id=thread_id,
            message_id=message_id,
            author=author,
            role=role,
            text=text,
            timestamp=timestamp,
            tokens=tokens,
            metadata=metadata,
            source_hash=source_hash
        )
    
    def _normalize_timestamp(self, timestamp_value: Any) -> Optional[str]:
        """Normalize timestamp to ISO-8601 format."""
        if not timestamp_value:
            return None
            
        try:
            # Handle Unix timestamp (int/float)
            if isinstance(timestamp_value, (int, float)):
                dt = datetime.fromtimestamp(timestamp_value)
                return dt.isoformat()
                
            # Handle ISO string
            if isinstance(timestamp_value, str):
                # Try parsing as ISO format first
                try:
                    dt = datetime.fromisoformat(timestamp_value.replace('Z', '+00:00'))
                    return dt.isoformat()
                except ValueError:
                    pass
                    
                # Try parsing as Unix timestamp string
                try:
                    timestamp_float = float(timestamp_value)
                    dt = datetime.fromtimestamp(timestamp_float)
                    return dt.isoformat()
                except ValueError:
                    pass
                    
            return None
            
        except Exception as e:
            logger.warning(f"Error normalizing timestamp {timestamp_value}: {e}")
            return None
    
    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count using simple heuristic."""
        # Rough approximation: 4 characters per token
        return max(1, len(text) // 4)
    
    def _is_valid_event(self, event: NormalizedEvent) -> bool:
        """Validate normalized event meets quality standards."""
        
        # Check minimum text length
        if len(event.text) < self.min_text_length:
            return False
            
        # Check author is supported
        if event.author not in self.supported_authors:
            logger.debug(f"Skipping unsupported author: {event.author}")
            return False
            
        # Check required fields are present
        if not all([event.thread_id, event.message_id, event.timestamp]):
            return False
            
        return True
    
    def filter_assistant_only(self, events: List[NormalizedEvent]) -> List[NormalizedEvent]:
        """Filter to keep only assistant-authored messages."""
        assistant_events = [event for event in events if event.author == 'assistant']
        logger.info(f"Filtered to {len(assistant_events)} assistant messages from {len(events)} total")
        return assistant_events
    
    def add_thread_context(self, events: List[NormalizedEvent]) -> List[NormalizedEvent]:
        """Add thread-level context to events."""
        
        # Group events by thread
        threads = {}
        for event in events:
            if event.thread_id not in threads:
                threads[event.thread_id] = []
            threads[event.thread_id].append(event)
        
        enhanced_events = []
        
        for thread_id, thread_events in threads.items():
            # Sort thread events by timestamp
            thread_events.sort(key=lambda x: x.timestamp)
            
            # Add context to each event
            for i, event in enumerate(thread_events):
                # Add position context
                event.metadata['thread_position'] = i + 1
                event.metadata['thread_total'] = len(thread_events)
                event.metadata['is_first_in_thread'] = (i == 0)
                event.metadata['is_last_in_thread'] = (i == len(thread_events) - 1)
                
                # Add surrounding context (previous and next message IDs)
                if i > 0:
                    event.metadata['previous_message_id'] = thread_events[i-1].message_id
                if i < len(thread_events) - 1:
                    event.metadata['next_message_id'] = thread_events[i+1].message_id
                
                enhanced_events.append(event)
        
        return enhanced_events
    
    def to_dict_list(self, events: List[NormalizedEvent]) -> List[Dict[str, Any]]:
        """Convert normalized events to dictionary format for serialization."""
        return [
            {
                'thread_id': event.thread_id,
                'message_id': event.message_id,
                'author': event.author,
                'role': event.role,
                'text': event.text,
                'timestamp': event.timestamp,
                'tokens': event.tokens,
                'metadata': event.metadata,
                'source_hash': event.source_hash
            }
            for event in events
        ]


def create_thread_summary(events: List[NormalizedEvent]) -> Dict[str, Any]:
    """Create thread-level summary from normalized events."""
    
    if not events:
        return {}
    
    # Group by thread
    threads = {}
    for event in events:
        if event.thread_id not in threads:
            threads[event.thread_id] = []
        threads[event.thread_id].append(event)
    
    thread_summaries = {}
    
    for thread_id, thread_events in threads.items():
        # Sort by timestamp
        thread_events.sort(key=lambda x: x.timestamp)
        
        first_event = thread_events[0]
        last_event = thread_events[-1]
        
        # Extract thread metadata
        thread_title = first_event.metadata.get('source_title', 'Untitled Thread')
        
        # Calculate statistics
        total_messages = len(thread_events)
        total_tokens = sum(event.tokens for event in thread_events)
        authors = set(event.author for event in thread_events)
        
        thread_summaries[thread_id] = {
            'thread_id': thread_id,
            'title': thread_title,
            'started_at': first_event.timestamp,
            'ended_at': last_event.timestamp,
            'participants': list(authors),
            'message_count': total_messages,
            'total_tokens': total_tokens,
            'assistant_messages': len([e for e in thread_events if e.author == 'assistant']),
            'source_file': first_event.metadata.get('source_file', ''),
            'source_hash': first_event.source_hash
        }
    
    return thread_summaries


if __name__ == "__main__":
    # Example usage and testing
    import json
    import argparse
    
    parser = argparse.ArgumentParser(description='Normalize conversation messages')
    parser.add_argument('--input', required=True, help='Input JSONL file with raw messages')
    parser.add_argument('--output', required=True, help='Output JSONL file for normalized events')
    parser.add_argument('--assistant-only', action='store_true', help='Keep only assistant messages')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    
    normalizer = MessageNormalizer()
    
    # Load raw messages
    raw_messages = []
    with open(args.input, 'r') as f:
        for line in f:
            raw_messages.append(json.loads(line.strip()))
    
    logger.info(f"Loaded {len(raw_messages)} raw messages")
    
    # Normalize messages
    source_metadata = {'source_file': args.input}
    events = normalizer.normalize_messages(raw_messages, source_metadata)
    
    # Filter to assistant-only if requested
    if args.assistant_only:
        events = normalizer.filter_assistant_only(events)
    
    # Add thread context
    events = normalizer.add_thread_context(events)
    
    # Save normalized events
    with open(args.output, 'w') as f:
        for event_dict in normalizer.to_dict_list(events):
            f.write(json.dumps(event_dict) + '\n')
    
    logger.info(f"Saved {len(events)} normalized events to {args.output}")
    
    # Create and save thread summaries
    summaries = create_thread_summary(events)
    summary_file = args.output.replace('.jsonl', '_thread_summaries.json')
    with open(summary_file, 'w') as f:
        json.dump(summaries, f, indent=2)
    
    logger.info(f"Saved thread summaries to {summary_file}")