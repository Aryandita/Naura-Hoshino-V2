import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# Assumed valid auth token for guild admin with permission to modify automations
AUTH_TOKEN = "Bearer your_valid_auth_token_here"

def test_post_api_guild_id_automations_saves_automation_workflows():
    headers = {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json"
    }

    # This guild_id should be a valid guild where the auth token gives permission.
    guild_id = None

    # Step 1: If guild_id is not provided, create a guild to use for testing (simulate)
    # The PRD does not provide an endpoint to create a guild through API so we must assume a valid guild_id.
    # For demonstration, we will assume a valid guild_id. If no valid guild_id is known, the test would fail or be skipped.
    # Replace '123456789' with a valid guild id if available.
    guild_id = "123456789"

    # Valid workflow data example (simulate a proper workflow structure)
    valid_workflow_data = {
        "name": "Test Automation Workflow",
        "triggers": [
            {
                "type": "message",
                "conditions": [
                    {"field": "content", "operator": "contains", "value": "hello"}
                ]
            }
        ],
        "actions": [
            {
                "type": "send_message",
                "parameters": {"channel_id": "general", "message": "Hello from automation"}
            }
        ],
        "active": True
    }

    # Malformed workflow data example (missing required fields or invalid structure)
    malformed_workflow_data = {
        "name": "",   # empty name may be invalid
        "triggers": "should_be_list_not_string",
        "actions": [],
        "active": "not_a_boolean"
    }

    # URL for the POST automations endpoint
    url = f"{BASE_URL}/api/guild/{guild_id}/automations"

    # Test valid workflow data - expect 200 and confirmation in response
    response_valid = requests.post(url, headers=headers, json=valid_workflow_data, timeout=TIMEOUT)
    try:
        assert response_valid.status_code == 200, f"Expected status 200 for valid workflow, got {response_valid.status_code}"
        json_response = response_valid.json()
        # Confirm response indicates save and activation (presence of specific keys or flags)
        assert "success" in json_response and json_response["success"] is True or "message" in json_response, \
            "Response JSON does not indicate success for saving automation"
    except Exception as e:
        print(f"Valid workflow test failed: {e}")
        raise

    # Test malformed workflow data - expect 400 error
    response_malformed = requests.post(url, headers=headers, json=malformed_workflow_data, timeout=TIMEOUT)
    try:
        assert response_malformed.status_code == 400, f"Expected status 400 for malformed data, got {response_malformed.status_code}"
        # Optionally check error message presence
        json_err = response_malformed.json()
        assert any(key in json_err for key in ["error", "message"]), "Error response lacks error/message key"
    except Exception as e:
        print(f"Malformed workflow test failed: {e}")
        raise


test_post_api_guild_id_automations_saves_automation_workflows()