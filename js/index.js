
    const filters = [
      { id: "all", label: "All", icon: "fa-layer-group" },
      { id: "adventure", label: "Adventure", icon: "fa-compass" },
      { id: "puzzle", label: "Puzzle", icon: "fa-puzzle-piece" },
      { id: "arcade", label: "Arcade", icon: "fa-bolt" },
      { id: "strategy", label: "Strategy", icon: "fa-chess" }
    ];

    const games = [
      {
        title: "Brick Breaker",
        description: "Shoot balls at bricks to survive.",
        imagePath: "brick_breaker_icon.png",
        url: "games/brick_breaker.html",
        tags: ["arcade", "puzzle", "strategy"]
      },
      {
        title: "Connect the Pipes",
        description: "Rotate the pipes until every piece connects.",
        imagePath: "connect_the_pipes.png",
        url: "games/connect_the_pipes.html",
        tags: ["puzzle", "strategy"]
      }
    ];

    const filterContainer = document.querySelector("#filters");
    const gameGrid = document.querySelector("#game-grid");
    const searchInput = document.querySelector("#search");
    const resultCount = document.querySelector("#result-count");
    let activeFilter = "all";

    function renderFilters() {
      filterContainer.replaceChildren();

      filters.forEach((filter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-button";
        button.setAttribute("aria-pressed", String(filter.id === activeFilter));

        const icon = document.createElement("i");
        icon.className = `fa-solid ${filter.icon}`;
        icon.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.textContent = filter.label;

        button.append(icon, label);
        button.addEventListener("click", () => {
          activeFilter = filter.id;
          renderFilters();
          renderGames();
        });

        filterContainer.appendChild(button);
      });
    }

    function renderGames() {
      const term = searchInput.value.trim().toLowerCase();

      const visibleGames = games.filter((game) => {
        const matchesFilter =
          activeFilter === "all" || game.tags.includes(activeFilter);

        const searchableText =
          `${game.title} ${game.description} ${game.tags.join(" ")}`.toLowerCase();

        return matchesFilter && searchableText.includes(term);
      });

      gameGrid.replaceChildren();
      resultCount.textContent =
        `${visibleGames.length} ${visibleGames.length === 1 ? "game" : "games"}`;

      if (visibleGames.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "No games found.";
        gameGrid.appendChild(emptyState);
        return;
      }

      visibleGames.forEach((game) => {
        const card = document.createElement("a");
        card.className = "game-card";
        card.href = game.url;
        card.setAttribute(
          "aria-label",
          `Play ${game.title}: ${game.description}`
        );

        if (game.imagePath) {
          card.style.setProperty("--card-image", `url("${game.imagePath}")`);
        }

        const content = document.createElement("div");
        content.className = "game-card-content";

        const tags = document.createElement("div");
        tags.className = "game-tags";

        game.tags.forEach((tagId) => {
          const filter = filters.find((item) => item.id === tagId);
          if (!filter) return;

          const tag = document.createElement("span");
          tag.className = "game-tag";

          const icon = document.createElement("i");
          icon.className = `fa-solid ${filter.icon}`;
          icon.setAttribute("aria-hidden", "true");

          tag.append(icon, document.createTextNode(` ${filter.label}`));
          tags.appendChild(tag);
        });

        const title = document.createElement("h3");
        title.textContent = game.title;

        const description = document.createElement("p");
        description.textContent = game.description;

        content.append(tags, title, description);
        card.appendChild(content);
        gameGrid.appendChild(card);
      });
    }

    searchInput.addEventListener("input", renderGames);

    const root = document.documentElement;
    const themeToggle = document.querySelector("#theme-toggle");
    const themeIcon = document.querySelector("#theme-icon");

    function applyTheme(theme) {
      const isLight = theme === "light";

      root.dataset.theme = theme;
      themeIcon.className = isLight
        ? "fa-solid fa-moon"
        : "fa-solid fa-sun";
      themeToggle.setAttribute(
        "aria-label",
        isLight ? "Switch to dark mode" : "Switch to light mode"
      );
    }

    let savedTheme = null;

    try {
      savedTheme = localStorage.getItem("student-games-theme");
    } catch (error) {
      // Theme switching still works if storage is unavailable.
    }

    const preferredTheme =
      window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";

    applyTheme(savedTheme || preferredTheme);

    themeToggle.addEventListener("click", () => {
      const nextTheme =
        root.dataset.theme === "dark" ? "light" : "dark";

      applyTheme(nextTheme);

      try {
        localStorage.setItem("student-games-theme", nextTheme);
      } catch (error) {
        // No action needed; theme remains applied for this visit.
      }
    });

    renderFilters();
    renderGames();
  
