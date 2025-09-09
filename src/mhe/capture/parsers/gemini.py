"""Gemini conversation parser for Memory Harvester Engine.

This module provides functionality to parse Gemini conversation exports
and ingest them into the MHE database structure.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from pathlib import Path

from sqlalchemy.orm import Session
from ...memory.models import Assistant, Thread, Message, Artifact, MemoryCard
from ...memory.db import get_session

logger = logging.getLogger(__name__)


def _safe_get(data: Dict[str, Any], key: str, default: Any = None) -> Any:
    """Safely get a value from a dictionary."""
    return data.get(key, default)


def _parse_timestamp(timestamp_str: str) -> datetime:
    """Parse Gemini timestamp string to datetime object."""
    try:
        # Gemini may use various timestamp formats
        if isinstance(timestamp_str, (int, float)):
            # Unix timestamp
            return datetime.fromtimestamp(timestamp_str, tz=timezone.utc)
        
        # ISO format
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str[:-1] + '+00:00'
        return datetime.fromisoformat(timestamp_str)
    except (ValueError, TypeError):
        # Fallback to current time if parsing fails
        logger.warning(f"Failed to parse timestamp: {timestamp_str}")
        return datetime.now(timezone.utc)


def _get_or_create_assistant(session: Session, name: str = "Gemini") -> Assistant:
    """Get or create Gemini assistant record."""
    assistant = session.query(Assistant).filter_by(name=name).first()
    if not assistant:
        assistant = Assistant(
            name=name,
            provider="Google",
            model="gemini",
            metadata={"parser_version": "1.0"}
        )
        session.add(assistant)
        session.flush()
    return assistant


def _extract_artifacts(content: str, message_id: str) -> List[Dict[str, Any]]:
    """Extract code blocks and other artifacts from Gemini message content."""
    artifacts = []
    
    # Look for code blocks
    import re
    code_pattern = r'```(\w+)?\n(.*?)\n```'
    matches = re.findall(code_pattern, content, re.DOTALL)
    
    for i, (language, code) in enumerate(matches):
        if code.strip():
            artifacts.append({
                'type': 'code',
                'title': f"Code Block {i+1}",
                'content': code.strip(),
                'language': language or 'text',
                'metadata': {'extracted_from': 'gemini_message'}
            })
    
    # Look for mathematical expressions
    math_pattern = r'\$\$(.*?)\$\$|\$(.*?)\$'
    math_matches = re.findall(math_pattern, content, re.DOTALL)
    
    for i, (block_math, inline_math) in enumerate(math_matches):
        math_content = block_math or inline_math
        if math_content.strip():
            artifacts.append({
                'type': 'math',
                'title': f"Mathematical Expression {i+1}",
                'content': math_content.strip(),
                'language': 'latex',
                'metadata': {'extracted_from': 'gemini_message', 'math_type': 'block' if block_math else 'inline'}
            })
    
    return artifacts


def _create_memory_card(session: Session, message: Message, content: str) -> Optional[MemoryCard]:
    """Create a memory card from message content if it contains significant information."""
    # Simple heuristic: create memory card for longer messages or those with artifacts
    if len(content) > 200 or message.artifacts:
        # Extract key concepts (simplified)
        concepts = []
        words = content.lower().split()
        
        # Look for technical terms, proper nouns, etc.
        for word in words:
            if len(word) > 6 and word.isalpha():
                concepts.append(word)
        
        if concepts:
            memory_card = MemoryCard(
                message_id=message.id,
                content_summary=content[:500] + "..." if len(content) > 500 else content,
                key_concepts=concepts[:10],  # Limit to top 10
                importance_score=min(len(content) / 1000.0, 1.0),  # Simple scoring
                metadata={
                    'source': 'gemini_parser',
                    'concept_count': len(concepts)
                }
            )
            session.add(memory_card)
            return memory_card
    
    return None


def ingest_gemini_export(file_path: str, session: Session = None) -> Dict[str, Any]:
    """Ingest Gemini conversation export into MHE database.
    
    Args:
        file_path: Path to Gemini export JSON file
        session: Database session (optional, will create if not provided)
    
    Returns:
        Dictionary with ingestion statistics
    """
    if session is None:
        session = get_session()
    
    try:
        # Load the export file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Get or create Gemini assistant
        assistant = _get_or_create_assistant(session)
        
        # Handle different Gemini export formats
        conversations = []
        if isinstance(data, list):
            # List of conversations
            conversations = data
        elif isinstance(data, dict):
            if 'conversations' in data:
                conversations = data['conversations']
            elif 'messages' in data or 'turns' in data:
                # Single conversation
                conversations = [data]
            else:
                # Assume the whole dict is a conversation
                conversations = [data]
        
        stats = {
            'conversations_processed': 0,
            'messages_processed': 0,
            'artifacts_created': 0,
            'memory_cards_created': 0,
            'errors': []
        }
        
        for conv_data in conversations:
            try:
                # Extract conversation metadata
                conversation_title = _safe_get(conv_data, 'title', _safe_get(conv_data, 'name', 'Gemini Conversation'))
                created_at = _parse_timestamp(_safe_get(conv_data, 'created_time', _safe_get(conv_data, 'timestamp', datetime.now(timezone.utc).isoformat())))
                
                # Create thread
                thread = Thread(
                    assistant_id=assistant.id,
                    title=conversation_title,
                    created_at=created_at,
                    metadata={
                        'source': 'gemini_export',
                        'export_file': Path(file_path).name,
                        'conversation_id': _safe_get(conv_data, 'conversation_id', _safe_get(conv_data, 'id', 'unknown'))
                    }
                )
                session.add(thread)
                session.flush()
                
                # Process messages/turns
                messages_data = _safe_get(conv_data, 'messages', _safe_get(conv_data, 'turns', []))
                
                for msg_data in messages_data:
                    try:
                        # Handle different message formats
                        if 'author' in msg_data:
                            # Format 1: author/content structure
                            author = _safe_get(msg_data, 'author', {}).get('role', 'unknown')
                            content_parts = _safe_get(msg_data, 'content', {}).get('parts', [])
                            content = ' '.join([part.get('text', '') for part in content_parts if isinstance(part, dict) and 'text' in part])
                        elif 'role' in msg_data:
                            # Format 2: role/content structure
                            author = _safe_get(msg_data, 'role', 'unknown')
                            content = _safe_get(msg_data, 'content', _safe_get(msg_data, 'text', ''))
                        else:
                            # Format 3: direct content
                            author = 'user' if _safe_get(msg_data, 'is_user', False) else 'assistant'
                            content = _safe_get(msg_data, 'text', _safe_get(msg_data, 'content', ''))
                        
                        # Skip empty messages
                        if not content or not content.strip():
                            continue
                        
                        # Map author to role
                        role = 'assistant' if author in ['model', 'assistant', 'gemini'] else 'user'
                        
                        # Parse timestamp
                        timestamp_str = _safe_get(msg_data, 'create_time', _safe_get(msg_data, 'timestamp', datetime.now(timezone.utc).isoformat()))
                        
                        # Create message
                        message = Message(
                            thread_id=thread.id,
                            role=role,
                            content=content,
                            timestamp=_parse_timestamp(timestamp_str),
                            metadata={
                                'author': author,
                                'original_id': _safe_get(msg_data, 'id', 'unknown')
                            }
                        )
                        session.add(message)
                        session.flush()
                        
                        # Extract artifacts
                        artifacts_data = _extract_artifacts(content, message.id)
                        for artifact_data in artifacts_data:
                            artifact = Artifact(
                                message_id=message.id,
                                type=artifact_data['type'],
                                title=artifact_data['title'],
                                content=artifact_data['content'],
                                language=artifact_data.get('language'),
                                metadata=artifact_data.get('metadata', {})
                            )
                            session.add(artifact)
                            stats['artifacts_created'] += 1
                        
                        # Create memory card if appropriate
                        memory_card = _create_memory_card(session, message, content)
                        if memory_card:
                            stats['memory_cards_created'] += 1
                        
                        stats['messages_processed'] += 1
                        
                    except Exception as e:
                        error_msg = f"Error processing message: {str(e)}"
                        logger.error(error_msg)
                        stats['errors'].append(error_msg)
                
                stats['conversations_processed'] += 1
                
            except Exception as e:
                error_msg = f"Error processing conversation: {str(e)}"
                logger.error(error_msg)
                stats['errors'].append(error_msg)
        
        # Commit transaction
        session.commit()
        
        logger.info(f"Successfully ingested Gemini conversations: {stats}")
        return stats
        
    except Exception as e:
        session.rollback()
        error_msg = f"Failed to ingest Gemini export: {str(e)}"
        logger.error(error_msg)
        raise Exception(error_msg)
    
    finally:
        if session:
            session.close()


def main():
    """CLI entry point for Gemini parser."""
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python gemini.py <path_to_gemini_export.json>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        stats = ingest_gemini_export(file_path)
        print(f"Ingestion completed: {stats}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()