/* global ResizeObserverCallback, FrameRequestCallback, DOMRect, MessageEvent, Window, ResizeObserver */
import { connectReportEmbed, REPORT_MESSAGE } from "./reportEmbed";

let parentDescriptor: PropertyDescriptor | undefined;
let observerDescriptor: PropertyDescriptor | undefined;
let resized: ResizeObserverCallback;
let scheduled: FrameRequestCallback[];
const parentWindow = { postMessage: jest.fn() };

beforeEach(() => {
  parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");
  observerDescriptor = Object.getOwnPropertyDescriptor(window, "ResizeObserver");
  Object.defineProperty(window, "parent", { value: parentWindow, configurable: true });
  class Observer {
    constructor(callback: ResizeObserverCallback) {
      resized = callback;
    }
    observe() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", { value: Observer, configurable: true });
  scheduled = [];
  jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
    scheduled.push(callback);
    return scheduled.length;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  parentWindow.postMessage.mockClear();
});
afterEach(() => {
  if (parentDescriptor) Object.defineProperty(window, "parent", parentDescriptor);
  if (observerDescriptor) Object.defineProperty(window, "ResizeObserver", observerDescriptor);
  else Reflect.deleteProperty(window, "ResizeObserver");
  jest.restoreAllMocks();
});
const flush = () => {
  const callbacks = scheduled.splice(0);
  callbacks.forEach(callback => callback(0));
};

test("resizing requires the actual parent handshake and supports shrinking without loops", () => {
  let height = 800;
  const root = document.createElement("div");
  jest.spyOn(root, "getBoundingClientRect").mockImplementation(() => ({ height }) as DOMRect);
  const cleanup = connectReportEmbed(root);
  expect(parentWindow.postMessage).toHaveBeenCalledWith({ type: REPORT_MESSAGE.ready }, "*");
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: "https://unrelated.example",
      source: window,
      data: { type: REPORT_MESSAGE.init },
    })
  );
  flush();
  expect(parentWindow.postMessage).toHaveBeenCalledTimes(1);
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: "https://tagis.pt",
      source: parentWindow as unknown as Window,
      data: { type: REPORT_MESSAGE.init },
    })
  );
  flush();
  expect(parentWindow.postMessage).toHaveBeenLastCalledWith(
    { type: REPORT_MESSAGE.resize, height: 800 },
    "https://tagis.pt"
  );
  resized([], {} as ResizeObserver);
  flush();
  expect(parentWindow.postMessage).toHaveBeenCalledTimes(2);
  height = 450;
  resized([], {} as ResizeObserver);
  flush();
  expect(parentWindow.postMessage).toHaveBeenLastCalledWith(
    { type: REPORT_MESSAGE.resize, height: 450 },
    "https://tagis.pt"
  );
  cleanup();
  resized([], {} as ResizeObserver);
  flush();
  expect(parentWindow.postMessage).toHaveBeenCalledTimes(3);
});
