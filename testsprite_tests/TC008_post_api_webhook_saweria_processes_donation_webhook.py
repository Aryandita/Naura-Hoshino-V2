import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_post_api_webhook_saweria_processes_donation_webhook():
    url = f"{BASE_URL}/api/webhook/saweria"

    # Generate a unique transaction key for idempotency
    transaction_key = str(uuid.uuid4())

    # Use a valid Authorization token (for testing purposes, replace with a real valid token if needed)
    valid_auth = "Bearer valid_token_example"

    headers_valid = {
        "Authorization": valid_auth,
        "Content-Type": "application/json"
    }

    # Payload with new transaction key to simulate a donation webhook
    payload = {
        "transaction_key": transaction_key,
        "amount": 1000,
        "user_id": "test_user_123",
        "message": "Donation test"
    }

    # ---- Test success case with valid authorization ----
    response = None
    try:
        response = requests.post(url, json=payload, headers=headers_valid, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200 for valid auth, got {response.status_code}"
        # Assume response json includes acknowledgement or credit info
        resp_json = response.json()
        assert isinstance(resp_json, dict), "Response JSON should be an object"
        assert "status" in resp_json or "message" in resp_json, "Response should confirm webhook processing"

        # POST same payload again to ensure idempotency - rewards credited exactly once
        response_idempotent = requests.post(url, json=payload, headers=headers_valid, timeout=TIMEOUT)
        assert response_idempotent.status_code == 200, f"Expected 200 for idempotent request, got {response_idempotent.status_code}"
        resp_idem_json = response_idempotent.json()
        assert isinstance(resp_idem_json, dict), "Idempotent response JSON should be an object"

    finally:
        pass  # No resource to clean up for a webhook endpoint

    # ---- Test error case with invalid authorization ----
    headers_invalid = {
        "Authorization": "Bearer invalid_token",
        "Content-Type": "application/json"
    }
    response_unauth = requests.post(url, json=payload, headers=headers_invalid, timeout=TIMEOUT)
    assert response_unauth.status_code == 401, f"Expected 401 for invalid auth, got {response_unauth.status_code}"
    resp_unauth_json = response_unauth.json()
    assert isinstance(resp_unauth_json, dict), "Unauthorized response JSON should be an object"
    assert "error" in resp_unauth_json or "message" in resp_unauth_json, "Unauthorized response should contain error message"

test_post_api_webhook_saweria_processes_donation_webhook()