// CONFIG

const API_KEY = "3ba3f46fbd03d9327098f532c6d4d4b3";

const DEFAULT_CITY = "Chandigarh";

// STATE

let tempChart;
let isCelsius = true;
let currentTempC = 0; 
let hourlyTemps = []; 
let lastWeatherData = null;
let lastForecastData = null;

// HELPERS

function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function $(id) {
    return document.getElementById(id);
}

// ELEMENTS

const temp = $("temp");
const cityName = $("cityName");
const condition = $("condition");
const humidity = $("humidity");
const wind = $("wind");
const feelsLike = $("feelsLike");
const weatherIcon = $("weatherIcon");

const pressure = $("pressure");
const visibility = $("visibility");
const maxTemp = $("maxTemp");
const minTemp = $("minTemp");

const sunriseTime = $("sunriseTime");
const sunsetTime = $("sunsetTime");

const searchForm = $("searchForm");
const cityInput = $("cityInput");
const locationBtn = $("locationBtn");
const darkModeBtn = $("darkModeBtn");
const favoriteBtn = $("favoriteBtn");

const aqiScore = $("aqiScore");
const aqiStatus = $("aqiStatus");

const historyBtn = $("historyBtn");
const historyPopup = $("historyPopup");
const closeHistory = $("closeHistory");
const clearHistoryBtn = $("clearHistoryBtn");

const voiceBtn = $("voiceBtn");

const rainChance = $("rainChance");
const rainStatus = $("rainStatus");

const dayProgressFill = $("dayProgressFill");
const dayProgressPercent = $("dayProgressPercent");
const dayProgressText = $("dayProgressText");

const unitBtn = $("unitBtn");

const favoritesBtn = $("favoritesBtn");
const favoritesPopup = $("favoritesPopup");
const favoritesList = $("favoritesList");
const closeFavorites = $("closeFavorites");
const clearFavoritesBtn = $("clearFavoritesBtn");

const popupBackdrop = $("popupBackdrop");

const weatherMap = $("weatherMap");
const sparklineCanvas = $("sparkline");

const savedCity = localStorage.getItem("lastCity");

// WEATHER (by city name)

