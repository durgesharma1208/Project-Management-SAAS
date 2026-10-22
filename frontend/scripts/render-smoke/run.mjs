import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' });
const { window } = dom;

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
class IntersectionObserverStub { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }

globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.DragEvent = window.DragEvent || window.Event;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = window.ResizeObserver = ResizeObserverStub;
globalThis.IntersectionObserver = window.IntersectionObserver = IntersectionObserverStub;
globalThis.matchMedia = window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.localStorage = window.localStorage;
globalThis.DOMParser = window.DOMParser;
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

process.on('unhandledRejection', (reason) => {
  console.log('UNHANDLED REJECTION:', String(reason && reason.stack ? reason.stack.split('\n')[0] : reason));
});

await import('./out.mjs');
