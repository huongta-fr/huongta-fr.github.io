function openTab(event, tabId) {
        const tabs = document.querySelectorAll('.tab');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => tab.classList.remove('active'));
        contents.forEach(content => content.classList.remove('active'));

        document.getElementById(tabId).classList.add('active');
        event.currentTarget.classList.add('active');
      }

// New function for sidebar (DS|DA|DE menu)
function openMenu(event, sectionId) {
    // Hide all content sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => (section.style.display = 'none'));

    // Show the selected one
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.style.display = 'block';

    // Update active states in sidebar
    const links = document.querySelectorAll('.nav-link.sub-item');
    links.forEach(link => link.classList.remove('active'));

    event.currentTarget.classList.add('active');
}

document.addEventListener("DOMContentLoaded", () => {
  const zoomableImages = document.querySelectorAll(".zoomable");

  zoomableImages.forEach(img => {
    img.addEventListener("click", () => {
      const overlay = document.createElement("div");
      overlay.classList.add("zoom-overlay");

      const zoomedImg = document.createElement("img");
      zoomedImg.src = img.src;
      zoomedImg.alt = img.alt;

      overlay.appendChild(zoomedImg);
      document.body.appendChild(overlay);

      overlay.addEventListener("click", () => {
        overlay.remove();
      });
    });
  });
});

document.addEventListener('DOMContentLoaded', function () {
    // Wait for sidebar + content to exist
    setTimeout(function() {
      const defaultLink = document.querySelector('.nav-link.sub-item[data-target="history"], .nav-link.sub-item[onclick*="history"]');
      if (defaultLink) {
        // Simulate a click to show History by default
        defaultLink.click();
      }
    }, 100);
  });

