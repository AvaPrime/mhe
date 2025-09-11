# 🌌 Codessa-Seed

The memory kernel of the Codessa ecosystem. Transforms conversation history into persistent, intent-aware knowledge that fuels autonomous agent cognition.

## Vision

Codessa-Seed interprets the **why** behind conversations:
- Why discussions took place
- What purpose they served  
- Which opportunities remain unfinished
- Which patterns and pain points recur
- Which forks and loops are unresolved

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Process conversation archive
python src/ingestion/parser.py --input conversations.json --output memory/

# Query persistent memory
python memory/knowledge_graph.py --query "show unresolved loops"
```

## Architecture

- **Ingestion Pipeline**: Processes exported conversation archives
- **Memory Layer**: Persistent knowledge graph with semantic clustering
- **Agent Framework**: Specialized roles for interpretation and validation
- **API Layer**: Context-aware memory recall for downstream agents

## Documentation

See `docs/` for complete architecture, requirements, and development workflows.
