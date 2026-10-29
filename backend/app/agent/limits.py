"""Tunable limits for the booking assistant, in one place."""

# A proposed change expires if the patient doesn't act on it.
PENDING_TTL_MINUTES = 15
# Most requests a patient can have waiting at once.
MAX_PENDING_ACTIONS = 3
# Model round trips per chat message before the loop forces a final answer.
MAX_AGENT_STEPS = 6
# Earlier chat messages given to the model for context.
HISTORY_MESSAGES = 10
