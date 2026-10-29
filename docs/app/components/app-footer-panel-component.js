export const appFooterPanelComponent = {
  name: "app-footer",
  render() {
    return `
      <footer class="fairpair-footer mt-4">
        <div class="fairpair-footer-inner">
          <div class="fairpair-footer-brand">
            <img class="brand-logo fairpair-footer-logo" src="./fair-pair-logo.svg" alt="Fair Pair logo" />
          </div>
          <div class="fairpair-footer-meta">
            <a href="https://github.com/fabienrohrer/fair-pair" target="_blank" rel="noopener noreferrer" class="fairpair-icon-link" aria-label="Fair Pair on GitHub">
              <i class="bi bi-github fairpair-icon"></i>
              <span>GitHub</span>
            </a>
            <span class="fairpair-footer-dot">•</span>
            <span>Open source</span>
            <span class="fairpair-footer-dot">•</span>
            <span>Made with AI</span>
            <i class="bi bi-stars fairpair-icon fairpair-icon-small" aria-hidden="true"></i>
          </div>
        </div>
      </footer>
    `;
  },
};