async function getWeather(city) {

    city = (city || "").trim();

    if (city === "") {
        alert("Please enter a city.");
        return;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;

    try {
        showLoader();

        const response = await fetch(url);
        const data = await response.json();

        if (data.cod != 200) {
            throw new Error(data.message || "City not found");
        }

        renderWeather(data);
        updateAmbientGlow(data.weather[0].main);

        await getForecastAndHourly(data.coord.lat, data.coord.lon);
        getAirQuality(data.coord.lat, data.coord.lon);
        updateWeatherMap(data.coord.lat, data.coord.lon);

    }
    catch (error) {
        console.error(error);

        cityName.innerHTML = "City not found";
        condition.innerHTML = "Try a different spelling";
        weatherIcon.style.display = "none";
    }
    finally {
        hideLoader();
    }
}

// WEATHER (by coordinates)

async function getWeatherByCoords(lat, lon) {

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

    try {
        showLoader();

        const response = await fetch(url);
        const data = await response.json();

        if (data.cod != 200) {
            throw new Error(data.message || "Location not found");
        }

        renderWeather(data);
        updateAmbientGlow(data.weather[0].main);

        await getForecastAndHourly(lat, lon);
        getAirQuality(lat, lon);
        updateWeatherMap(lat, lon);

    }
    catch (error) {
        console.error(error);

        cityName.innerHTML = "Location not found";
        condition.innerHTML = "Try again";
        weatherIcon.style.display = "none";
    }
    finally {
        hideLoader();
    }
}

// SHARED RENDER LOGIC

function renderWeather(data) {

    lastWeatherData = data;
    currentTempC = data.main.temp;
    renderTempDisplay();

    condition.innerHTML = data.weather[0].description;
    cityName.innerHTML = `${data.name}, ${data.sys.country}`;

    humidity.innerHTML = data.main.humidity + "%";

    // API returns wind speed in m/s — convert to km/h
    const windKmh = (data.wind.speed * 3.6).toFixed(1);
    wind.innerHTML = windKmh + " km/h";

    const windDirectionEl = $("windDirection");
    if (windDirectionEl && typeof data.wind.deg === "number") {
        windDirectionEl.innerHTML = getWindDirection(data.wind.deg);
    }

    feelsLike.innerHTML = `Feels like ${Math.round(data.main.feels_like)}°`;

    if (pressure) pressure.innerHTML = data.main.pressure + " hPa";
    if (visibility) visibility.innerHTML = (data.visibility / 1000) + " km";
    if (maxTemp) maxTemp.innerHTML = Math.round(data.main.temp_max) + "°";
    if (minTemp) minTemp.innerHTML = Math.round(data.main.temp_min) + "°";
    if (sunriseTime) sunriseTime.innerHTML = formatTime(data.sys.sunrise);
    if (sunsetTime) sunsetTime.innerHTML = formatTime(data.sys.sunset);

    updateDayProgress(data.sys.sunrise, data.sys.sunset);

    weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    weatherIcon.onerror = function () {
        this.src = "https://cdn-icons-png.flaticon.com/512/1163/1163661.png";
    };
    weatherIcon.style.display = "block";
    weatherIcon.alt = data.weather[0].description;

    localStorage.setItem("lastCity", data.name);
    saveHistory(data.name);

    updateWeatherTip(data.weather[0].main);
    createWeatherAnimation(data.weather[0].main);
}

function renderTempDisplay() {
    if (isCelsius) {
        temp.innerHTML = Math.round(currentTempC) + "°";
    } else {
        const f = (currentTempC * 9 / 5) + 32;
        temp.innerHTML = Math.round(f) + "°";
    }
}

function updateDayProgress(sunrise, sunset) {

    const now = Date.now();

    const sunriseMs = sunrise * 1000;
    const sunsetMs = sunset * 1000;

    let percent = ((now - sunriseMs) / (sunsetMs - sunriseMs)) * 100;
    percent = Math.max(0, Math.min(100, percent));

    if (dayProgressFill) dayProgressFill.style.width = percent + "%";
    if (dayProgressPercent) dayProgressPercent.textContent = Math.round(percent) + "%";

    if (!dayProgressText) return;

    if (now < sunriseMs) {
        dayProgressText.textContent = "Before sunrise";
    } else if (now > sunsetMs) {
        dayProgressText.textContent = "After sunset";
    } else {
        dayProgressText.textContent = "Daylight";
    }
}

// UNIT TOGGLE (°C / °F)

if (unitBtn) {
    unitBtn.textContent = "°F";
    unitBtn.addEventListener("click", () => {
        isCelsius = !isCelsius;
        renderTempDisplay();
        unitBtn.textContent = isCelsius ? "°F" : "°C";

        rerenderUnitDependentUI();
    });
}

function convertDisplay(celsius) {
    return isCelsius ? Math.round(celsius) : Math.round((celsius * 9 / 5) + 32);
}

function rerenderUnitDependentUI() {
    if (lastForecastData) {
        renderDailyForecast(lastForecastData);
        renderHourlyForecast(lastForecastData);
    }
    if (maxTemp && lastWeatherData) maxTemp.innerHTML = convertDisplay(lastWeatherData.main.temp_max) + "°";
    if (minTemp && lastWeatherData) minTemp.innerHTML = convertDisplay(lastWeatherData.main.temp_min) + "°";
    if (feelsLike && lastWeatherData) feelsLike.innerHTML = `Feels like ${convertDisplay(lastWeatherData.main.feels_like)}°`;
}

// SEARCH

const COUNTRY_NAMES = [
    "india", "usa", "united states", "canada", "australia",
    "china", "japan", "france", "germany", "italy",
    "pakistan", "nepal", "bangladesh", "russia", "uk",
    "united kingdom", "brazil", "mexico"
];

if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const city = cityInput.value.trim();

        if (!city) {
            alert("Enter a city");
            return;
        }

        if (COUNTRY_NAMES.includes(city.toLowerCase())) {
            alert("Please enter a CITY name, not a country.\nExample: Delhi, Mumbai, Chandigarh");
            return;
        }

        getWeather(city);
        cityInput.blur();
    });
}

