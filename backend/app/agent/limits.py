"""Tunable limits for the booking assistant, in one place."""

# A proposed change expires if the patient doesn't act on it.
PENDING_TTL_MINUTES = 15
# Most requests a patient can have waiting at once.
MAX_PENDING_ACTIONS = 3
# Model round trips per chat message before the loop forces a final answer.
MAX_AGENT_STEPS = 6
# Earlier chat messages given to the model for context. Every tool round
# resends them, and free tiers meter tokens per minute (Groq: 8,000), so keep
# this short: booking only needs the last couple of exchanges.
HISTORY_MESSAGES = 6
# Longest earlier message sent as-is; longer ones (a cited knowledge-base
# answer, say) are cut with an ellipsis.
HISTORY_MESSAGE_CHARS = 400
