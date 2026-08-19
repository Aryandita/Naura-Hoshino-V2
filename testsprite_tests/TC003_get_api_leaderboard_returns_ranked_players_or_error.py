import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_get_api_leaderboard_returns_ranked_players_or_error():
    valid_types = ["wealth", "trivia"]
    invalid_type = "unknown"
    endpoint = f"{BASE_URL}/api/leaderboard"
    
    # Test valid types
    for t in valid_types:
        params = {"type": t}
        try:
            response = requests.get(endpoint, params=params, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"Request failed for type={t}: {e}"

        assert response.status_code == 200, f"Expected 200 for type={t}, got {response.status_code}"
        try:
            data = response.json()
        except Exception as e:
            assert False, f"Response JSON parsing failed for type={t}: {e}"
        assert isinstance(data, list), f"Expected a list in response for type={t}"
        assert all(isinstance(item, dict) for item in data), f"Expected all items to be dicts for type={t}"
        # Optional: check some expected keys in the player objects for richer validation
        if data:
            keys = data[0].keys()
            assert any(k in keys for k in ["avatar", "net_worth", "rank", "points", "level"]), "Expected known keys missing in player objects"
    
    # Test invalid type
    params = {"type": invalid_type}
    try:
        response = requests.get(endpoint, params=params, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed for invalid type={invalid_type}: {e}"

    assert response.status_code == 500, f"Expected 500 for invalid type, got {response.status_code}"
    try:
        error_data = response.json()
    except Exception as e:
        assert False, f"Response JSON parsing failed for invalid type: {e}"
    assert isinstance(error_data, dict), "Expected error response to be an object"

test_get_api_leaderboard_returns_ranked_players_or_error()