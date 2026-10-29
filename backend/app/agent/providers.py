"""Model providers for the booking assistant.

The agent loop (loop.py) speaks one neutral transcript format; each provider
translates that to its own wire format and back, so swapping Azure OpenAI
for Gemini or Groq (or a scripted fake in tests) never touches the loop or
tools.

Neutral transcript entries (plain dicts):
  {"role": "user", "text": str}
  {"role": "assistant", "text": str, "tool_calls": [ToolCall, ...]}
  {"role": "tool", "call_id": str, "name": str, "content": str (JSON)}

Tool specs are neutral too: {"name", "description", "parameters": <JSON schema>}.

Free model tiers have rate limits, so get_provider() returns a
FallbackProvider: it tries each configured provider in turn, remembers which
one just said "too many requests" (so the next message doesn't waste time on
it), and raises ProviderBusyError only when every one is out of capacity.
"""
import json
import logging
import re
import threading
import time
import uuid
from dataclasses import dataclass, field

GEMINI_AGENT_MODEL = "gemini-2.5-flash"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile"

# Seconds to wait before trying a provider again after it fails. A rate-limit
# reply that says how long to wait (Retry-After) overrides the first number.
BUSY_COOLDOWN_SECONDS = 60
ERROR_COOLDOWN_SECONDS = 15
MAX_COOLDOWN_SECONDS = 600
REQUEST_TIMEOUT_SECONDS = 20

logger = logging.getLogger(__name__)


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict


@dataclass
class ModelTurn:
    text: str = ""
    tool_calls: list = field(default_factory=list)


class ProviderBusyError(Exception):
    """Every configured model is out of capacity right now (rate-limited or
    overloaded). Not a bug: the route turns it into a friendly "busy" reply
    that points the patient at the normal booking page."""

    def __init__(self, message, retry_after=None):
        super().__init__(message)
        self.retry_after = retry_after


def _loads_object(raw):
    """Tool arguments arrive as a JSON string (OpenAI) — tolerate empty or
    malformed output from the model rather than crashing the request."""
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw or "{}")
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


# --- telling "busy" apart from "broken" -------------------------------------


def _retry_after_from_headers(response):
    try:
        return float(response.headers.get("retry-after"))
    except (AttributeError, TypeError, ValueError):
        return None


def _retry_after_from_gemini(exc):
    """Gemini puts the wait in the error details as e.g. "retryDelay": "34s"."""
    match = re.search(r"""retryDelay['"]?\s*[:=]\s*['"]?(\d+(?:\.\d+)?)s""", str(getattr(exc, "details", "") or ""))
    return float(match.group(1)) if match else None


def classify_failure(exc):
    """Returns (busy, retry_after_seconds_or_None). `busy` means the provider
    is rate-limited, overloaded or timing out — worth falling back from and
    retrying later — as opposed to a real misconfiguration (bad key, bad
    request), which won't fix itself."""
    try:
        import openai

        if isinstance(exc, openai.RateLimitError):
            return True, _retry_after_from_headers(getattr(exc, "response", None))
        if isinstance(exc, (openai.InternalServerError, openai.APITimeoutError, openai.APIConnectionError)):
            return True, None
    except ImportError:
        pass
    try:
        from google.genai import errors

        if isinstance(exc, errors.APIError) and getattr(exc, "code", None) in (429, 500, 503, 504):
            return True, _retry_after_from_gemini(exc)
    except ImportError:
        pass
    return False, None


# --- OpenAI-style providers (Azure OpenAI, Groq) ----------------------------


class _OpenAIChatProvider:
    """Shared translation for any OpenAI-compatible chat-completions API."""

    name = "openai"
    model = ""

    def _client(self):
        raise NotImplementedError

    @staticmethod
    def to_messages(system, transcript):
        messages = [{"role": "system", "content": system}]
        for entry in transcript:
            if entry["role"] == "user":
                messages.append({"role": "user", "content": entry["text"]})
            elif entry["role"] == "assistant":
                message = {"role": "assistant", "content": entry.get("text") or None}
                if entry.get("tool_calls"):
                    message["tool_calls"] = [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {"name": call.name, "arguments": json.dumps(call.args)},
                        }
                        for call in entry["tool_calls"]
                    ]
                messages.append(message)
            else:
                messages.append({"role": "tool", "tool_call_id": entry["call_id"], "content": entry["content"]})
        return messages

    @staticmethod
    def to_tools(tools):
        return [
            {
                "type": "function",
                "function": {"name": t["name"], "description": t["description"], "parameters": t["parameters"]},
            }
            for t in tools
        ]

    @staticmethod
    def parse_response(response):
        message = response.choices[0].message
        calls = [
            ToolCall(id=c.id, name=c.function.name, args=_loads_object(c.function.arguments))
            for c in (message.tool_calls or [])
        ]
        return ModelTurn(text=message.content or "", tool_calls=calls)

    def generate(self, system, transcript, tools):
        kwargs = {
            "model": self.model,
            "messages": self.to_messages(system, transcript),
            "temperature": 0.2,
            "max_tokens": 800,
        }
        if tools:
            kwargs["tools"] = self.to_tools(tools)
        return self.parse_response(self._client().chat.completions.create(**kwargs))


