"""
Intent mining module for extracting WHY behind conversation messages.
Uses heuristic patterns and LLM analysis to identify purpose and facets.
"""

import json
import re
import time
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging
import httpx

logger = logging.getLogger(__name__)

class IntentMiner:
    """Extracts intent and purpose from conversation messages."""
    
    def __init__(self, model_name: str = "gemini-1.5-pro", use_llm: bool = True):
        self.model_name = model_name
        self.use_llm = use_llm
        self.temperature = 0.1
        self.max_tokens = 1000
        self.max_retries = 3
        self.rate_limit_delay = 0.1  # seconds between requests
        
        # Heuristic patterns for intent detection
        self.intent_patterns = {
            'explanation': [
                r'let me explain',
                r'here\'s how',
                r'the reason is',
                r'this is because',
                r'to understand this'
            ],
            'recommendation': [
                r'i recommend',
                r'you should',
                r'consider',
                r'the best approach',
                r'try this'
            ],
            'warning': [
                r'be careful',
                r'watch out',
                r'the risk is',
                r'potential issue',
                r'be aware that'
            ],
            'opportunity': [
                r'you could',
                r'this opens up',
                r'potential to',
                r'opportunity for',
                r'consider exploring'
            ],
            'principle': [
                r'the key principle',
                r'fundamental rule',
                r'important to remember',
                r'core concept',
                r'guiding principle'
            ],
            'next_steps': [
                r'next step',
                r'you\'ll need to',
                r'following up',
                r'to proceed',
                r'moving forward'
            ]
        }
        
        # System prompt for LLM intent extraction
        self.system_prompt = """You are a conversation analyst that extracts the underlying intent and purpose from assistant-authored responses. Your job is to identify WHY the assistant provided this response - not just what was said, but the deeper motivation, principles, and intended outcomes.

Analyze the provided assistant message and extract the following facets in valid JSON format:

{
  "why": "The core reason or purpose behind this response",
  "core_principles": ["fundamental principles or beliefs expressed"],
  "capabilities": ["abilities or skills demonstrated or discussed"], 
  "constraints": ["limitations, boundaries, or restrictions mentioned"],
  "risks": ["potential risks, concerns, or warnings identified"],
  "opportunities": ["possibilities, potential benefits, or next steps suggested"],
  "unresolved_loops": ["incomplete thoughts, open questions, or matters requiring follow-up"],
  "integration_points": ["connections to other systems, concepts, or future work"]
}

Rules:
- Extract only what is explicitly present or clearly implied
- Use concise, specific language
- Empty arrays for missing categories
- Focus on intent over surface content
- No speculation beyond reasonable inference
- Respond with valid JSON only, no additional text"""
    
    def mine_intent(self, normalized_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extract intent facets from normalized conversation events.
        
        Args:
            normalized_events: List of normalized message events
            
        Returns:
            List of memory objects with intent facets
        """
        memory_objects = []
        
        for i, event in enumerate(normalized_events):
            try:
                logger.debug(f"Processing event {i+1}/{len(normalized_events)}: {event.get('message_id', 'unknown')}")
                
                memory_object = self._create_memory_object(event)
                
                # Extract intent using heuristics and LLM
                facets = self._extract_facets(event)
                memory_object['facets'] = facets
                
                memory_objects.append(memory_object)
                
                # Rate limiting for LLM calls
                if self.use_llm:
                    time.sleep(self.rate_limit_delay)
                    
            except Exception as e:
                logger.error(f"Error processing event {event.get('message_id', 'unknown')}: {e}")
                continue
        
        logger.info(f"Created {len(memory_objects)} memory objects with intent facets")
        return memory_objects
    
    def _create_memory_object(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Create base memory object from normalized event."""
        import uuid
        
        return {
            'id': str(uuid.uuid4()),
            'thread_id': event['thread_id'],
            'message_id': event['message_id'],
            'timestamp': event['timestamp'],
            'author': event['author'],
            'text': event['text'],
            'tokens': event['tokens'],
            'cluster_id': '',  # Will be populated by clusterer
            'provenance': {
                'source_file': event['metadata'].get('source_file', ''),
                'thread_title': event['metadata'].get('source_title', ''),
                'hash': event['source_hash']
            },
            'version': '1.0.0'
        }
    
    def _extract_facets(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Extract intent facets using heuristics and LLM analysis."""
        text = event['text']
        
        # Stage A: Heuristic pre-pass
        heuristic_facets = self._extract_heuristic_facets(text)
        
        # Stage B: LLM analysis (if enabled)
        if self.use_llm:
            llm_facets = self._extract_llm_facets(event)
            # Merge heuristic and LLM results, with LLM taking precedence
            facets = self._merge_facets(heuristic_facets, llm_facets)
        else:
            facets = heuristic_facets
        
        # Ensure 'why' field is always present
        if not facets.get('why'):
            facets['why'] = self._generate_fallback_why(text)
        
        return facets
    
    def _extract_heuristic_facets(self, text: str) -> Dict[str, Any]:
        """Extract facets using pattern matching heuristics."""
        text_lower = text.lower()
        
        facets = {
            'why': '',
            'core_principles': [],
            'capabilities': [],
            'constraints': [],
            'risks': [],
            'opportunities': [],
            'unresolved_loops': [],
            'integration_points': []
        }
        
        # Pattern-based intent detection
        detected_intents = []
        
        for intent_type, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    detected_intents.append(intent_type)
                    break
        
        # Map detected intents to facets
        if 'explanation' in detected_intents:
            facets['why'] = 'Providing explanation or clarification'
            
        if 'recommendation' in detected_intents:
            facets['opportunities'].append('Follow recommended approach')
            
        if 'warning' in detected_intents:
            facets['risks'].append('Identified potential risks or concerns')
            
        if 'opportunity' in detected_intents:
            facets['opportunities'].append('Presented potential opportunities')
            
        if 'principle' in detected_intents:
            facets['core_principles'].append('Shared fundamental principles')
            
        if 'next_steps' in detected_intents:
            facets['opportunities'].append('Outlined next steps or actions')
        
        # Look for question marks indicating unresolved items
        if '?' in text:
            facets['unresolved_loops'].append('Contains open questions')
        
        # Look for constraint indicators
        constraint_indicators = ['cannot', 'unable to', 'limited by', 'restricted', 'not possible']
        for indicator in constraint_indicators:
            if indicator in text_lower:
                facets['constraints'].append('Mentioned limitations or restrictions')
                break
        
        return facets
    
    def _extract_llm_facets(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Extract facets using LLM analysis."""
        
        # Prepare sanitized message for LLM
        sanitized_text = self._sanitize_message(event['text'])
        thread_title = event['metadata'].get('source_title', 'Unknown Conversation')
        
        user_prompt = f"""Context: This is an assistant message from a conversation titled "{thread_title}".

Message: {sanitized_text}

Extract the intent facets as specified in your system prompt."""
        
        try:
            # Make LLM API call with retries
            response = self._call_llm_with_retry(user_prompt)
            
            # Parse JSON response
            facets = json.loads(response)
            
            # Validate facets structure
            if self._validate_facets(facets):
                return facets
            else:
                logger.warning(f"Invalid facets structure from LLM for message {event.get('message_id', 'unknown')}")
                return self._get_empty_facets()
                
        except Exception as e:
            logger.error(f"LLM facet extraction failed for message {event.get('message_id', 'unknown')}: {e}")
            return self._get_empty_facets()
    
    def _call_llm_with_retry(self, user_prompt: str) -> str:
        """Make LLM API call with exponential backoff retry."""
        
        for attempt in range(self.max_retries):
            try:
                # Simulate API call to Vertex AI/Gemini
                # In real implementation, replace with actual API call
                response = self._make_api_call(user_prompt)
                return response
                
            except Exception as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1.0  # Exponential backoff
                    logger.warning(f"LLM API call failed (attempt {attempt + 1}), retrying in {wait_time}s: {e}")
                    time.sleep(wait_time)
                else:
                    raise
    
    def _make_api_call(self, user_prompt: str) -> str:
        """Make actual API call to LLM service."""
        # This is a placeholder for the actual API call
        # In production, implement with google-cloud-aiplatform or similar
        
        # For now, return a mock response for testing
        mock_response = {
            "why": "Providing technical guidance and explanation",
            "core_principles": ["clear communication", "practical solutions"],
            "capabilities": ["technical analysis", "problem solving"],
            "constraints": [],
            "risks": [],
            "opportunities": ["further exploration", "implementation"],
            "unresolved_loops": [],
            "integration_points": []
        }
        
        return json.dumps(mock_response)
    
    def _sanitize_message(self, text: str) -> str:
        """Sanitize message content for LLM processing."""
        # Remove potential sensitive information
        # This is a basic implementation - enhance based on requirements
        
        # Remove URLs
        text = re.sub(r'https?://\S+', '[URL]', text)
        
        # Remove email addresses
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
        
        # Remove file paths
        text = re.sub(r'[A-Za-z]:\\[^\s]+', '[FILEPATH]', text)
        text = re.sub(r'/[^\s]+', '[FILEPATH]', text)
        
        # Truncate if too long (keep within token limits)
        max_chars = 4000  # Roughly 1000 tokens
        if len(text) > max_chars:
            text = text[:max_chars] + "... [truncated]"
        
        return text
    
    def _validate_facets(self, facets: Dict[str, Any]) -> bool:
        """Validate facets structure from LLM response."""
        required_fields = ['why', 'core_principles', 'capabilities', 'constraints', 
                          'risks', 'opportunities', 'unresolved_loops', 'integration_points']
        
        if not isinstance(facets, dict):
            return False
        
        for field in required_fields:
            if field not in facets:
                return False
            
            # Check that list fields are actually lists
            if field != 'why' and not isinstance(facets[field], list):
                return False
        
        return True
    
    def _merge_facets(self, heuristic_facets: Dict[str, Any], 
                     llm_facets: Dict[str, Any]) -> Dict[str, Any]:
        """Merge heuristic and LLM facets with LLM taking precedence."""
        merged = heuristic_facets.copy()
        
        # LLM 'why' takes precedence if present and non-empty
        if llm_facets.get('why'):
            merged['why'] = llm_facets['why']
        
        # For list fields, combine unique items with LLM items first
        list_fields = ['core_principles', 'capabilities', 'constraints', 'risks', 
                      'opportunities', 'unresolved_loops', 'integration_points']
        
        for field in list_fields:
            heuristic_items = set(heuristic_facets.get(field, []))
            llm_items = llm_facets.get(field, [])
            
            # Combine with LLM items first, then unique heuristic items
            combined = llm_items + [item for item in heuristic_items if item not in llm_items]
            merged[field] = combined
        
        return merged
    
    def _generate_fallback_why(self, text: str) -> str:
        """Generate fallback 'why' when none found."""
        text_length = len(text)
        
        if text_length < 100:
            return "Providing brief response or acknowledgment"
        elif text_length < 500:
            return "Offering guidance or information"
        else:
            return "Providing detailed explanation or analysis"
    
    def _get_empty_facets(self) -> Dict[str, Any]:
        """Return empty facets structure."""
        return {
            'why': 'Unable to determine intent',
            'core_principles': [],
            'capabilities': [],
            'constraints': [],
            'risks': [],
            'opportunities': [],
            'unresolved_loops': [],
            'integration_points': []
        }