// CURRENT LOCATION

function getCurrentLocation() {

    if (!navigator.geolocation) {
        alert("Geolocation is not supported in this browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            getWeatherByCoords(lat, lon);
        },
        () => {
            alert("Location access denied");
        }
    );
}

if (locationBtn) locationBtn.addEventListener("click", getCurrentLocation);

// FORECAST + HOURLY + CHART

async function getForecastAndHourly(lat, lon) {

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (String(data.cod) !== "200") return;

        lastForecastData = data;

        renderDailyForecast(data);
        renderHourlyForecast(data);
        drawTemperatureChart(data);
        drawSparkline(data);

        const chance = Math.round((data.list[0].pop || 0) * 100);

        if (rainChance) rainChance.textContent = `${chance}%`;

        if (rainStatus) {
            if (chance < 20) {
                rainStatus.textContent = "Low chance of rain";
            } else if (chance < 50) {
                rainStatus.textContent = "Moderate chance of rain";
            } else if (chance < 80) {
                rainStatus.textContent = "High chance of rain";
            } else {
                rainStatus.textContent = "Very high chance of rain";
            }
        }

    }
    catch (error) {
        console.error(error);
    }
}

function renderDailyForecast(data) {

    const forecastList = $("forecastList");
    if (!forecastList) return;

    forecastList.innerHTML = "";

    const dailyForecast = [];
    const addedDates = new Set();

    for (const item of data.list) {
        const date = item.dt_txt.split(" ")[0];

        if (!addedDates.has(date)) {
            addedDates.add(date);
            dailyForecast.push(item);
        }

        if (dailyForecast.length === 5) break;
    }

    dailyForecast.forEach(item => {

        const day = new Date(item.dt_txt).toLocaleDateString("en-US", {
            weekday: "short"
        });

        const hi = convertDisplay(item.main.temp_max);
        const lo = convertDisplay(item.main.temp_min);

        forecastList.innerHTML += `
            <div class="forecast-row">
                <span>${day}</span>
                <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" alt="${item.weather[0].description}">
                <span>${hi}° / ${lo}°</span>
            </div>
        `;
    });
}

function renderHourlyForecast(data) {

    const hourlyContainer = $("hourlyContainer");
    if (!hourlyContainer) return;

    hourlyContainer.innerHTML = "";

    const count = Math.min(8, data.list.length);

    for (let i = 0; i < count; i++) {

        const item = data.list[i];

        const time = i === 0
            ? "Now"
            : new Date(item.dt_txt).toLocaleTimeString([], { hour: "numeric" });

        const t = convertDisplay(item.main.temp);

        hourlyContainer.innerHTML += `
            <div class="hour-card">
                <p>${time}</p>
                <img
                    src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png"
                    width="40"
                    height="40"
                    alt="${item.weather[0].description}">
                <h4>${t}°</h4>
            </div>
        `;
    }
}