class AzureOpenAIProvider(_OpenAIChatProvider):
    name = "azure"

    def __init__(self, endpoint, api_key, deployment, api_version="2024-10-21"):
        self.endpoint = endpoint
        self.api_key = api_key
        self.deployment = deployment
        self.model = deployment  # Azure addresses a model by its deployment name
        self.api_version = api_version

    def _client(self):
        from openai import AzureOpenAI

        # max_retries=0: a rate-limited call should fail over to the next
        # provider immediately, not sit in the SDK's own retry backoff.
        return AzureOpenAI(
            azure_endpoint=self.endpoint,
            api_key=self.api_key,
            api_version=self.api_version,
            max_retries=0,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )


class GroqProvider(_OpenAIChatProvider):
    """Groq's free tier speaks the OpenAI chat-completions protocol, so it
    reuses the OpenAI SDK with a different base URL."""

    name = "groq"

    def __init__(self, api_key, model=GROQ_DEFAULT_MODEL):
        self.api_key = api_key
        self.model = model

    def _client(self):
        from openai import OpenAI

        return OpenAI(
            base_url=GROQ_BASE_URL, api_key=self.api_key, max_retries=0, timeout=REQUEST_TIMEOUT_SECONDS
        )


# --- Gemini -----------------------------------------------------------------


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key, model=GEMINI_AGENT_MODEL):
        self.api_key = api_key
        self.model = model

    @staticmethod
    def to_contents(transcript):
        from google.genai import types

        contents = []
        for entry in transcript:
            if entry["role"] == "user":
                contents.append(types.Content(role="user", parts=[types.Part.from_text(text=entry["text"])]))
            elif entry["role"] == "assistant":
                parts = []
                if entry.get("text"):
                    parts.append(types.Part.from_text(text=entry["text"]))
                for call in entry.get("tool_calls") or []:
                    parts.append(types.Part(function_call=types.FunctionCall(name=call.name, args=call.args)))
                contents.append(types.Content(role="model", parts=parts))
            else:
                part = types.Part.from_function_response(
                    name=entry["name"], response={"result": json.loads(entry["content"])}
                )
                # Gemini wants all results for one model turn together in a single content.
                if contents and contents[-1].role == "user" and contents[-1].parts[0].function_response:
                    contents[-1].parts.append(part)
                else:
                    contents.append(types.Content(role="user", parts=[part]))
        return contents

    @staticmethod
    def to_tools(tools):
        from google.genai import types

        return [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name=t["name"], description=t["description"], parameters_json_schema=t["parameters"]
                    )
                    for t in tools
                ]
            )
        ]

    @staticmethod
    def parse_response(response):
        text_parts, calls = [], []
        candidates = response.candidates or []
        parts = (candidates[0].content.parts or []) if candidates and candidates[0].content else []
        for part in parts:
            if getattr(part, "function_call", None):
                # Gemini function calls carry no id, so mint one for the transcript.
                calls.append(
                    ToolCall(
                        id=f"call_{uuid.uuid4().hex[:8]}",
                        name=part.function_call.name,
                        args=dict(part.function_call.args or {}),
                    )
                )
            elif getattr(part, "text", None):
                text_parts.append(part.text)
        return ModelTurn(text="".join(text_parts), tool_calls=calls)

    def generate(self, system, transcript, tools):
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=self.api_key, http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_SECONDS * 1000)
        )
        config = types.GenerateContentConfig(system_instruction=system, temperature=0.2, max_output_tokens=800)
        if tools:
            config.tools = self.to_tools(tools)
            # The loop executes tools itself, so don't let the SDK auto-call anything.
            config.automatic_function_calling = types.AutomaticFunctionCallingConfig(disable=True)
        response = client.models.generate_content(
            model=self.model, contents=self.to_contents(transcript), config=config
        )
        return self.parse_response(response)


