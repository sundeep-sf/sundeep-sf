function toggleSection(heading) {
  const content = heading.nextElementSibling;
  const isExpanded = heading.getAttribute("aria-expanded") === "true";

  if (isExpanded) {
    content.style.maxHeight = `${content.scrollHeight}px`;
    requestAnimationFrame(() => {
      content.style.maxHeight = "0";
      content.style.opacity = "0";
    });
    heading.classList.remove("expanded");
    heading.classList.add("collapsed");
    heading.setAttribute("aria-expanded", "false");
    content.setAttribute("aria-hidden", "true");
  } else {
    content.style.maxHeight = `${content.scrollHeight}px`;
    content.style.opacity = "1";
    heading.classList.remove("collapsed");
    heading.classList.add("expanded");
    heading.setAttribute("aria-expanded", "true");
    content.setAttribute("aria-hidden", "false");
    setTimeout(() => {
      content.style.maxHeight = "none";
    }, 300);
  }
}

document.querySelectorAll(".section-heading").forEach((heading, index) => {
  const content = heading.nextElementSibling;
  const contentId = content.id || `outline-section-${index + 1}`;

  content.id = contentId;
  content.style.maxHeight = "none";
  content.style.opacity = "1";
  content.setAttribute("aria-hidden", "false");
  heading.setAttribute("aria-controls", contentId);
  heading.setAttribute("aria-expanded", "true");
  heading.addEventListener("click", () => toggleSection(heading));
  heading.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSection(heading);
    }
  });
});

const toggleAllButton = document.getElementById("toggle-all");
let allExpanded = true;

toggleAllButton?.addEventListener("click", () => {
  allExpanded = !allExpanded;
  document.querySelectorAll(".section-heading").forEach((heading) => {
    const content = heading.nextElementSibling;
    content.style.maxHeight = allExpanded ? "none" : "0";
    content.style.opacity = allExpanded ? "1" : "0";
    heading.classList.toggle("collapsed", !allExpanded);
    heading.classList.toggle("expanded", allExpanded);
    heading.setAttribute("aria-expanded", String(allExpanded));
    content.setAttribute("aria-hidden", String(!allExpanded));
  });
  toggleAllButton.textContent = allExpanded ? "Collapse all" : "Expand all";
});

function toggleLinks(show) {
  document.getElementById("article")?.classList.toggle("links-hidden", !show);
}
