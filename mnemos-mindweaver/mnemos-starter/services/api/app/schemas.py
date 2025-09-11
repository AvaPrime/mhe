
from pydantic import BaseModel
from typing import Literal, Optional, List

Kind = Literal["codestone","codecell","codeblock","fragment"]
Strength = Literal["short","medium","long","permanent"]

class SearchQuery(BaseModel):
    q: str
    kinds: Optional[List[Kind]] = None
    strength: Optional[List[Strength]] = None
    limit: int = 20

class SearchResult(BaseModel):
    id: int
    kind: Kind
    title: str
    score: float