function drawTemperatureChart(data) {

    const labels = [];
    const temps = [];

    const count = Math.min(8, data.list.length);

    for (let i = 0; i < count; i++) {
        labels.push(
            new Date(data.list[i].dt_txt).toLocaleTimeString([], { hour: "numeric" })
        );
        temps.push(data.list[i].main.temp);
    }

    if (tempChart) {
        tempChart.destroy();
    }

    const canvas = $("tempChart");
    if (!canvas || typeof Chart === "undefined") return;

    const isLight = document.body.classList.contains("light");
    const gridColor = isLight ? "rgba(15,23,42,.06)" : "rgba(255,255,255,.06)";
    const textColor = isLight ? "#5b6478" : "#8d97ad";

    tempChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Temperature",
                data: temps,
                borderColor: "#f5a623",
                backgroundColor: "rgba(245, 166, 35, 0.12)",
                pointBackgroundColor: "#f5a623",
                pointBorderColor: "transparent",
                pointRadius: 3,
                borderWidth: 2,
                tension: .4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${convertDisplay(ctx.raw)}°`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 11 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 11 },
                        callback: (value) => Math.round(isCelsius ? value : (value * 9 / 5) + 32) + "°"
                    }
                }
            }
        }
    });
}

// Signature element: a quiet sparkline tracing the day's temperature curve
// behind the big current-temperature number in the hero.

function drawSparkline(data) {

    hourlyTemps = data.list.slice(0, 8).map(i => i.main.temp);
    renderSparkline();
}

function renderSparkline() {

    if (!sparklineCanvas || hourlyTemps.length < 2) return;

    const ctx = sparklineCanvas.getContext("2d");
    const rect = sparklineCanvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const w = rect.width;
    const h = 90;

    sparklineCanvas.width = w * dpr;
    sparklineCanvas.height = h * dpr;
    sparklineCanvas.style.width = w + "px";
    sparklineCanvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...hourlyTemps);
    const max = Math.max(...hourlyTemps);
    const range = max - min || 1;
    const padY = 14;

    const points = hourlyTemps.map((t, i) => {
        const x = (i / (hourlyTemps.length - 1)) * w;
        const y = h - padY - ((t - min) / range) * (h - padY * 2);
        return [x, y];
    });

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        const [px, py] = points[i - 1];
        const [cx, cy] = points[i];
        const mx = (px + cx) / 2;
        ctx.quadraticCurveTo(px, py, mx, (py + cy) / 2);
        ctx.quadraticCurveTo(mx, (py + cy) / 2, cx, cy);
    }

    ctx.strokeStyle = "#f5a623";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
}

window.addEventListener("resize", () => {
    clearTimeout(window.__sparklineResizeTimer);
    window.__sparklineResizeTimer = setTimeout(renderSparkline, 150);
});

// AIR QUALITY

async function getAirQuality(lat, lon) {

    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.list || !data.list[0]) {
            throw new Error("Air quality data unavailable");
        }

        const aqi = data.list[0].main.aqi;

        if (!aqiScore || !aqiStatus) return;

        aqiScore.innerHTML = aqi;
        aqiScore.classList.remove("aqi-good", "aqi-fair", "aqi-poor");
        const aqiTile = aqiScore.closest(".highlight");
        if (aqiTile) aqiTile.classList.remove("aqi-good", "aqi-fair", "aqi-poor");

        let severity = "aqi-good";
        if (aqi === 3) severity = "aqi-fair";
        else if (aqi >= 4) severity = "aqi-poor";

        aqiScore.classList.add(severity);
        if (aqiTile) aqiTile.classList.add(severity);

        const labels = {
            1: "Good air quality",
            2: "Fair air quality",
            3: "Moderate air quality",
            4: "Poor air quality",
            5: "Very poor air quality"
        };

        aqiStatus.innerHTML = labels[aqi] || "Air quality";

    }
    catch (error) {
        console.log(error);
    }
}

// MAP

function updateWeatherMap(lat, lon) {
    if (!weatherMap) return;
    weatherMap.src = `https://maps.google.com/maps?q=${lat},${lon}&z=10&output=embed`;
}

// THEME (dark default, light optional)

function applyTheme(isLight) {
    document.body.classList.toggle("light", isLight);
    if (darkModeBtn) {
        darkModeBtn.innerHTML = isLight
            ? '<i class="fa-solid fa-moon"></i>'
            : '<i class="fa-solid fa-sun"></i>';
    }
    // Chart colors depend on theme — redraw if we have data on screen.
    if (lastForecastData) drawTemperatureChart(lastForecastData);
}

if (darkModeBtn) {
    const savedTheme = localStorage.getItem("theme");
    applyTheme(savedTheme === "light");

    darkModeBtn.addEventListener("click", () => {
        const nowLight = !document.body.classList.contains("light");
        applyTheme(nowLight);
        localStorage.setItem("theme", nowLight ? "light" : "dark");
    });
}

// =======================
// AMBIENT BACKGROUND
// Procedural glow tint (instant, never fails) PLUS a
// condition-matched photo behind the hero. The photo is
// applied via a preload check — if it fails to load (offline,
// blocked CDN) we silently keep the gradient-only look instead
// of showing a broken image.
// =======================

