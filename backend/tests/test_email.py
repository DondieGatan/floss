import httpx
import pytest

from app.email import send_email, is_configured


def test_not_configured_by_default_and_logs_instead_of_sending(app, caplog):
    assert is_configured() is False
    with caplog.at_level("INFO"):
        sent = send_email("alex@example.com", "Subject", "<p>Body</p>")
    assert sent is False
    assert "alex@example.com" in caplog.text


def test_sends_via_resend_when_configured(app, monkeypatch):
    app.config["RESEND_API_KEY"] = "test-key"
    assert is_configured() is True

    captured = {}

    class _FakeResponse:
        def raise_for_status(self):
            pass

    def _fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return _FakeResponse()

    monkeypatch.setattr(httpx, "post", _fake_post)

    sent = send_email("alex@example.com", "Subject", "<p>Body</p>")

    assert sent is True
    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["to"] == ["alex@example.com"]
    assert captured["json"]["subject"] == "Subject"
    assert captured["json"]["html"] == "<p>Body</p>"
    assert captured["json"]["from"] == app.config["EMAIL_FROM_ADDRESS"]


def test_returns_false_without_raising_when_resend_call_fails(app, monkeypatch):
    app.config["RESEND_API_KEY"] = "test-key"

    def _fake_post(*args, **kwargs):
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(httpx, "post", _fake_post)

    sent = send_email("alex@example.com", "Subject", "<p>Body</p>")

    assert sent is False
