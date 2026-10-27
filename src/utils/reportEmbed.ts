/* global HTMLElement, MessageEvent, Event, CustomEvent, ResizeObserver */
export const REPORT_MESSAGE = {
  ready: "bms-report:ready",
  init: "bms-report:init",
  resize: "bms-report:resize",
  scroll: "bms-report:scroll",
} as const;

/** Connect only to the actual containing window, then target its exact origin. */
export function connectReportEmbed(root: HTMLElement) {
  if (window.parent === window) return () => {};
  let parentOrigin: string | null = null;
  let lastHeight = 0;
  let frame = 0;
  let disposed = false;
  const sendSize = () => {
    frame = 0;
    if (disposed || !parentOrigin) return;
    const height = Math.ceil(root.getBoundingClientRect().height);
    if (height > 0 && height !== lastHeight) {
      lastHeight = height;
      window.parent.postMessage({ type: REPORT_MESSAGE.resize, height }, parentOrigin);
    }
  };
  const scheduleSize = () => {
    if (!frame) frame = window.requestAnimationFrame(sendSize);
  };
  const receive = (event: MessageEvent) => {
    if (
      event.source !== window.parent ||
      event.data?.type !== REPORT_MESSAGE.init ||
      !/^https?:\/\//.test(event.origin)
    )
      return;
    parentOrigin = event.origin;
    lastHeight = 0;
    scheduleSize();
  };
  const section = (event: Event) => {
    const id = (event as CustomEvent<{ id: string }>).detail?.id;
    const element = id ? document.getElementById(id) : null;
    if (element && parentOrigin)
      window.parent.postMessage(
        {
          type: REPORT_MESSAGE.scroll,
          top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - 16),
        },
        parentOrigin
      );
  };
  const observer = new ResizeObserver(scheduleSize);
  observer.observe(root);
  window.addEventListener("message", receive);
  window.addEventListener("bms-report:section", section);
  // This handshake carries no report data; the response establishes the exact parent origin.
  window.parent.postMessage({ type: REPORT_MESSAGE.ready }, "*");
  return () => {
    disposed = true;
    observer.disconnect();
    window.cancelAnimationFrame(frame);
    window.removeEventListener("message", receive);
    window.removeEventListener("bms-report:section", section);
  };
}