const HERO_PHOTOS = {
    Clear: [
        "https://images.unsplash.com/photo-1601297183305-6df142704ea2?w=1600&q=70",
        "https://images.unsplash.com/photo-1622278647784-051d39924e0e?w=1600&q=70",
        "https://images.unsplash.com/photo-1567593810070-7a3d471af022?w=1600&q=70"
    ],
    Clouds: [
        "https://images.unsplash.com/photo-1499956827185-0d63ee78a910?w=1600&q=70",
        "https://images.unsplash.com/photo-1505533321630-975218a5f66f?w=1600&q=70",
        "https://images.unsplash.com/photo-1525490829609-d166ddb58678?w=1600&q=70"
    ],
    Rain: [
        "https://images.unsplash.com/photo-1438449805896-28a666819a20?w=1600&q=70",
        "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1600&q=70",
        "https://images.unsplash.com/photo-1428592953211-077101b2021b?w=1600&q=70"
    ],
    Thunderstorm: [
        "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=1600&q=70",
        "https://images.unsplash.com/photo-1605279099163-ef1c0d9e7026?w=1600&q=70"
    ],
    Snow: [
        "https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=1600&q=70",
        "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1600&q=70"
    ],
    Mist: [
        "https://images.unsplash.com/photo-1487621167305-5d248087c724?w=1600&q=70",
        "https://images.unsplash.com/photo-1487622750296-6360190669a1?w=1600&q=70"
    ],
    Haze: [
        "https://images.unsplash.com/photo-1487621167305-5d248087c724?w=1600&q=70",
        "https://images.unsplash.com/photo-1487622750296-6360190669a1?w=1600&q=70"
    ],
    Night: [
        "https://images.unsplash.com/photo-1532978379173-523e16f371f4?w=1600&q=70",
        "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600&q=70"
    ]
};

function isNightNow() {
    if (!lastWeatherData || !lastWeatherData.sys) return false;
    const now = Date.now() / 1000;
    return now < lastWeatherData.sys.sunrise || now > lastWeatherData.sys.sunset;
}

function setHeroPhoto(weatherMain) {

    const hero = $("hero");
    if (!hero) return;

    const night = isNightNow();
    const pool = (night ? HERO_PHOTOS.Night : (HERO_PHOTOS[weatherMain] || HERO_PHOTOS.Clear)).slice();

    // Shuffle so repeated calls don't always try the same order.
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    tryNextPhoto(hero, pool, 0);
}

// Tries each URL in the pool in turn. If every single one fails
// (offline, CDN blocked, etc.) the hero just keeps its flat
// gradient background — never left blank.

function tryNextPhoto(hero, pool, index) {

    if (index >= pool.length) {
        console.warn("Weather hero photo: all candidate images failed to load, using gradient fallback.");
        hero.style.backgroundImage = "";
        hero.classList.remove("has-photo");
        return;
    }

    const url = pool[index];
    const probe = new Image();

    probe.onload = () => {
        hero.style.backgroundImage =
            `linear-gradient(165deg, rgba(10,14,26,.55), rgba(10,14,26,.72)), url("${url}")`;
        hero.classList.add("has-photo");
    };
    probe.onerror = () => {
        tryNextPhoto(hero, pool, index + 1);
    };

    probe.src = url;
}

function updateAmbientGlow(weatherMain) {

    const glows = {
        Clear: ["rgba(245, 166, 35, .22)", "rgba(91, 141, 239, .08)"],
        Clouds: ["rgba(139, 151, 173, .14)", "rgba(91, 141, 239, .10)"],
        Rain: ["rgba(91, 141, 239, .18)", "rgba(60, 80, 130, .14)"],
        Thunderstorm: ["rgba(124, 58, 237, .16)", "rgba(91, 141, 239, .10)"],
        Snow: ["rgba(200, 220, 245, .16)", "rgba(91, 141, 239, .10)"],
        Mist: ["rgba(139, 151, 173, .12)", "rgba(91, 141, 239, .08)"],
        Haze: ["rgba(139, 151, 173, .12)", "rgba(91, 141, 239, .08)"]
    };

    const [a, b] = glows[weatherMain] || glows.Clear;

    document.documentElement.style.setProperty("--glow-a", a);
    document.documentElement.style.setProperty("--glow-b", b);

    setHeroPhoto(weatherMain);
}