# --- failover ---------------------------------------------------------------

# Provider name -> {"until": monotonic seconds, "busy": bool}. Module-level
# because get_provider() builds a fresh FallbackProvider for every request:
# the memory of "Gemini just said too many requests" has to outlive it.
_COOLDOWNS = {}
_COOLDOWN_LOCK = threading.Lock()


def reset_cooldowns():
    with _COOLDOWN_LOCK:
        _COOLDOWNS.clear()


class FallbackProvider:
    """Tries providers in order, skipping any that failed recently.

    A provider that is busy (rate-limited / overloaded) is skipped for the
    time it asked for, or a minute; one that failed for another reason (say a
    bad key) for a short while, so a misconfigured provider can't slow every
    message down. If every provider is unavailable it raises
    ProviderBusyError when at least one was merely busy, else a plain
    RuntimeError (a real outage or misconfiguration).
    """

    def __init__(self, providers, clock=time.monotonic):
        self.providers = list(providers)
        self._clock = clock

    @property
    def name(self):
        return "+".join(p.name for p in self.providers)

    def _remaining(self, provider):
        with _COOLDOWN_LOCK:
            entry = _COOLDOWNS.get(provider.name)
        if entry is None:
            return 0.0, False
        return max(0.0, entry["until"] - self._clock()), entry["busy"]

    def _start_cooldown(self, provider, busy, retry_after):
        seconds = BUSY_COOLDOWN_SECONDS if busy else ERROR_COOLDOWN_SECONDS
        if busy and retry_after:
            seconds = retry_after
        seconds = min(max(seconds, 1), MAX_COOLDOWN_SECONDS)
        with _COOLDOWN_LOCK:
            _COOLDOWNS[provider.name] = {"until": self._clock() + seconds, "busy": busy}

    def available(self):
        """False when every provider is cooling down — the frontend can then
        say so up front instead of letting a message fail."""
        return any(self._remaining(p)[0] == 0 for p in self.providers)

    def generate(self, system, transcript, tools):
        busy_waits = []
        for provider in self.providers:
            remaining, was_busy = self._remaining(provider)
            if remaining > 0:
                if was_busy:
                    busy_waits.append(remaining)
                continue
            try:
                return provider.generate(system, transcript, tools)
            except Exception as exc:  # noqa: BLE001 - any provider failure means "try the next one"
                busy, retry_after = classify_failure(exc)
                # The message names the exact limit that was hit (per minute vs
                # per day), which is the only place that shows up.
                logger.warning(
                    "Booking assistant provider %s %s: %s",
                    provider.name, "is busy" if busy else "failed", str(exc)[:300],
                )
                self._start_cooldown(provider, busy, retry_after)
                if busy:
                    busy_waits.append(retry_after or BUSY_COOLDOWN_SECONDS)
        if busy_waits:
            raise ProviderBusyError("Every model provider is busy right now.", retry_after=min(busy_waits))
        raise RuntimeError("No model provider is available.")


def get_provider(config):
    """Builds the provider chain from app config, or None when no model is
    set up (booking mode is then simply unavailable and the plain chat keeps
    working). AGENT_PROVIDER forces a single choice (azure | gemini | groq);
    left empty, every configured provider is used in that order, so a
    rate-limited one falls back to the next."""
    forced = (config.get("AGENT_PROVIDER") or "").lower()
    azure_ready = all(
        config.get(key) for key in ("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT")
    )

    chain = []
    if forced in ("", "azure") and azure_ready:
        chain.append(
            AzureOpenAIProvider(
                endpoint=config["AZURE_OPENAI_ENDPOINT"],
                api_key=config["AZURE_OPENAI_API_KEY"],
                deployment=config["AZURE_OPENAI_DEPLOYMENT"],
                api_version=config.get("AZURE_OPENAI_API_VERSION") or "2024-10-21",
            )
        )
    if forced in ("", "gemini") and config.get("GEMINI_API_KEY"):
        chain.append(GeminiProvider(api_key=config["GEMINI_API_KEY"]))
    if forced in ("", "groq") and config.get("GROQ_API_KEY"):
        chain.append(GroqProvider(api_key=config["GROQ_API_KEY"], model=config.get("GROQ_MODEL") or GROQ_DEFAULT_MODEL))
    return FallbackProvider(chain) if chain else None
