import '@testing-library/jest-dom/vitest';

// jsdom has no matchMedia. Report every media query as matching so antd's
// Grid breakpoints are all on and responsive table columns render in tests.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom has no ResizeObserver. antd Table and Menu use it for measuring.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