// CLOCK

function updateTime() {
    const now = new Date();
    const dateEl = $("dateText");
    const timeEl = $("timeText");

    if (dateEl) dateEl.innerHTML = now.toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
    });
    if (timeEl) timeEl.innerHTML = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

setInterval(updateTime, 1000);

// WIND DIRECTION

function getWindDirection(degree) {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(degree / 45) % 8];
}

// WEATHER TIP

function updateWeatherTip(weatherMain) {

    let tip;

    switch (weatherMain) {
        case "Rain":
            tip = "🌧 Carry an umbrella today.";
            break;
        case "Clear":
            tip = "😎 Clear skies — sunglasses recommended.";
            break;
        case "Clouds":
            tip = "☁ Mild and pleasant conditions.";
            break;
        case "Snow":
            tip = "❄ Dress warmly, snow expected.";
            break;
        case "Thunderstorm":
            tip = "⚡ Stay indoors if possible.";
            break;
        default:
            tip = "🌍 Have a great day!";
    }

    const tipEl = $("weatherTip");
    if (tipEl) tipEl.innerHTML = tip;
}

// SEARCH HISTORY

function saveHistory(city) {

    let history = JSON.parse(localStorage.getItem("history")) || [];

    history = history.filter(c => c.toLowerCase() !== city.toLowerCase());
    history.unshift(city);
    history = history.slice(0, 5);

    localStorage.setItem("history", JSON.stringify(history));
    displayHistory();
}

