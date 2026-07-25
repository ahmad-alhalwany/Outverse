"""Map user interests to question categories for light personalization.

Free-form interest strings (lowercased) are matched against keyword buckets.
This is intentionally rule-based — cheap, deterministic, and explainable —
which is the right first step before reaching for embeddings or an LLM.
"""

INTEREST_TO_CATEGORY: dict[str, str] = {
    # ---- Onboarding "worlds" (brand labels users actually pick) ----
    'the lab': 'scifi',
    'the bazaar': 'everyday',
    'the vault': 'mystery',
    'lab': 'scifi',
    'bazaar': 'everyday',
    'vault': 'mystery',

    # ---- Real interest keywords (enriched onboarding) ----
    # historical
    'history': 'historical',
    'historical': 'historical',
    'archaeology': 'historical',
    'ancient': 'historical',
    'egypt': 'historical',
    'rome': 'historical',
    'medieval': 'historical',
    'victorian': 'historical',
    'antiques': 'historical',
    'civilizations': 'historical',

    # fantasy
    'fantasy': 'fantasy',
    'magic': 'fantasy',
    'dragons': 'fantasy',
    'mythology': 'fantasy',
    'fairy': 'fantasy',
    'witches': 'fantasy',
    'portal': 'fantasy',
    'worldbuilding': 'fantasy',
    'dnd': 'fantasy',
    'rpg': 'fantasy',
    'wizards': 'fantasy',

    # scifi
    'space': 'scifi',
    'astronomy': 'scifi',
    'physics': 'scifi',
    'science': 'scifi',
    'scifi': 'scifi',
    'ai': 'scifi',
    'robots': 'scifi',
    'mars': 'scifi',
    'future': 'scifi',
    'technology': 'scifi',
    'tech': 'scifi',
    'computers': 'scifi',
    'programming': 'scifi',
    'coding': 'scifi',
    'innovation': 'scifi',

    # philosophical
    'philosophy': 'philosophical',
    'philosophical': 'philosophical',
    'ethics': 'philosophical',
    'psychology': 'philosophical',
    'meditation': 'philosophical',
    'stoicism': 'philosophical',
    'religion': 'philosophical',
    'spirituality': 'philosophical',
    'mindfulness': 'philosophical',

    # mystery
    'mystery': 'mystery',
    'detective': 'mystery',
    'crime': 'mystery',
    'noir': 'mystery',
    'secrets': 'mystery',
    'conspiracy': 'mystery',
    'thriller': 'mystery',
    'puzzles': 'mystery',

    # surreal
    'surreal': 'surreal',
    'absurd': 'surreal',
    'dreams': 'surreal',
    'dali': 'surreal',
    'magritte': 'surreal',
    'weird': 'surreal',
    'strange': 'surreal',

    # everyday
    'nature': 'everyday',
    'garden': 'everyday',
    'travel': 'everyday',
    'walking': 'everyday',
    'coffee': 'everyday',
    'food': 'everyday',
    'cooking': 'everyday',
    'photography': 'everyday',
    'music': 'everyday',
    'hiking': 'everyday',

    # emotional
    'feelings': 'emotional',
    'emotions': 'emotional',
    'poetry': 'emotional',
    'writing': 'emotional',
    'journaling': 'emotional',
    'love': 'emotional',
    'mental-health': 'emotional',
    'therapy': 'emotional',
    'art': 'emotional',
    'painting': 'emotional',
    'drawing': 'emotional',
    'memory': 'emotional',
    'family': 'emotional',
}


def categories_for_interests(interests: list[str]) -> list[str]:
    """Return ordered categories inferred from a user's interest list.

    Order is by frequency (most-matched category first), so callers can
    bias question selection toward the top entries while reserving a
    serendipity slice for categories outside the user's bubble.
    """
    if not interests:
        return []
    scores: dict[str, int] = {}
    for raw in interests:
        if not isinstance(raw, str):
            continue
        key = raw.strip().lower()
        if not key:
            continue
        # Direct match
        if key in INTEREST_TO_CATEGORY:
            cat = INTEREST_TO_CATEGORY[key]
            scores[cat] = scores.get(cat, 0) + 2
            continue
        # Substring match (e.g. "AI ethics" contains "ai")
        for needle, cat in INTEREST_TO_CATEGORY.items():
            if needle in key:
                scores[cat] = scores.get(cat, 0) + 1
                break
    return [cat for cat, _ in sorted(scores.items(), key=lambda kv: kv[1], reverse=True)]
