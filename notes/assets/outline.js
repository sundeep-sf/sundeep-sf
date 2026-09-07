const validViews = new Set(["normal", "outline"]);
const viewPreferenceKey = "notes-view";

function readSavedView() {
  try {
    const savedView = localStorage.getItem(viewPreferenceKey);
    return validViews.has(savedView) ? savedView : null;
  } catch {
    return null;
  }
}

function saveView(view) {
  try {
    localStorage.setItem(viewPreferenceKey, view);
  } catch {
    // The selected view still applies when storage is unavailable.
  }
}

function updateInternalLinks(view) {
  document.querySelectorAll("a[href]").forEach((link) => {
    const url = new URL(link.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin || !["http:", "https:"].includes(url.protocol)) {
      return;
    }
    url.searchParams.set("view", view);
    link.href = url.toString();
  });
}

function applyView(view, { save = false, scroll = false } = {}) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
  document.querySelectorAll("[data-view-option]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewOption === view));
  });

  const outlineControls = document.querySelector("[data-outline-controls]");
  if (outlineControls) {
    outlineControls.hidden = view !== "outline";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  history.replaceState(null, "", url);
  updateInternalLinks(view);

  if (save) {
    saveView(view);
  }
  if (scroll) {
    window.scrollTo(0, 0);
  }
}

function setSectionState(heading, expanded, animate = true) {
  const content = heading.nextElementSibling;
  if (!content) return;

  if (animate && !expanded) {
    content.style.maxHeight = `${content.scrollHeight}px`;
    requestAnimationFrame(() => {
      content.style.maxHeight = "0";
      content.style.opacity = "0";
    });
  } else {
    content.style.maxHeight = expanded ? "none" : "0";
    content.style.opacity = expanded ? "1" : "0";
  }

  heading.classList.toggle("expanded", expanded);
  heading.classList.toggle("collapsed", !expanded);
  heading.setAttribute("aria-expanded", String(expanded));
  content.setAttribute("aria-hidden", String(!expanded));
  content.inert = !expanded;
}

const outlineHeadings = [...document.querySelectorAll("[data-view-panel='outline'] .section-heading")];
const toggleAllButton = document.getElementById("toggle-all");

function updateGlobalAction() {
  if (!toggleAllButton) return;
  const allExpanded = outlineHeadings.every(
    (heading) => heading.getAttribute("aria-expanded") === "true",
  );
  toggleAllButton.textContent = allExpanded ? "Collapse all" : "Expand all";
}

outlineHeadings.forEach((heading, index) => {
  const content = heading.nextElementSibling;
  const section = heading.closest(".section");
  const contentId = content.id || `outline-section-${index + 1}`;
  const startsExpanded = section?.dataset.outlineDepth === "1";

  content.id = contentId;
  heading.setAttribute("aria-controls", contentId);
  setSectionState(heading, startsExpanded, false);

  const toggle = () => {
    const isExpanded = heading.getAttribute("aria-expanded") === "true";
    setSectionState(heading, !isExpanded);
    updateGlobalAction();
  };

  heading.addEventListener("click", toggle);
  heading.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
});

toggleAllButton?.addEventListener("click", () => {
  const expand = toggleAllButton.textContent === "Expand all";
  outlineHeadings.forEach((heading) => setSectionState(heading, expand, false));
  toggleAllButton.textContent = expand ? "Collapse all" : "Expand all";
});

document.querySelectorAll("[data-view-option]").forEach((button) => {
  button.addEventListener("click", () => {
    applyView(button.dataset.viewOption, { save: true, scroll: true });
  });
});

const linkToggle = document.getElementById("link-toggle");
linkToggle?.addEventListener("change", () => {
  document.getElementById("article")?.classList.toggle("links-hidden", !linkToggle.checked);
});

const requestedView = new URL(window.location.href).searchParams.get("view");
const initialView = validViews.has(requestedView) ? requestedView : readSavedView() || "outline";
applyView(initialView);
