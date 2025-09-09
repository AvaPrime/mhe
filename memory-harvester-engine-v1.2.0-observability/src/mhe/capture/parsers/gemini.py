from mhe.extract.cards import mint_card_for_message

from mhe.scrub.redactor import scrub_text
from mhe.common.config import settings

# Example usage during parsing
def _demo_scrub(txt: str):
    if settings.scrubbing_enabled:
        return scrub_text(txt)[0]
    return txt
