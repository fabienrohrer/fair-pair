import { escapeHtml } from "../../utils.js";

const pendingBindings = [];
const localStateStore = new Map();

function getInstanceId(componentName, key) {
  return `${componentName}:${key}`;
}

function getHostElement(instanceId) {
  return document.querySelector(`[data-component-instance="${instanceId}"]`);
}

export function renderComponent(component, { key, props = {}, context = {} } = {}) {
  if (!component || typeof component.render !== "function") {
    throw new Error("renderComponent requires a component with a render function.");
  }
  if (!key) {
    throw new Error(`Component "${component.name || "anonymous"}" requires a stable key.`);
  }

  const componentName = component.name || "anonymous";
  const instanceId = getInstanceId(componentName, key);

  if (!localStateStore.has(instanceId)) {
    const initialState =
      typeof component.getInitialLocalState === "function"
        ? component.getInitialLocalState({ props, context })
        : undefined;
    localStateStore.set(instanceId, initialState);
  }

  const localState = localStateStore.get(instanceId);
  const html = component.render({ props, context, localState }) || "";

  if (typeof component.bind === "function") {
    pendingBindings.push({
      component,
      instanceId,
      props,
      context,
    });
  }

  return `<div data-component-instance="${escapeHtml(instanceId)}">${html}</div>`;
}

export function bindRenderedComponents() {
  const bindings = pendingBindings.splice(0, pendingBindings.length);
  bindings.forEach(({ component, instanceId, props, context }) => {
    const host = getHostElement(instanceId);
    if (!host) {
      return;
    }
    component.bind({
      host,
      props,
      context,
      localState: localStateStore.get(instanceId),
      setLocalState: (updater) => {
        const previous = localStateStore.get(instanceId);
        const next = typeof updater === "function" ? updater(previous) : updater;
        localStateStore.set(instanceId, next);
      },
    });
  });
}
