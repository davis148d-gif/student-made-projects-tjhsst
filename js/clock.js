
    const $ = (selector) => document.querySelector(selector);

    const cityCatalog = [
      { city: "Amsterdam", zone: "Europe/Amsterdam" },
      { city: "Athens", zone: "Europe/Athens" },
      { city: "Auckland", zone: "Pacific/Auckland" },
      { city: "Bangkok", zone: "Asia/Bangkok" },
      { city: "Beijing", zone: "Asia/Shanghai" },
      { city: "Beirut", zone: "Asia/Beirut" },
      { city: "Berlin", zone: "Europe/Berlin" },
      { city: "Bogotá", zone: "America/Bogota" },
      { city: "Brisbane", zone: "Australia/Brisbane" },
      { city: "Cairo", zone: "Africa/Cairo" },
      { city: "Cape Town", zone: "Africa/Johannesburg" },
      { city: "Chicago", zone: "America/Chicago" },
      { city: "Copenhagen", zone: "Europe/Copenhagen" },
      { city: "Delhi", zone: "Asia/Kolkata" },
      { city: "Denver", zone: "America/Denver" },
      { city: "Dhaka", zone: "Asia/Dhaka" },
      { city: "Dubai", zone: "Asia/Dubai" },
      { city: "Hanoi", zone: "Asia/Ho_Chi_Minh" },
      { city: "Helsinki", zone: "Europe/Helsinki" },
      { city: "Hong Kong", zone: "Asia/Hong_Kong" },
      { city: "Honolulu", zone: "Pacific/Honolulu" },
      { city: "Istanbul", zone: "Europe/Istanbul" },
      { city: "Jakarta", zone: "Asia/Jakarta" },
      { city: "Jerusalem", zone: "Asia/Jerusalem" },
      { city: "Johannesburg", zone: "Africa/Johannesburg" },
      { city: "Karachi", zone: "Asia/Karachi" },
      { city: "Kuala Lumpur", zone: "Asia/Kuala_Lumpur" },
      { city: "Lagos", zone: "Africa/Lagos" },
      { city: "Lima", zone: "America/Lima" },
      { city: "Lisbon", zone: "Europe/Lisbon" },
      { city: "London", zone: "Europe/London" },
      { city: "Los Angeles", zone: "America/Los_Angeles" },
      { city: "Madrid", zone: "Europe/Madrid" },
      { city: "Manila", zone: "Asia/Manila" },
      { city: "Mexico City", zone: "America/Mexico_City" },
      { city: "Montreal", zone: "America/Toronto" },
      { city: "Moscow", zone: "Europe/Moscow" },
      { city: "Mumbai", zone: "Asia/Kolkata" },
      { city: "Nairobi", zone: "Africa/Nairobi" },
      { city: "New York", zone: "America/New_York" },
      { city: "Oslo", zone: "Europe/Oslo" },
      { city: "Paris", zone: "Europe/Paris" },
      { city: "Perth", zone: "Australia/Perth" },
      { city: "Reykjavík", zone: "Atlantic/Reykjavik" },
      { city: "Rio de Janeiro", zone: "America/Sao_Paulo" },
      { city: "Riyadh", zone: "Asia/Riyadh" },
      { city: "Rome", zone: "Europe/Rome" },
      { city: "San Francisco", zone: "America/Los_Angeles" },
      { city: "Santiago", zone: "America/Santiago" },
      { city: "São Paulo", zone: "America/Sao_Paulo" },
      { city: "Seoul", zone: "Asia/Seoul" },
      { city: "Shanghai", zone: "Asia/Shanghai" },
      { city: "Singapore", zone: "Asia/Singapore" },
      { city: "Stockholm", zone: "Europe/Stockholm" },
      { city: "Sydney", zone: "Australia/Sydney" },
      { city: "Taipei", zone: "Asia/Taipei" },
      { city: "Tokyo", zone: "Asia/Tokyo" },
      { city: "Toronto", zone: "America/Toronto" },
      { city: "Vancouver", zone: "America/Vancouver" },
      { city: "Vienna", zone: "Europe/Vienna" },
      { city: "Warsaw", zone: "Europe/Warsaw" },
      { city: "Wellington", zone: "Pacific/Auckland" },
      { city: "Zurich", zone: "Europe/Zurich" }
    ];

    function readStorage(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    }

    let settings = readStorage("clock-settings", { format: "24", dark: false });
    let cities = readStorage("clock-cities", [
      { city: "London", zone: "Europe/London" },
      { city: "New York", zone: "America/New_York" },
      { city: "Tokyo", zone: "Asia/Tokyo" },
      { city: "Sydney", zone: "Australia/Sydney" }
    ]);
    let alarms = readStorage("clock-alarms", []);
    let timerEnd = 0;
    let timerRemaining = 0;
    let timerRunning = false;
    let stopwatchRunning = false;
    let stopwatchStartedAt = 0;
    let stopwatchElapsed = 0;
    let previousLapTime = 0;
    let snoozeTimeout = null;
    let audioContext = null;
    let soundInterval = null;
    let ringing = false;
    const firedAlarms = new Set();

    function save() {
      localStorage.setItem("clock-settings", JSON.stringify(settings));
      localStorage.setItem("clock-cities", JSON.stringify(cities));
      localStorage.setItem("clock-alarms", JSON.stringify(alarms));
    }

    function escapeHTML(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
      })[char]);
    }

    function showView(name) {
      document.querySelectorAll(".view").forEach((view) => {
        view.classList.toggle("active", view.id === `view-${name}`);
      });

      document.querySelectorAll(".nav-button").forEach((button) => {
        const selected = button.dataset.view === name;
        button.classList.toggle("active", selected);
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
    }

    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });

    function setupFace() {
      const ticks = $("#ticks");
      const numbers = $("#numbers");

      for (let i = 0; i < 60; i++) {
        const angle = (i * 6 - 90) * Math.PI / 180;
        const major = i % 5 === 0;
        const inner = major ? 97 : 103;
        const outer = 108;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", 120 + Math.cos(angle) * inner);
        line.setAttribute("y1", 120 + Math.sin(angle) * inner);
        line.setAttribute("x2", 120 + Math.cos(angle) * outer);
        line.setAttribute("y2", 120 + Math.sin(angle) * outer);
        line.setAttribute("class", major ? "tick major" : "tick");
        ticks.appendChild(line);

        if (major) {
          const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
          label.setAttribute("x", 120 + Math.cos(angle) * 79);
          label.setAttribute("y", 120 + Math.sin(angle) * 79);
          label.setAttribute("class", "face-number");
          label.textContent = i === 0 ? 12 : i / 5;
          numbers.appendChild(label);
        }
      }
    }

    function updateClock() {
      const now = new Date();
      const seconds = now.getSeconds();
      const minutes = now.getMinutes() + seconds / 60;
      const hours = (now.getHours() % 12) + minutes / 60;

      $("#hourHand").setAttribute("transform", `rotate(${hours * 30} 120 120)`);
      $("#minuteHand").setAttribute("transform", `rotate(${minutes * 6} 120 120)`);
      $("#secondHand").setAttribute("transform", `rotate(${seconds * 6} 120 120)`);

      $("#digitalTime").textContent = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: settings.format === "12"
      }).format(now);

      $("#dateLine").textContent = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(now);

      $("#headerDate").textContent = new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(now);

      $("#localZone").textContent =
        (Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time").replaceAll("_", " ");

      checkAlarms(now);
      renderCities(now);
    }

    function renderCities(now = new Date()) {
      $("#cityCount").textContent = cities.length ? `(${cities.length})` : "";
      const list = $("#cityList");

      if (!cities.length) {
        list.innerHTML = '<div class="empty-state">No cities added.</div>';
        return;
      }

      list.innerHTML = cities.map((item, index) => {
        const time = new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: settings.format === "12",
          timeZone: item.zone
        }).format(now);

        const zone = new Intl.DateTimeFormat(undefined, {
          timeZone: item.zone,
          timeZoneName: "short"
        }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value || item.zone;

        return `
          <div class="city-row">
            <div>
              <div class="city-name">${escapeHTML(item.city)}</div>
              <div class="city-zone">${escapeHTML(zone)}</div>
            </div>
            <div class="city-time">${escapeHTML(time)}</div>
            <button class="remove-button" type="button" data-remove-city="${index}"
              aria-label="Remove ${escapeHTML(item.city)}">×</button>
          </div>
        `;
      }).join("");

      list.querySelectorAll("[data-remove-city]").forEach((button) => {
        button.addEventListener("click", () => {
          cities.splice(Number(button.dataset.removeCity), 1);
          save();
          renderCities();
          updateCityOptions();
        });
      });
    }

    function updateCityOptions() {
      const select = $("#citySelect");
      const current = select.value;
      const available = cityCatalog.filter((item) =>
        !cities.some((savedCity) => savedCity.city === item.city)
      );

      select.innerHTML = available.map((item) =>
        `<option value="${escapeHTML(item.city)}">${escapeHTML(item.city)}</option>`
      ).join("");

      if (!available.length) {
        select.innerHTML = '<option value="">All cities added</option>';
      } else if (available.some((item) => item.city === current)) {
        select.value = current;
      }

      $("#cityForm button").disabled = available.length === 0;
    }

    function renderAlarms() {
      const list = $("#alarmList");
      $("#alarmCount").textContent = alarms.length ? `(${alarms.length})` : "";

      if (!alarms.length) {
        list.innerHTML = '<div class="empty-state">No alarms set.</div>';
        return;
      }

      list.innerHTML = alarms.map((alarm) => `
        <div class="alarm-row ${alarm.enabled ? "" : "off"}">
          <div>
            <div class="alarm-time">${escapeHTML(alarm.time)}</div>
            <div class="alarm-detail">${escapeHTML(alarm.label || (alarm.repeat === "once" ? "Once" : "Every day"))}</div>
          </div>
          <input class="toggle" type="checkbox" data-alarm-toggle="${escapeHTML(alarm.id)}"
            aria-label="Toggle alarm" ${alarm.enabled ? "checked" : ""}>
          <button class="remove-button" type="button" data-remove-alarm="${escapeHTML(alarm.id)}"
            aria-label="Delete alarm">×</button>
        </div>
      `).join("");

      list.querySelectorAll("[data-alarm-toggle]").forEach((input) => {
        input.addEventListener("change", () => {
          const alarm = alarms.find((item) => item.id === input.dataset.alarmToggle);
          if (alarm) alarm.enabled = input.checked;
          save();
          renderAlarms();
        });
      });

      list.querySelectorAll("[data-remove-alarm]").forEach((button) => {
        button.addEventListener("click", () => {
          alarms = alarms.filter((item) => item.id !== button.dataset.removeAlarm);
          save();
          renderAlarms();
        });
      });
    }

    function checkAlarms(now) {
      if (ringing) return;

      if (snoozeTimeout && Date.now() >= snoozeTimeout) {
        snoozeTimeout = null;
        ring("Snoozed alarm");
        return;
      }

      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      for (const alarm of alarms) {
        const key = `${alarm.id}-${day}`;
        if (alarm.enabled && alarm.time === currentTime && now.getSeconds() < 3 && !firedAlarms.has(key)) {
          firedAlarms.add(key);
          if (alarm.repeat === "once") alarm.enabled = false;
          save();
          renderAlarms();
          ring(alarm.label || "Alarm");
          break;
        }
      }

      if (firedAlarms.size > 400) firedAlarms.clear();
    }

    function playTone() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        if (!audioContext || audioContext.state === "closed") {
          audioContext = new AudioContext();
        }

        if (audioContext.state === "suspended") audioContext.resume();

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 660;
        gain.gain.value = 0.045;
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.25);
      } catch {
        // The on-screen alert remains available if browser audio is blocked.
      }
    }

    function ring(message) {
      ringing = true;
      $("#ringMessage").textContent = message;
      $("#ringBackdrop").classList.add("open");
      playTone();
      soundInterval = setInterval(playTone, 900);
      $("#dismissButton").focus();
    }

    function stopRinging() {
      ringing = false;
      $("#ringBackdrop").classList.remove("open");
      clearInterval(soundInterval);
      soundInterval = null;
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
    }

    $("#dismissButton").addEventListener("click", stopRinging);

    $("#snoozeButton").addEventListener("click", () => {
      snoozeTimeout = Date.now() + 5 * 60 * 1000;
      stopRinging();
    });

    $("#cityForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const city = cityCatalog.find((item) => item.city === $("#citySelect").value);
      if (!city) return;
      cities.push(city);
      save();
      renderCities();
      updateCityOptions();
    });

    $("#alarmForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const time = $("#alarmTime").value;
      if (!time) return;

      alarms.push({
        id: window.crypto?.randomUUID?.() || String(Date.now()),
        time,
        label: $("#alarmLabel").value.trim(),
        repeat: $("#alarmRepeat").value,
        enabled: true
      });

      save();
      renderAlarms();
      $("#alarmForm").reset();
    });

    function renderTimer() {
      const remaining = timerRunning
        ? Math.max(0, timerEnd - Date.now())
        : timerRemaining;
      const totalSeconds = Math.ceil(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      $("#timerDisplay").textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

      if (timerRunning && remaining <= 0) {
        timerRunning = false;
        timerRemaining = 0;
        $("#timerStart").textContent = "Start";
        ring("Timer finished");
      }
    }

    $("#timerStart").addEventListener("click", () => {
      if (timerRunning) {
        timerRemaining = Math.max(0, timerEnd - Date.now());
        timerRunning = false;
        $("#timerStart").textContent = "Resume";
        renderTimer();
        return;
      }

      if (timerRemaining <= 0) {
        const minutes = Math.max(0, Number($("#timerMinutes").value) || 0);
        const seconds = Math.min(59, Math.max(0, Number($("#timerSeconds").value) || 0));
        timerRemaining = (minutes * 60 + seconds) * 1000;
      }

      if (timerRemaining <= 0) return;

      timerEnd = Date.now() + timerRemaining;
      timerRunning = true;
      $("#timerStart").textContent = "Pause";
      renderTimer();
    });

    $("#timerReset").addEventListener("click", () => {
      timerRunning = false;
      timerRemaining = 0;
      $("#timerStart").textContent = "Start";
      renderTimer();
    });

    function currentStopwatchTime() {
      return stopwatchElapsed + (stopwatchRunning ? performance.now() - stopwatchStartedAt : 0);
    }

    function formatStopwatch(milliseconds) {
      const tenths = Math.floor(milliseconds / 100);
      const minutes = Math.floor(tenths / 600);
      const seconds = Math.floor((tenths % 600) / 10);
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
    }

    function updateStopwatch() {
      $("#stopwatchDisplay").textContent = formatStopwatch(currentStopwatchTime());
    }

    $("#stopwatchStart").addEventListener("click", () => {
      if (stopwatchRunning) {
        stopwatchElapsed = currentStopwatchTime();
        stopwatchRunning = false;
        $("#stopwatchStart").textContent = "Start";
        $("#lapButton").disabled = true;
      } else {
        stopwatchStartedAt = performance.now();
        stopwatchRunning = true;
        $("#stopwatchStart").textContent = "Pause";
        $("#lapButton").disabled = false;
      }
      updateStopwatch();
    });

    $("#lapButton").addEventListener("click", () => {
      if (!stopwatchRunning) return;

      const total = currentStopwatchTime();
      const split = total - previousLapTime;
      previousLapTime = total;
      const row = document.createElement("div");
      row.className = "lap-row";
      row.innerHTML = `<span>Lap ${$("#laps").children.length + 1}</span><span>${formatStopwatch(split)}</span>`;
      $("#laps").prepend(row);
    });

    $("#stopwatchReset").addEventListener("click", () => {
      stopwatchRunning = false;
      stopwatchElapsed = 0;
      previousLapTime = 0;
      $("#stopwatchStart").textContent = "Start";
      $("#lapButton").disabled = true;
      $("#laps").replaceChildren();
      updateStopwatch();
    });

    $("#timeFormat").addEventListener("change", (event) => {
      settings.format = event.target.value;
      save();
      updateClock();
    });

    $("#themeSelect").addEventListener("change", (event) => {
      settings.dark = event.target.value === "dark";
      document.body.classList.toggle("dark", settings.dark);
      save();
    });

    setupFace();
    $("#timeFormat").value = settings.format;
    $("#themeSelect").value = settings.dark ? "dark" : "light";
    document.body.classList.toggle("dark", settings.dark);
    updateCityOptions();
    renderAlarms();
    updateClock();
    renderTimer();
    updateStopwatch();

    setInterval(() => {
      updateClock();
      renderTimer();
      updateStopwatch();
    }, 250);
  
