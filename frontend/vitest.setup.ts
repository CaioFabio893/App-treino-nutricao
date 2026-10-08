import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom não implementa matchMedia (usado por libs responsivas/gráficos).
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom não implementa ResizeObserver (exigido por recharts em alguns charts).
if (!window.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverStub,
  });
}

// Limpeza automática do RTL roda com globals:true; reforça estado limpo.
afterEach(() => {
  localStorage.clear();
});
// Native dialog methods are absent in jsdom; browser E2E exercises real focus.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
}
