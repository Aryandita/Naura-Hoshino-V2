import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
AUTH_TOKEN = "your_valid_auth_token_here"  # Replace with a valid auth token

def test_post_api_user_language_updates_user_language_preference():
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    valid_language_payload = {"language": "id"}
    invalid_language_payload = {"language": "fr"}

    # Test valid language update
    try:
        response_valid = requests.post(
            f"{BASE_URL}/api/user/language",
            json=valid_language_payload,
            headers=headers,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"Request failed for valid language update: {e}"
    assert response_valid.status_code == 200, f"Expected 200 for valid language update, got {response_valid.status_code}"
    json_valid = response_valid.json()
    assert isinstance(json_valid, dict), "Response for valid language update should be a JSON object"

    # Test invalid language update
    try:
        response_invalid = requests.post(
            f"{BASE_URL}/api/user/language",
            json=invalid_language_payload,
            headers=headers,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"Request failed for invalid language update: {e}"
    assert response_invalid.status_code == 400, f"Expected 400 for invalid language update, got {response_invalid.status_code}"
    json_invalid = response_invalid.json()
    assert isinstance(json_invalid, dict), "Response for invalid language update should be a JSON object"

test_post_api_user_language_updates_user_language_preference()