
    "use strict";

    const INTERVAL_SIZE = 10000;
    const BATCH_SIZE = 500;
    const TOP_LIMIT = 10;
    const GRAPH_LIMIT = 120;
    const STORAGE_KEY = "collatz-10k-state-v1";

    const $ = (id) => document.getElementById(id);
    const statusElement = $("status");
    const toggleButton = $("toggleButton");
    const canvas = $("chart");

    let state = createEmptyState();
    let worker = null;
    let running = false;
    let saveTimer = null;

    function createEmptyState() {
      return {
        version: 1,
        nextNumber: "1",
        completed: "0",
        totalSteps: "0",
        totalCount: "0",
        currentInterval: null,
        buckets: [],
        top: []
      };
    }

    function setStatus(message, isError = false) {
      statusElement.textContent = message;
      statusElement.classList.toggle("error", isError);
    }

    function formatInteger(value) {
      try {
        return BigInt(value).toLocaleString();
      } catch {
        return String(value);
      }
    }

    function validateState(value) {
      if (
        !value ||
        value.version !== 1 ||
        typeof value.nextNumber !== "string" ||
        typeof value.completed !== "string" ||
        typeof value.totalSteps !== "string" ||
        typeof value.totalCount !== "string" ||
        !Array.isArray(value.buckets) ||
        !Array.isArray(value.top)
      ) {
        throw new Error("This is not a supported Collatz backup.");
      }

      if (
        !/^[1-9]\d*$/.test(value.nextNumber) ||
        !/^\d+$/.test(value.completed) ||
        !/^\d+$/.test(value.totalSteps) ||
        !/^\d+$/.test(value.totalCount) ||
        BigInt(value.completed) !== BigInt(value.nextNumber) - 1n
      ) {
        throw new Error("The backup contains inconsistent progress data.");
      }

      const buckets = value.buckets.map((bucket) => {
        if (
          !bucket ||
          !/^[1-9]\d*$/.test(String(bucket.start)) ||
          !/^[1-9]\d*$/.test(String(bucket.end)) ||
          !/^\d+$/.test(String(bucket.sum)) ||
          !Number.isSafeInteger(bucket.count) ||
          bucket.count !== INTERVAL_SIZE ||
          !Number.isSafeInteger(bucket.maxSteps) ||
          bucket.maxSteps < 0 ||
          !/^[1-9]\d*$/.test(String(bucket.maxNumber))
        ) {
          throw new Error("The backup contains an invalid interval summary.");
        }

        return {
          start: String(bucket.start),
          end: String(bucket.end),
          count: bucket.count,
          sum: String(bucket.sum),
          maxSteps: bucket.maxSteps,
          maxNumber: String(bucket.maxNumber)
        };
      }).slice(-GRAPH_LIMIT);

      const top = value.top.map((entry) => {
        if (
          !entry ||
          !/^[1-9]\d*$/.test(String(entry.number)) ||
          !Number.isSafeInteger(entry.steps) ||
          entry.steps < 0
        ) {
          throw new Error("The backup contains an invalid top-number entry.");
        }

        return { number: String(entry.number), steps: entry.steps };
      }).slice(0, TOP_LIMIT);

      let currentInterval = null;

      if (value.currentInterval !== null) {
        const part = value.currentInterval;

        if (
          !part ||
          !/^[1-9]\d*$/.test(String(part.start)) ||
          !/^[1-9]\d*$/.test(String(part.end)) ||
          !/^[1-9]\d*$/.test(String(part.next)) ||
          !/^\d+$/.test(String(part.sum)) ||
          !Number.isSafeInteger(part.count) ||
          part.count < 0 ||
          part.count >= INTERVAL_SIZE ||
          !Number.isSafeInteger(part.maxSteps) ||
          part.maxSteps < 0 ||
          !/^[1-9]\d*$/.test(String(part.maxNumber))
        ) {
          throw new Error("The backup contains invalid partial interval data.");
        }

        currentInterval = {
          start: String(part.start),
          end: String(part.end),
          next: String(part.next),
          sum: String(part.sum),
          count: part.count,
          maxSteps: part.maxSteps,
          maxNumber: String(part.maxNumber)
        };
      }

      return {
        version: 1,
        nextNumber: value.nextNumber,
        completed: value.completed,
        totalSteps: value.totalSteps,
        totalCount: value.totalCount,
        currentInterval,
        buckets,
        top
      };
    }

    function loadState() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? validateState(JSON.parse(saved)) : createEmptyState();
      } catch (error) {
        setStatus("Saved data could not be loaded; starting fresh.", true);
        return createEmptyState();
      }
    }

    function saveStateSoon() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
          setStatus("Browser storage is unavailable or full. Download a JSON backup.", true);
        }
      }, 100);
    }

    function renderSummary() {
      $("completed").textContent = formatInteger(state.completed);
      $("nextNumber").textContent = formatInteger(state.nextNumber);

      let steps = BigInt(state.totalSteps);
      let count = BigInt(state.totalCount);

      if (state.currentInterval) {
        steps += BigInt(state.currentInterval.sum);
        count += BigInt(state.currentInterval.count);
      }

      $("overallAverage").textContent = count > 0n
        ? (Number(steps) / Number(count)).toFixed(2)
        : "—";

      $("intervalProgress").textContent = state.currentInterval
        ? `${formatInteger(state.currentInterval.count)} / ${formatInteger(INTERVAL_SIZE)}`
        : `0 / ${formatInteger(INTERVAL_SIZE)}`;

      const best = state.top[0];
      $("maxSteps").textContent = best ? formatInteger(best.steps) : "—";
      $("maxNumber").textContent = best ? formatInteger(best.number) : "—";

      const table = $("topTable");

      if (!state.top.length) {
        table.innerHTML = '<tr><td colspan="3">No numbers calculated yet.</td></tr>';
      } else {
        table.innerHTML = state.top.map((entry, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatInteger(entry.number)}</td>
            <td>${formatInteger(entry.steps)}</td>
          </tr>
        `).join("");
      }
    }

    function renderAll() {
      renderSummary();
      drawChart();
    }

    function drawChart() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(300, rect.width);
      const height = Math.max(220, rect.height);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const context = canvas.getContext("2d");
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const data = state.buckets;
      const left = 54;
      const right = 18;
      const top = 14;
      const bottom = 42;
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;

      context.font = "12px system-ui, sans-serif";
      context.fillStyle = "#a7b3c2";

      if (!data.length) {
        context.textAlign = "center";
        context.fillText(
          "The graph appears after the first 10,000 numbers.",
          width / 2,
          height / 2
        );
        return;
      }

      const maximum = Math.max(
        1,
        ...data.map((bucket) =>
          Math.max(Number(BigInt(bucket.sum)) / bucket.count, bucket.maxSteps)
        )
      );
      const axisMaximum = Math.ceil(maximum / 10) * 10 || 10;

      context.strokeStyle = "#344356";
      context.lineWidth = 1;
      context.textAlign = "right";

      for (let i = 0; i <= 4; i++) {
        const y = top + plotHeight - plotHeight * i / 4;

        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();

        context.fillText(
          (axisMaximum * i / 4).toFixed(0),
          left - 8,
          y + 4
        );
      }

      const slotWidth = plotWidth / data.length;
      const barWidth = Math.max(1, slotWidth * 0.68);

      data.forEach((bucket, index) => {
        const average = Number(BigInt(bucket.sum)) / bucket.count;
        const x = left + index * slotWidth + (slotWidth - barWidth) / 2;
        const barHeight = average / axisMaximum * plotHeight;

        context.fillStyle = "#61dafb";
        context.fillRect(
          x,
          top + plotHeight - barHeight,
          barWidth,
          barHeight
        );
      });

      context.beginPath();
      context.strokeStyle = "#ffbf69";
      context.lineWidth = 2;

      data.forEach((bucket, index) => {
        const x = left + index * slotWidth + slotWidth / 2;
        const y = top + plotHeight -
          bucket.maxSteps / axisMaximum * plotHeight;

        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });

      context.stroke();
      context.fillStyle = "#a7b3c2";
      context.textAlign = "center";

      const labelIndexes = [
        ...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])
      ];

      labelIndexes.forEach((index) => {
        const bucket = data[index];
        const x = left + index * slotWidth + slotWidth / 2;

        context.fillText(
          `${formatInteger(bucket.start)}–${formatInteger(bucket.end)}`,
          x,
          height - 12
        );
      });
    }

    const workerSource = `
      "use strict";

      const INTERVAL_SIZE = ${INTERVAL_SIZE};
      const BATCH_SIZE = ${BATCH_SIZE};
      const TOP_LIMIT = ${TOP_LIMIT};

      let nextNumber = 1n;
      let top = [];
      let interval = null;
      let paused = false;
      let scheduled = false;

      function addToTop(number, steps) {
        const candidate = {
          number: number.toString(),
          steps
        };

        if (top.length === TOP_LIMIT) {
          const last = top[top.length - 1];

          if (steps < last.steps ||
              (steps === last.steps && number >= BigInt(last.number))) {
            return;
          }
        }

        top.push(candidate);
        top.sort((a, b) => {
          if (b.steps !== a.steps) return b.steps - a.steps;
          const aNumber = BigInt(a.number);
          const bNumber = BigInt(b.number);
          return aNumber < bNumber ? -1 : aNumber > bNumber ? 1 : 0;
        });

        if (top.length > TOP_LIMIT) {
          top.length = TOP_LIMIT;
        }
      }

      function countSteps(start) {
        let value = start;
        let steps = 0;

        while (value !== 1n) {
          value = (value & 1n) === 0n
            ? value / 2n
            : value * 3n + 1n;
          steps++;
        }

        return steps;
      }

      function beginInterval() {
        const start = nextNumber;
        const end = start + BigInt(INTERVAL_SIZE) - 1n;

        interval = {
          start,
          end,
          sum: 0n,
          count: 0,
          maxSteps: 0,
          maxNumber: start
        };
      }

      function postProgress() {
        postMessage({
          type: "progress",
          nextNumber: nextNumber.toString(),
          completed: (nextNumber - 1n).toString(),
          currentInterval: {
            start: interval.start.toString(),
            end: interval.end.toString(),
            next: nextNumber.toString(),
            sum: interval.sum.toString(),
            count: interval.count,
            maxSteps: interval.maxSteps,
            maxNumber: interval.maxNumber.toString()
          },
          top
        });
      }

      function finishInterval() {
        const bucket = {
          start: interval.start.toString(),
          end: interval.end.toString(),
          count: interval.count,
          sum: interval.sum.toString(),
          maxSteps: interval.maxSteps,
          maxNumber: interval.maxNumber.toString()
        };

        postMessage({
          type: "complete",
          nextNumber: nextNumber.toString(),
          completed: (nextNumber - 1n).toString(),
          sum: interval.sum.toString(),
          count: interval.count,
          bucket,
          top
        });

        interval = null;
      }

      function scheduleBatch() {
        if (paused || scheduled) return;

        scheduled = true;
        setTimeout(() => {
          scheduled = false;
          processBatch();
        }, 0);
      }

      function processBatch() {
        if (paused) return;
        if (!interval) beginInterval();

        let processed = 0;

        while (processed < BATCH_SIZE && nextNumber <= interval.end) {
          const number = nextNumber;
          const steps = countSteps(number);

          interval.sum += BigInt(steps);
          interval.count++;

          if (steps > interval.maxSteps) {
            interval.maxSteps = steps;
            interval.maxNumber = number;
          }

          addToTop(number, steps);

          nextNumber++;
          processed++;
        }

        if (nextNumber > interval.end) {
          finishInterval();
        } else {
          postProgress();
        }

        scheduleBatch();
      }

      self.onmessage = (event) => {
        const message = event.data;

        if (message.type === "init") {
          nextNumber = BigInt(message.nextNumber);
          top = Array.isArray(message.top) ? message.top : [];
          interval = message.currentInterval
            ? {
                start: BigInt(message.currentInterval.start),
                end: BigInt(message.currentInterval.end),
                sum: BigInt(message.currentInterval.sum),
                count: message.currentInterval.count,
                maxSteps: message.currentInterval.maxSteps,
                maxNumber: BigInt(message.currentInterval.maxNumber)
              }
            : null;

          paused = false;
          scheduleBatch();
        } else if (message.type === "pause") {
          paused = true;
        } else if (message.type === "resume" && paused) {
          paused = false;
          scheduleBatch();
        }
      };
    `;

    function startWorker() {
      if (worker) {
        worker.terminate();
        worker = null;
      }

      try {
        const blob = new Blob([workerSource], {
          type: "application/javascript"
        });
        const workerUrl = URL.createObjectURL(blob);

        worker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);

        worker.onmessage = (event) => {
          const message = event.data;

          state.nextNumber = message.nextNumber;
          state.completed = message.completed;
          state.top = message.top;

          if (message.type === "progress") {
            state.currentInterval = message.currentInterval;
            renderSummary();
            saveStateSoon();

            setStatus(
              `Running. Interval progress: ${
                formatInteger(message.currentInterval.count)
              } / ${formatInteger(INTERVAL_SIZE)}.`
            );
            return;
          }

          if (message.type === "complete") {
            state.currentInterval = null;
            state.totalSteps = (
              BigInt(state.totalSteps) + BigInt(message.sum)
            ).toString();
            state.totalCount = (
              BigInt(state.totalCount) + BigInt(message.count)
            ).toString();

            state.buckets.push(message.bucket);

            if (state.buckets.length > GRAPH_LIMIT) {
              state.buckets.splice(
                0,
                state.buckets.length - GRAPH_LIMIT
              );
            }

            renderAll();
            saveStateSoon();
            setStatus(`Interval complete. Saved through ${formatInteger(state.completed)}.`);
          }
        };

        worker.onerror = (event) => {
          running = false;
          toggleButton.textContent = "Resume";
          setStatus("The calculation worker stopped. Refresh to resume saved progress.", true);
          console.error(event.message || event);
        };

        worker.postMessage({
          type: "init",
          nextNumber: state.nextNumber,
          currentInterval: state.currentInterval,
          top: state.top
        });

        running = true;
        toggleButton.textContent = "Pause";
        setStatus("Calculating in the background...");
      } catch (error) {
        running = false;
        toggleButton.disabled = true;
        setStatus("This browser could not start a background worker.", true);
      }
    }

    toggleButton.addEventListener("click", () => {
      if (!worker) return;

      if (running) {
        worker.postMessage({ type: "pause" });
        running = false;
        toggleButton.textContent = "Resume";
        setStatus("Pausing… recent progress is saved.");
      } else {
        worker.postMessage({ type: "resume" });
        running = true;
        toggleButton.textContent = "Pause";
        setStatus("Calculating in the background...");
      }
    });

    $("exportButton").addEventListener("click", () => {
      const backup = {
        ...state,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        `collatz-backup-${new Date().toISOString().replaceAll(":", "-")}.json`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    $("importFile").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";

      if (!file) return;

      try {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error("Backup file is larger than 10 MB.");
        }

        const imported = validateState(JSON.parse(await file.text()));

        if (worker) {
          worker.terminate();
          worker = null;
        }

        state = imported;
        renderAll();
        saveStateSoon();
        startWorker();
        setStatus("Backup imported. Calculation resumed.");
      } catch (error) {
        setStatus(error.message || "Could not import that backup.", true);
      }
    });

    window.addEventListener("resize", drawChart);

    state = loadState();
    renderAll();
    startWorker();
  
