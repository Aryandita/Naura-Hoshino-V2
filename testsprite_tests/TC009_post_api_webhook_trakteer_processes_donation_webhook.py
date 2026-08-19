import requests
import uuid

BASE_URL = "http://localhost:3000"
WEBHOOK_PATH = "/api/webhook/trakteer"
AUTH_TOKEN = "Bearer valid_token_for_testing"  # Replace this with a valid token if needed
TIMEOUT = 30

def test_post_api_webhook_trakteer_processes_donation_webhook():
    headers = {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json"
    }

    # Generate a unique transaction key for initial request to simulate new transaction
    unique_tx_key = str(uuid.uuid4())

    payload_new_tx = {
        "transaction_key": unique_tx_key,
        "amount": 10000,
        "user_id": "test_user_id",
        "donation_type": "donation"
    }

    # Send first POST: new transaction - expect 200 and processing
    response_new_tx = requests.post(
        f"{BASE_URL}{WEBHOOK_PATH}",
        headers=headers,
        json=payload_new_tx,
        timeout=TIMEOUT
    )
    assert response_new_tx.status_code == 200, f"Expected 200 for new transaction, got {response_new_tx.status_code}"
    res_json = response_new_tx.json()
    # Assert response contains acknowledgement or processing confirmation (flexible as no exact schema given)
    assert isinstance(res_json, dict), "Response for new transaction should be a JSON object"

    # Send duplicate POST: same transaction key - expect 200 and skip processing
    response_dup_tx = requests.post(
        f"{BASE_URL}{WEBHOOK_PATH}",
        headers=headers,
        json=payload_new_tx,
        timeout=TIMEOUT
    )
    assert response_dup_tx.status_code == 200, f"Expected 200 for duplicate transaction, got {response_dup_tx.status_code}"
    res_dup_json = response_dup_tx.json()
    assert isinstance(res_dup_json, dict), "Response for duplicate transaction should be a JSON object"

test_post_api_webhook_trakteer_processes_donation_webhook()