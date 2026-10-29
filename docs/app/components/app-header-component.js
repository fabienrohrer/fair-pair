import { renderAppBar } from "../renderers.js";

export const appHeaderComponent = {
  name: "app-bar",
  render({ props }) {
    return renderAppBar({ t: props.t, language: props.language });
  },
  bind({ host, props }) {
    host.querySelectorAll(".lang-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const nextLanguage = button.dataset.lang === "fr" ? "fr" : "en";
        props.onLanguageChange(nextLanguage);
      });
    });
  },
};
