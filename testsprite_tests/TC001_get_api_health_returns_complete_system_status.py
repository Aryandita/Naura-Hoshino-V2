import requests

def test_get_api_health_returns_complete_system_status():
    base_url = "http://localhost:3000"
    url = f"{base_url}/api/health"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request to /api/health failed: {e}"

    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    # Validate keys presence
    expected_keys = ["uptime", "memory", "shards", "database", "lavalink"]
    for key in expected_keys:
        assert key in data, f"Missing expected key '{key}' in response"

    # Validate uptime is a positive number
    uptime = data.get("uptime")
    assert isinstance(uptime, (int, float)) and uptime >= 0, "Uptime should be a non-negative number"

    # Validate memory usage is present and is dict with typical keys
    memory = data.get("memory")
    assert isinstance(memory, dict), "Memory usage should be an object"
    mem_keys = ["rss", "heapTotal", "heapUsed", "external"]
    for mk in mem_keys:
        assert mk in memory, f"Memory usage missing key '{mk}'"
        assert isinstance(memory[mk], (int, float)), f"Memory value '{mk}' should be numerical"

    # Validate shards is a dict or list showing shard status
    shards = data.get("shards")
    assert isinstance(shards, (dict, list)), "Shards status should be dict or list"

    # Validate database connectivity info is present and indicates status
    database = data.get("database")
    assert isinstance(database, dict), "Database info should be an object"
    assert "connected" in database, "Database info should have 'connected' key"
    assert isinstance(database["connected"], bool), "'connected' should be boolean"

    # Validate lavalink node status is present and indicates status
    lavalink = data.get("lavalink")
    assert isinstance(lavalink, dict), "Lavalink info should be an object"
    assert "connected" in lavalink, "Lavalink info should have 'connected' key"
    assert isinstance(lavalink["connected"], bool), "'connected' in lavalink should be boolean"

test_get_api_health_returns_complete_system_status()