function displayHistory() {

    const historyList = $("historyList");
    if (!historyList) return;

    const history = JSON.parse(localStorage.getItem("history")) || [];

    historyList.innerHTML = "";

    if (history.length === 0) {
        historyList.innerHTML = "<p>No recent searches</p>";
        return;
    }

    history.forEach(city => {

        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${city}`;

        div.onclick = () => {
            getWeather(city);
            closePopups();
        };

        historyList.appendChild(div);
    });
}

function clearHistory() {
    localStorage.removeItem("history");
    displayHistory();
}

// FAVORITES

if (favoriteBtn) {
    favoriteBtn.addEventListener("click", () => {

        const city = cityName.textContent.split(",")[0].trim();

        if (!city || city === "--") {
            alert("Search for a city first.");
            return;
        }

        let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

        if (!favorites.some(c => c.toLowerCase() === city.toLowerCase())) {
            favorites.push(city);
            localStorage.setItem("favorites", JSON.stringify(favorites));
            favoriteBtn.innerHTML = '<i class="fa-solid fa-star"></i> Added to favorites';
            setTimeout(() => {
                favoriteBtn.innerHTML = '<i class="fa-solid fa-star"></i> Add to favorites';
            }, 1800);
        } else {
            favoriteBtn.innerHTML = '<i class="fa-solid fa-star"></i> Already a favorite';
            setTimeout(() => {
                favoriteBtn.innerHTML = '<i class="fa-solid fa-star"></i> Add to favorites';
            }, 1800);
        }

        displayFavorites();
    });
}

function displayFavorites() {

    if (!favoritesList) return;

    favoritesList.innerHTML = "";

    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

    if (favorites.length === 0) {
        favoritesList.innerHTML = "<p>No favorite cities yet</p>";
        return;
    }

    favorites.forEach(city => {

        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `<i class="fa-solid fa-star" style="color:#f5a623;"></i> ${city}`;

        div.onclick = () => {
            getWeather(city);
            closePopups();
        };

        favoritesList.appendChild(div);
    });
}

// POPUP OPEN/CLOSE (history + favorites)

function openPopup(popup) {
    closePopups();
    if (!popup) return;
    popup.classList.add("open");
    if (popupBackdrop) popupBackdrop.classList.add("open");
}

function closePopups() {
    if (historyPopup) historyPopup.classList.remove("open");
    if (favoritesPopup) favoritesPopup.classList.remove("open");
    if (popupBackdrop) popupBackdrop.classList.remove("open");
}

if (historyBtn) {
    historyBtn.addEventListener("click", () => {
        displayHistory();
        openPopup(historyPopup);
    });
}

if (favoritesBtn) {
    favoritesBtn.addEventListener("click", () => {
        displayFavorites();
        openPopup(favoritesPopup);
    });
}

if (closeHistory) closeHistory.addEventListener("click", closePopups);
if (closeFavorites) closeFavorites.addEventListener("click", closePopups);
if (popupBackdrop) popupBackdrop.addEventListener("click", closePopups);

if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", clearHistory);

if (clearFavoritesBtn) {
    clearFavoritesBtn.addEventListener("click", () => {
        localStorage.removeItem("favorites");
        displayFavorites();
    });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopups();
});

// WEATHER ANIMATION LAYER
function clearAnimation() {

    const box = $("weatherAnimation");
    if (box) box.innerHTML = "";
}

function createWeatherAnimation(weatherMain) {

    clearAnimation();

    const box = $("weatherAnimation");
    if (!box) return;

    if (weatherMain === "Clouds" || weatherMain === "Mist" || weatherMain === "Haze") {
        const count = weatherMain === "Clouds" ? 5 : 3;
        for (let i = 0; i < count; i++) {
            const cloud = document.createElement("div");
            cloud.className = "cloud";
            cloud.innerHTML = "☁";
            cloud.style.top = (20 + i * 12) + "%";
            cloud.style.animationDuration = (35 + i * 6) + "s";
            box.appendChild(cloud);
        }
    }

    if (weatherMain === "Rain" || weatherMain === "Thunderstorm") {
        for (let i = 0; i < 80; i++) {
            const drop = document.createElement("div");
            drop.className = "raindrop";
            drop.style.left = Math.random() * 100 + "vw";
            drop.style.animationDuration = (0.5 + Math.random()) + "s";
            drop.style.animationDelay = Math.random() * 2 + "s";
            box.appendChild(drop);
        }
    }

    if (weatherMain === "Thunderstorm") {
        const flash = document.createElement("div");
        flash.className = "lightning";
        box.appendChild(flash);
    }

    if (weatherMain === "Snow") {
        for (let i = 0; i < 60; i++) {
            const snow = document.createElement("div");
            snow.className = "snow";
            snow.innerHTML = "❄";
            snow.style.left = Math.random() * 100 + "vw";
            snow.style.animationDuration = (5 + Math.random() * 5) + "s";
            snow.style.animationDelay = Math.random() * 5 + "s";
            box.appendChild(snow);
        }
    }

    if (weatherMain === "Clear") {
        const sun = document.createElement("div");
        sun.className = "sun-glow";
        box.appendChild(sun);
    }
}

// LOADER

function showLoader() {
    const loader = $("loader");
    if (loader) loader.style.display = "flex";
}

function hideLoader() {
    const loader = $("loader");
    if (loader) loader.style.display = "none";
}

// VOICE SEARCH


const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && voiceBtn) {

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceBtn.addEventListener("click", () => {
        voiceBtn.classList.add("listening");
        recognition.start();
    });

    recognition.onresult = (event) => {
        let city = event.results[0][0].transcript;

        // Remove punctuation like ".", ",", "!"
        city = city.replace(/[^\w\s]/g, "").trim();

        // Collapse extra spaces
        city = city.replace(/\s+/g, " ");

        cityInput.value = city;
        getWeather(city);
    };

    recognition.onend = () => {
        voiceBtn.classList.remove("listening");
    };

    recognition.onerror = (event) => {
        voiceBtn.classList.remove("listening");
        console.error("Speech Error:", event.error);

        switch (event.error) {
            case "network":
                alert("Network error. Please check your internet connection or try Google Chrome.");
                break;
            case "not-allowed":
                alert("Microphone permission denied. Please allow microphone access.");
                break;
            case "no-speech":
                alert("No speech detected. Please try again.");
                break;
            case "audio-capture":
                alert("No microphone found.");
                break;
            default:
                alert("Speech Recognition Error: " + event.error);
        }
    };

} else if (voiceBtn) {
    voiceBtn.style.display = "none";
}

// START APP

updateTime();
displayHistory();

if (savedCity) {
    cityInput.value = savedCity;
    getWeather(savedCity);
} else {
    getWeather(DEFAULT_CITY);
}