import { renderAppBar } from "../renderers.js";

export const appHeaderComponent = {
  name: "app-bar",
  render({ props }) {
    return renderAppBar({ t: props.t, language: props.language });
  },
  bind({ host, props }) {
    host.querySelector("[data-nav-home]")?.addEventListener("click", () => {
      props.onHomeRequest();
    });
    host.querySelectorAll(".lang-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const nextLanguage = button.dataset.lang === "fr" ? "fr" : "en";
        props.onLanguageChange(nextLanguage);
      });
    });
  },
};
