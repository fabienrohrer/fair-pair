export const homeHeroBannerComponent = {
  name: "home-hero",
  render({ props }) {
    const { t } = props;

    return `
      <section class="fp-hero mb-4">
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
};
