"""
ChatGPT conversation archive loader and parser.
Handles JSON and ZIP formats from ChatGPT export functionality.
"""

import json
import zipfile
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional, Iterator
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ChatGPTLoader:
    """Loader for ChatGPT conversation exports."""
    
    def __init__(self):
        self.supported_formats = ['json', 'zip']
        
    def load_conversations(self, file_path: str) -> Iterator[Dict[str, Any]]:
        """
        Load conversations from ChatGPT export file.
        
        Args:
            file_path: Path to ChatGPT export file
            
        Yields:
            Raw conversation dictionaries
        """
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"Export file not found: {file_path}")
            
        if path.suffix.lower() == '.zip':
            yield from self._load_from_zip(path)
        elif path.suffix.lower() == '.json':
            yield from self._load_from_json(path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")
    
    def _load_from_json(self, file_path: Path) -> Iterator[Dict[str, Any]]:
        """Load conversations from JSON file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Handle both single conversation and list of conversations
            if isinstance(data, list):
                for conversation in data:
                    if self._is_valid_conversation(conversation):
                        yield self._enrich_conversation(conversation, str(file_path))
                    else:
                        logger.warning(f"Invalid conversation format in {file_path}")
            elif isinstance(data, dict) and self._is_valid_conversation(data):
                yield self._enrich_conversation(data, str(file_path))
            else:
                logger.error(f"Invalid JSON format in {file_path}")
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            raise
    
    def _load_from_zip(self, file_path: Path) -> Iterator[Dict[str, Any]]:
        """Load conversations from ZIP archive."""
        try:
            with zipfile.ZipFile(file_path, 'r') as zip_file:
                for zip_info in zip_file.infolist():
                    if zip_info.filename.endswith('.json'):
                        with zip_file.open(zip_info) as json_file:
                            try:
                                data = json.load(json_file)
                                if self._is_valid_conversation(data):
                                    yield self._enrich_conversation(
                                        data, 
                                        f"{file_path}:{zip_info.filename}"
                                    )
                                else:
                                    logger.warning(
                                        f"Invalid conversation in {file_path}:{zip_info.filename}"
                                    )
                            except json.JSONDecodeError as e:
                                logger.error(
                                    f"JSON decode error in {file_path}:{zip_info.filename}: {e}"
                                )
                                
        except zipfile.BadZipFile as e:
            logger.error(f"Invalid ZIP file {file_path}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading ZIP file {file_path}: {e}")
            raise
    
    def _is_valid_conversation(self, data: Dict[str, Any]) -> bool:
        """Validate conversation structure."""
        required_fields = ['title', 'mapping']
        
        if not isinstance(data, dict):
            return False
            
        for field in required_fields:
            if field not in data:
                return False
                
        # Validate mapping structure
        mapping = data.get('mapping', {})
        if not isinstance(mapping, dict):
            return False
            
        # Check if mapping contains message-like objects
        for msg_id, msg_data in mapping.items():
            if not isinstance(msg_data, dict):
                continue
            if 'message' in msg_data or ('author' in msg_data and 'content' in msg_data):
                return True
                
        return False
    
    def _enrich_conversation(self, conversation: Dict[str, Any], source_path: str) -> Dict[str, Any]:
        """Add metadata and compute source hash."""
        # Compute content hash for traceability
        content_str = json.dumps(conversation, sort_keys=True)
        content_hash = hashlib.sha256(content_str.encode('utf-8')).hexdigest()
        
        # Add enrichment metadata
        enriched = conversation.copy()
        enriched['_metadata'] = {
            'source_file': source_path,
            'content_hash': content_hash,
            'loaded_at': datetime.utcnow().isoformat(),
            'loader_version': '1.0.0'
        }
        
        return enriched
    
    def extract_messages(self, conversation: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract individual messages from ChatGPT conversation structure.
        
        Args:
            conversation: Raw conversation dictionary
            
        Returns:
            List of normalized message dictionaries
        """
        messages = []
        mapping = conversation.get('mapping', {})
        
        for msg_id, msg_data in mapping.items():
            try:
                # Handle different ChatGPT export formats
                message = self._extract_single_message(msg_id, msg_data, conversation)
                if message:
                    messages.append(message)
                    
            except Exception as e:
                logger.warning(f"Error extracting message {msg_id}: {e}")
                continue
        
        # Sort messages by timestamp
        messages.sort(key=lambda x: x.get('timestamp', 0))
        return messages
    
    def _extract_single_message(self, msg_id: str, msg_data: Dict[str, Any], conversation: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract and normalize a single message."""
        # Handle nested message structure
        if 'message' in msg_data:
            actual_message = msg_data['message']
        else:
            actual_message = msg_data
            
        # Skip if no content
        if not actual_message or 'content' not in actual_message:
            return None
            
        # Extract author information
        author_info = actual_message.get('author', {})
        author_role = author_info.get('role', 'unknown')
        
        # Skip non-assistant messages for MVP
        if author_role != 'assistant':
            return None
            
        # Extract content parts
        content_data = actual_message.get('content', {})
        if isinstance(content_data, dict):
            parts = content_data.get('parts', [])
        elif isinstance(content_data, list):
            parts = content_data
        else:
            parts = [str(content_data)]
            
        # Combine content parts
        text_content = '\n'.join(str(part) for part in parts if part)
        
        if not text_content.strip():
            return None
            
        # Extract timestamp
        timestamp = actual_message.get('create_time', 0)
        if isinstance(timestamp, (int, float)):
            timestamp_iso = datetime.fromtimestamp(timestamp).isoformat()
        else:
            timestamp_iso = datetime.utcnow().isoformat()
            
        return {
            'thread_id': self._generate_thread_id(conversation),
            'message_id': msg_id,
            'author': 'assistant',
            'role': author_role,
            'text': text_content,
            'timestamp': timestamp_iso,
            'tokens': self._estimate_tokens(text_content),
            'metadata': {
                'original_author': author_info,
                'content_type': content_data.get('content_type', 'text')
            }
        }
    
    def _generate_thread_id(self, conversation: Dict[str, Any]) -> str:
        """Generate consistent thread ID from conversation."""
        title = conversation.get('title', 'untitled')
        create_time = conversation.get('create_time', 0)
        
        # Create deterministic ID based on title and creation time
        id_string = f"{title}_{create_time}"
        return hashlib.sha256(id_string.encode('utf-8')).hexdigest()[:16]
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (4 chars per token average)."""
        return max(1, len(text) // 4)
    
    def get_conversation_metadata(self, conversation: Dict[str, Any]) -> Dict[str, Any]:
        """Extract conversation-level metadata."""
        return {
            'title': conversation.get('title', 'Untitled Conversation'),
            'create_time': conversation.get('create_time', 0),
            'update_time': conversation.get('update_time', 0),
            'conversation_id': conversation.get('conversation_id', ''),
            'message_count': len(conversation.get('mapping', {})),
            'source_hash': conversation.get('_metadata', {}).get('content_hash', '')
        }


if __name__ == "__main__":
    # Example usage and testing
    import argparse
    
    parser = argparse.ArgumentParser(description='Load and parse ChatGPT conversations')
    parser.add_argument('--input', required=True, help='Path to ChatGPT export file')
    parser.add_argument('--output', help='Output file for extracted messages')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    
    loader = ChatGPTLoader()
    
    try:
        conversations = list(loader.load_conversations(args.input))
        logger.info(f"Loaded {len(conversations)} conversations")
        
        total_messages = 0
        for conversation in conversations:
            messages = loader.extract_messages(conversation)
            total_messages += len(messages)
            logger.info(f"Conversation '{conversation.get('title', 'Unknown')}': {len(messages)} assistant messages")
        
        logger.info(f"Total assistant messages extracted: {total_messages}")
        
        if args.output:
            # Save extracted messages for inspection
            with open(args.output, 'w') as f:
                for conversation in conversations:
                    messages = loader.extract_messages(conversation)
                    for message in messages:
                        f.write(json.dumps(message) + '\n')
            logger.info(f"Messages saved to {args.output}")
            
    except Exception as e:
        logger.error(f"Error processing {args.input}: {e}")
        raise