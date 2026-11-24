
    [
      {
        "name": "noobie (davis148d-gif on GitHub)",
        "bio": "Writes game logic paired with AI interfaces (most of the time)"
      },
      {
        "name": "ColorBlindApple (also on GitHub)",
        "bio": "Likes to hack sites and make software developers who aren't good enough cry"
      }
    ]
  

    {
      "sections": [
        {
          "title": "Fonts & Icons",
          "description": "Visual resources used throughout the site.",
          "items": [
            {
              "name": "Manrope",
              "bio": "Typeface provided by Google Fonts.",
              "url": "https://fonts.google.com/specimen/Manrope"
            },
            {
              "name": "Font Awesome 6.7.2",
              "bio": "Icons provided by Font Awesome via cdnjs.",
              "url": "https://fontawesome.com/"
            }
          ]
        },
        {
          "title": "Contributors",
          "description": "Students who created or contributed to projects.",
          "items": [
            {
              "name": "noobie",
              "bio": "Created Brick Breaker, Connect the Pipes, 2048, and PyForge.",
              "url": "https://github.com/davis148d-gif"
            },
            {
              "name": "ColorBlindApple",
              "bio": "Created Fencing."
            }
          ]
        },
        {
          "title": "AI Generated UI",
          "description": "Tools or assistance used during development.",
          "items": [
            {
              "name": "Homepage",
              "bio": "Used Google AI Studio for the UI."
            },
            {
              "name": "2048",
              "bio": "Used GitHub Copilot for the UI."
            },
            {
              "name": "Fencing",
              "bio": "Used Claude for UI."
            },
            {
              "name": "PyForge",
              "bio": "Used Google AI Studio for the UI."
            }
          ]
        }
      ]
    }
  

    const categories = [
      { id: "all", label: "All", heading: "All Projects", icon: "fa-layer-group" },
      { id: "games", label: "Games", heading: "Games", icon: "fa-gamepad" },
      { id: "utilities", label: "Utilities", heading: "Utilities", icon: "fa-wrench" },
      { id: "tools", label: "CS / Tools", heading: "CS & Tools", icon: "fa-terminal" },
      { id: "misc", label: "Misc", heading: "Misc", icon: "fa-flask" },
      { id: "contributors", label: "Contributors", heading: "Contributors", icon: "fa-users" },
      { id: "credits", label: "Credits", heading: "Credits & Attributions", icon: "fa-heart" }
    ];

    const filters = [
      { id: "puzzle", label: "Puzzle", icon: "fa-puzzle-piece", categories: ["games"] },
      { id: "arcade", label: "Arcade", icon: "fa-bolt", categories: ["games"] },
      { id: "strategy", label: "Strategy", icon: "fa-chess", categories: ["games"] },
      { id: "math", label: "Math", icon: "fa-square-root-variable", categories: ["tools", "utilities"] },
      { id: "cs", label: "CS", icon: "fa-code", categories: ["tools"] },
      { id: "cybersecurity", label: "Cybersecurity", icon: "fa-lock", categories: ["tools", "utilities"] },
      { id: "action", label: "Action", icon: "fa-gun", categories: ["games"] }
    ];

    const projects = [
      {
        title: "Brick Breaker",
        description: "Shoot balls at bricks to survive.",
        category: "games",
        imagePath: "brick_breaker_icon.png",
        url: "games/brick_breaker.html",
        tags: ["arcade", "puzzle", "strategy"],
        author: "noobie",
        uiMadeByAI: true
      },
      {
        title: "Connect the Pipes",
        description: "Rotate the pipes until every piece connects.",
        category: "games",
        imagePath: "connect_the_pipes.png",
        url: "games/connect_the_pipes.html",
        tags: ["puzzle", "strategy"],
        author: "noobie",
        uiMadeByAI: false
      },
      {
        title: "2048",
        description: "2048, but a different theme and custom board sizes.",
        category: "games",
        imagePath: "2048.png",
        url: "games/2048.html",
        tags: ["puzzle", "strategy"],
        author: "noobie",
        uiMadeByAI: true
      },
      {
        title: "Fencing",
        description: "A game where you fence against someone else (AI or a player).",
        category: "games",
        imagePath: "fencing.png",
        url: "games/fencing.html",
        tags: ["action"],
        author: "ColorBlindApple",
        uiMadeByAI: true
      },
      {
        title: "PyForge",
        description: "A Python IDE using the Pyodide framework.",
        category: "tools",
        imagePath: "python.png",
        url: "pyforge.html",
        tags: ["cs"],
        author: "noobie",
        uiMadeByAI: true
      }
    ];

    const contributors = JSON.parse(
      document.querySelector("#contributors-data").textContent
    );

    const credits = JSON.parse(
      document.querySelector("#credits-data").textContent
    );

    const topNav = document.querySelector("#top-nav");
    const sectionHeading = document.querySelector("#projects-heading");
    const filterContainer = document.querySelector("#filters");
    const clearFiltersButton = document.querySelector("#clear-filters");
    const gameGrid = document.querySelector("#game-grid");
    const searchInput = document.querySelector("#search");
    const resultCount = document.querySelector("#result-count");
    const projectsSection = document.querySelector("#projects");
    const contributorsSection = document.querySelector("#contributors");
    const contributorsGrid = document.querySelector("#contributors-grid");
    const creditsSection = document.querySelector("#credits");
    const creditsContent = document.querySelector("#credits-content");

    let activeCategory = "all";
    const activeTags = new Set();

    function renderContributors() {
      contributorsGrid.replaceChildren();

      contributors.forEach((contributor) => {
        const card = document.createElement("article");
        card.className = "contributor-card";

        const iconWrap = document.createElement("div");
        iconWrap.className = "contributor-icon";
        iconWrap.setAttribute("aria-hidden", "true");

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-user";
        iconWrap.appendChild(icon);

        const name = document.createElement("h3");
        name.textContent = contributor.name;

        const bio = document.createElement("p");
        bio.textContent = contributor.bio;

        card.append(iconWrap, name, bio);
        contributorsGrid.appendChild(card);
      });
    }

    function renderCredits() {
      creditsContent.replaceChildren();

      credits.sections.forEach((section) => {
        const sectionWrapper = document.createElement("section");
        sectionWrapper.className = "credits-section";

        const heading = document.createElement("div");
        heading.className = "credits-section-heading";

        const title = document.createElement("h3");
        title.textContent = section.title;
        heading.appendChild(title);

        if (section.description) {
          const description = document.createElement("p");
          description.textContent = section.description;
          heading.appendChild(description);
        }

        const grid = document.createElement("div");
        grid.className = "contributors-grid";

        section.items.forEach((credit) => {
          const card = document.createElement("article");
          card.className = "contributor-card";

          const iconWrap = document.createElement("div");
          iconWrap.className = "contributor-icon";
          iconWrap.setAttribute("aria-hidden", "true");

          const icon = document.createElement("i");
          icon.className = "fa-solid fa-heart";
          iconWrap.appendChild(icon);

          const name = document.createElement("h3");
          name.textContent = credit.name;

          const bio = document.createElement("p");
          bio.textContent = credit.bio;

          card.append(iconWrap, name, bio);

          if (credit.url) {
            const link = document.createElement("a");
            link.href = credit.url;
            link.textContent = "Learn more";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            card.appendChild(link);
          }

          grid.appendChild(card);
        });

        sectionWrapper.append(heading, grid);
        creditsContent.appendChild(sectionWrapper);
      });
    }

    function getVisibleFilters() {
      if (activeCategory === "all") return filters;
      return filters.filter((f) => f.categories.includes(activeCategory));
    }

    function renderTopNav() {
      topNav.replaceChildren();

      categories.forEach((cat) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-button";

        if (cat.id === activeCategory) {
          button.setAttribute("aria-current", "page");
        }

        const icon = document.createElement("i");
        icon.className = `fa-solid ${cat.icon}`;
        icon.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.textContent = cat.label;

        button.append(icon, label);
        button.addEventListener("click", () => {
          activeCategory = cat.id;

          const showingContributors = cat.id === "contributors";
          const showingCredits = cat.id === "credits";
          const showingInfoSection = showingContributors || showingCredits;

          projectsSection.hidden = showingInfoSection;
          contributorsSection.hidden = !showingContributors;
          creditsSection.hidden = !showingCredits;

          sectionHeading.textContent = cat.heading;

          if (!showingInfoSection) {
            const allowed = new Set(getVisibleFilters().map((f) => f.id));

            for (const tagId of Array.from(activeTags)) {
              if (!allowed.has(tagId)) activeTags.delete(tagId);
            }

            renderFilters();
            renderProjects();
          }

          renderTopNav();
        });

        topNav.appendChild(button);
      });
    }

    function renderFilters() {
      filterContainer.replaceChildren();

      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "filter-button";
      allBtn.setAttribute("aria-pressed", String(activeTags.size === 0));

      const allIcon = document.createElement("i");
      allIcon.className = "fa-solid fa-layer-group";
      allIcon.setAttribute("aria-hidden", "true");

      const allLabel = document.createElement("span");
      allLabel.textContent = "All";

      allBtn.append(allIcon, allLabel);
      allBtn.addEventListener("click", () => {
        activeTags.clear();
        renderFilters();
        renderProjects();
      });
      filterContainer.appendChild(allBtn);

      getVisibleFilters().forEach((filter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-button";
        button.setAttribute("aria-pressed", String(activeTags.has(filter.id)));

        const icon = document.createElement("i");
        icon.className = `fa-solid ${filter.icon}`;
        icon.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.textContent = filter.label;

        button.append(icon, label);
        button.addEventListener("click", () => {
          if (activeTags.has(filter.id)) {
            activeTags.delete(filter.id);
          } else {
            activeTags.add(filter.id);
          }

          renderFilters();
          renderProjects();
        });

        filterContainer.appendChild(button);
      });

      clearFiltersButton.hidden =
        activeTags.size === 0 && searchInput.value.trim() === "";
    }

    function renderProjects() {
      const term = searchInput.value.trim().toLowerCase();

      const visibleProjects = projects.filter((project) => {
        const matchesCategory =
          activeCategory === "all" || project.category === activeCategory;

        const matchesTags =
          activeTags.size === 0 ||
          Array.from(activeTags).every((tagId) => project.tags.includes(tagId));

        const searchableText =
          `${project.title} ${project.description} ${project.category} ${project.tags.join(" ")} ${project.author || ""}`.toLowerCase();

        return matchesCategory && matchesTags && searchableText.includes(term);
      });

      gameGrid.replaceChildren();
      resultCount.textContent =
        `${visibleProjects.length} ${visibleProjects.length === 1 ? "project" : "projects"}`;

      clearFiltersButton.hidden = activeTags.size === 0 && term === "";

      if (visibleProjects.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "No projects found.";
        gameGrid.appendChild(emptyState);
        return;
      }

      visibleProjects.forEach((project) => {
        const card = document.createElement("a");
        card.className = "game-card";
        card.href = project.url;
        card.setAttribute(
          "aria-label",
          `Open ${project.title}: ${project.description}`
        );

        if (project.imagePath) {
          card.style.setProperty("--card-image", `url("${project.imagePath}")`);
        } else if (project.gradient) {
          card.style.setProperty("--card-image", project.gradient);
        }

        const content = document.createElement("div");
        content.className = "game-card-content";

        const tags = document.createElement("div");
        tags.className = "game-tags";

        project.tags.forEach((tagId) => {
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

        if (project.author) {
          const authorTag = document.createElement("span");
          authorTag.className = "game-tag";

          const personIcon = document.createElement("i");
          personIcon.className = "fa-solid fa-user";
          personIcon.setAttribute("aria-hidden", "true");

          authorTag.append(personIcon, document.createTextNode(` ${project.author}`));
          tags.appendChild(authorTag);
        }

        if (project.uiMadeByAI === true) {
          const disclaimerTag = document.createElement("span");
          disclaimerTag.className = "game-tag";

          const aiIcon = document.createElement("i");
          aiIcon.className = "fa-solid fa-wand-magic-sparkles";
          aiIcon.setAttribute("aria-hidden", "true");

          disclaimerTag.append(
            aiIcon,
            document.createTextNode(" UI by AI")
          );
          tags.appendChild(disclaimerTag);
        }

        const title = document.createElement("h3");
        title.textContent = project.title;

        const description = document.createElement("p");
        description.textContent = project.description;

        content.append(tags, title, description);
        card.appendChild(content);
        gameGrid.appendChild(card);
      });
    }

    searchInput.addEventListener("input", renderProjects);

    clearFiltersButton.addEventListener("click", () => {
      activeTags.clear();
      searchInput.value = "";
      renderFilters();
      renderProjects();
      searchInput.focus();
    });

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
      savedTheme =
        localStorage.getItem("student-projects-theme") ||
        localStorage.getItem("student-games-theme");
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
        localStorage.setItem("student-projects-theme", nextTheme);
      } catch (error) {
        // No action needed; theme remains applied for this visit.
      }
    });

    renderTopNav();
    renderFilters();
    renderProjects();
    renderContributors();
    renderCredits();
  
