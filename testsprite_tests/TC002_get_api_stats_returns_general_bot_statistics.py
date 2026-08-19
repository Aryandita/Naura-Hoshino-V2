import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_get_api_stats_returns_general_bot_statistics():
    url = f"{BASE_URL}/api/stats"
    try:
        response = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate that required keys exist and their types are correct
    # Keys: total users, total guilds, RAM usage statistics
    expected_keys = ["totalUsers", "totalGuilds", "ramUsage"]
    for key in expected_keys:
        assert key in data, f"Response JSON missing key: {key}"

    # Further validate types and values if possible
    assert isinstance(data["totalUsers"], int), "totalUsers should be an integer"
    assert data["totalUsers"] >= 0, "totalUsers should be non-negative"

    assert isinstance(data["totalGuilds"], int), "totalGuilds should be an integer"
    assert data["totalGuilds"] >= 0, "totalGuilds should be non-negative"

    # ramUsage might be an object with memory fields or a numeric value, validate accordingly
    ram = data["ramUsage"]
    assert ram is not None, "ramUsage should not be None"
    assert (isinstance(ram, dict) or isinstance(ram, (int, float))), "ramUsage should be dict or number"

test_get_api_stats_returns_general_bot_statistics()