# 📡 Panduan Integrasi Circuit Breaker & API Cache

## Overview
Dokumen ini menjelaskan cara mengintegrasikan Circuit Breaker dan API Response Cache ke command yang menggunakan API pihak ketiga.

## File Utility Baru
1. `src/utils/circuitBreaker.js` - Proteksi dari API overload
2. `src/utils/apiResponseCache.js` - Cache response untuk reduce redundant requests
3. `src/services/apiHealthService.js` - Health check monitoring

---

## 1. Circuit Breaker Integration

### Basic Usage
```javascript
const { getOrCreateBreaker, CircuitBreakerOpenError } = require("../../src/utils/circuitBreaker");

// Buat atau ambil circuit breaker untuk API tertentu
const weatherBreaker = getOrCreateBreaker("weather-openmeteo", {
  failureThreshold: 5,      // Buka circuit setelah 5 failure berturut-turut
  resetTimeout: 60000,      // Coba lagi setelah 60 detik
  halfOpenMaxAttempts: 3,   // 3 success di HALF_OPEN untuk close circuit
});

async function fetchWeather(city) {
  try {
    return await weatherBreaker.execute(async () => {
      const response = await axios.get(`https://api.open-meteo.com/...`, { timeout: 5000 });
      return response.data;
    });
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      // Circuit sedang OPEN, gunakan fallback atau cached data
      logger.warn("[Weather] Circuit breaker open, using fallback");
      return fetchFromFallback(city);
    }
    throw error;
  }
}
```

### Konfigurasi Rekomendasi per API

| API | failureThreshold | resetTimeout | Alasan |
|-----|-----------------|--------------|--------|
| Open-Meteo | 5 | 60s | Public API, rate limit longgar |
| Jikan (MAL) | 3 | 120s | Strict rate limit (3 req/s) |
| AniList | 5 | 60s | GraphQL, stable |
| OMDB | 3 | 300s | Paid API, limited quota |
| Mojang | 5 | 60s | Official API, reliable |
| Cobalt | 8 | 30s | Multi-instance, fast failover |

---

## 2. API Response Cache Integration

### Basic Usage
```javascript
const { globalCache } = require("../../src/utils/apiResponseCache");

async function searchAnime(query) {
  // Cek cache dulu
  const cached = globalCache.get("anime", { query });
  if (cached) {
    logger.debug(`[Anime] Cache hit for "${query}"`);
    return cached;
  }

  // Fetch dari API
  const results = await fetchFromJikan(query);
  
  // Simpan ke cache (TTL default 5 menit)
  if (results && results.length > 0) {
    globalCache.set("anime", { query }, results);
  }
  
  return results;
}
```

### Custom TTL per Data Type
```javascript
const animeCache = new ApiResponseCache({ ttl: 300000, maxSize: 200 });   // 5 min
const weatherCache = new ApiResponseCache({ ttl: 600000, maxSize: 100 }); // 10 min
const movieCache = new ApiResponseCache({ ttl: 900000, maxSize: 150 });   // 15 min
```

---

## 3. Combined Pattern (Recommended)

```javascript
const { getOrCreateBreaker, CircuitBreakerOpenError } = require("../../src/utils/circuitBreaker");
const { globalCache } = require("../../src/utils/apiResponseCache");

const jikanBreaker = getOrCreateBreaker("anime-jikan", {
  failureThreshold: 3,
  resetTimeout: 120000,
});

async function searchAnimeWithProtection(query) {
  // 1. Check cache first
  const cached = globalCache.get("anime-jikan", { query });
  if (cached) return cached;

  // 2. Execute with circuit breaker
  try {
    const results = await jikanBreaker.execute(async () => {
      const response = await axios.get(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`,
        { timeout: 5000 }
      );
      return response.data?.data || [];
    });

    // 3. Cache successful result
    if (results.length > 0) {
      globalCache.set("anime-jikan", { query }, results);
    }

    return results;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      logger.warn("[Anime] Jikan circuit open, trying AniList fallback");
      return fetchFromAniList(query); // Fallback ke provider lain
    }
    throw error;
  }
}
```

---

## 4. Monitoring & Dashboard

### Health Check Endpoint
```
GET /api/health/external
```
Response:
```json
{
  "timestamp": "2026-10-23T05:30:00.000Z",
  "apis": [
    { "name": "Open-Meteo (Weather)", "status": "healthy", "latency": 245 },
    { "name": "Jikan (Anime)", "status": "healthy", "latency": 380 }
  ],
  "circuitBreakers": [
    { "name": "weather-openmeteo", "state": "CLOSED", "failureCount": 0 }
  ],
  "summary": {
    "total": 6,
    "healthy": 6,
    "unhealthy": 0,
    "avgLatency": 312
  }
}
```

### Circuit Breaker Status
```
GET /api/health/circuit-breakers
```

---

## 5. Migration Checklist

Untuk setiap command yang menggunakan API eksternal:

- [ ] Import circuit breaker utility
- [ ] Buat breaker instance dengan config sesuai API
- [ ] Wrap API call dengan `breaker.execute()`
- [ ] Handle `CircuitBreakerOpenError` dengan fallback
- [ ] Tambahkan caching untuk response yang sering diakses
- [ ] Test dengan simulate API failure
- [ ] Monitor via dashboard health endpoint

---

## 6. Command Priority untuk Migrasi

| Priority | Command | Reason |
|----------|---------|--------|
| 🔴 HIGH | `/weather` | High traffic, public API |
| 🔴 HIGH | `/anime` | Multiple APIs, rate limited |
| 🟡 MED | `/movie` | Paid API (OMDB) |
| 🟡 MED | `/minecraft` | Mojang API dependency |
| 🟢 LOW | `/download` | Already has multi-instance fallback |

---

## 7. Testing

### Simulate Circuit Breaker
```javascript
// Force open circuit untuk testing
const breaker = getOrCreateBreaker("test-api");
for (let i = 0; i < 10; i++) {
  breaker.onFailure();
}
console.log(breaker.getState()); // { state: "OPEN", ... }
```

### Clear Cache
```javascript
globalCache.clear();
```

---

## 8. Best Practices

1. **Jangan cache error response** - Hanya cache successful results
2. **Gunakan TTL yang sesuai** - Weather: 10min, Anime/Movie: 5-15min
3. **Monitor circuit breaker state** - Alert jika terlalu banyak OPEN
4. **Fallback gracefully** - Selalu punya backup plan saat circuit OPEN
5. **Log state transitions** - Untuk debugging dan monitoring

---

## References
- Circuit Breaker Pattern: Martin Fowler
- Cache-Aside Pattern: Microsoft Azure
- Naura Hoshino V2 AGENTS.md Section 3.8 (AI Ensemble Router & Circuit Breaker Logic)
