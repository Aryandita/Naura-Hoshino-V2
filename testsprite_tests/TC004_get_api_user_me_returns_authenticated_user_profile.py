import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# Replace this token with a valid authentication token for the API.
AUTH_TOKEN = "your_valid_auth_token_here"

def test_get_api_user_me_returns_authenticated_user_profile():
    url = f"{BASE_URL}/api/user/@me"
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

        data = response.json()
        # Assert some keys to verify it's a Discord profile and session data
        assert "id" in data, "Response missing 'id' field"
        assert "username" in data, "Response missing 'username' field"
        assert "discriminator" in data, "Response missing 'discriminator' field"
        assert "avatar" in data, "Response missing 'avatar' field"
        assert "session" in data, "Response missing 'session' data"

    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"
    except ValueError:
        assert False, "Response is not valid JSON"

test_get_api_user_me_returns_authenticated_user_profile()