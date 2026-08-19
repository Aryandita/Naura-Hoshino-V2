import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# These tokens and guild IDs should be replaced with valid test values.
VALID_AUTH_TOKEN = "Bearer YOUR_VALID_AUTH_TOKEN"
VALID_GUILD_ID = "123456789"  # Example guild id with access
NO_ACCESS_GUILD_ID = "987654321"  # Example guild id without access

def test_get_api_guild_id_settings_returns_guild_configuration():
    headers_valid = {
        "Authorization": VALID_AUTH_TOKEN,
        "Accept": "application/json"
    }

    # Test case 1: valid authentication with guild access returns 200 and expected structure
    url_valid = f"{BASE_URL}/api/guild/{VALID_GUILD_ID}/settings"
    try:
        response = requests.get(url_valid, headers=headers_valid, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected 200 status, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate presence of welcomer configuration and AI persona data in the response
    assert isinstance(data, dict), "Response JSON is not an object"
    # Check welcomer configuration
    assert "welcomer" in data, "Welcomer configuration missing in response"
    # Check AI persona data
    assert "aiPersona" in data or "ai_persona" in data, "AI persona data missing in response"

    # Test case 2: valid authentication but no permission returns 403
    url_no_access = f"{BASE_URL}/api/guild/{NO_ACCESS_GUILD_ID}/settings"
    try:
        response_no_access = requests.get(url_no_access, headers=headers_valid, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response_no_access.status_code == 403, f"Expected 403 status for no access, got {response_no_access.status_code}"

test_get_api_guild_id_settings_returns_guild_configuration()