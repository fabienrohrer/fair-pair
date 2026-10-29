export const homeHeroBannerComponent = {
  name: "home-hero",
  getInitialLocalState() {
    return { collapsed: false };
  },
  render({ props, localState }) {
    const { t } = props;
    if (localState?.collapsed) {
      return `
        <section class="fp-hero mb-4">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h1 class="h4 mb-0">${t("homeHeroTitle")}</h1>
            <button type="button" class="btn btn-sm btn-outline-light" data-home-hero-toggle>
              ${t("showHomeHero")}
            </button>
          </div>
        </section>
      `;
    }

    return `
      <section class="fp-hero mb-4">
        <div class="d-flex justify-content-end mb-2">
          <button type="button" class="btn btn-sm btn-outline-light" data-home-hero-toggle>
            ${t("hideHomeHero")}
          </button>
        </div>
        <div class="row align-items-center g-4">
          <div class="col-12">
            <h1 class="fp-hero-title">${t("homeHeroTitle")}</h1>
            <p class="fp-hero-copy">${t("homeHeroIntro")}</p>
            <div class="fp-hero-points">
              <div class="fp-hero-point"><i class="bi bi-check-circle-fill"></i><span>${t("homeHeroPoint1")}</span></div>
              <div class="fp-hero-point"><i class="bi bi-check-circle-fill"></i><span>${t("homeHeroPoint2")}</span></div>
              <div class="fp-hero-point"><i class="bi bi-check-circle-fill"></i><span>${t("homeHeroPoint3")}</span></div>
            </div>
          </div>
        </div>
      </section>
    `;
  },
  bind({ props, setLocalState, host }) {
    host.querySelector("[data-home-hero-toggle]")?.addEventListener("click", () => {
      setLocalState((previous = { collapsed: false }) => ({
        ...previous,
        collapsed: !previous.collapsed,
      }));
      props.requestRender();
    });
  },
};
