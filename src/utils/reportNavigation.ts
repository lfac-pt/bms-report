/* global CustomEvent */
/** Ask an iframe host to scroll too; a full-height iframe has no internal scroll range. */
export function scrollToReportSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ block: "start" });
  window.dispatchEvent(new CustomEvent("bms-report:section", { detail: { id } }));
}
