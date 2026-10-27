/* BMS report embed helper. Paste the iframe and this script into Weebly's Embed Code element. */
(function () {
  "use strict";
  if (window.__bmsReportEmbedInstalled) return;
  window.__bmsReportEmbedInstalled = true;
  function frames() {
    return Array.from(document.querySelectorAll("iframe[data-bms-report]"));
  }
  function originOf(frame) {
    try {
      var url = new window.URL(frame.src, window.location.href);
      return /^https?:$/.test(url.protocol) ? url.origin : null;
    } catch {
      return null;
    }
  }
  function initialize(frame) {
    var origin = originOf(frame);
    if (origin && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "bms-report:init" }, origin);
    }
  }
  window.addEventListener("message", function (event) {
    var frame = frames().find(function (candidate) {
      return candidate.contentWindow === event.source && originOf(candidate) === event.origin;
    });
    if (!frame || !event.data) return;
    if (event.data.type === "bms-report:ready") initialize(frame);
    if (event.data.type === "bms-report:resize") {
      var height = event.data.height;
      if (
        typeof height === "number" &&
        Number.isFinite(height) &&
        height >= 100 &&
        height <= 100000
      ) {
        frame.style.height = Math.ceil(height) + "px";
      }
    }
    if (event.data.type === "bms-report:scroll") {
      var top = event.data.top;
      if (
        typeof top === "number" &&
        Number.isFinite(top) &&
        top >= 0 &&
        top <= frame.offsetHeight
      ) {
        window.scrollTo({
          top: Math.max(0, frame.getBoundingClientRect().top + window.scrollY + top),
          behavior: "auto",
        });
      }
    }
  });
  function start() {
    frames().forEach(function (frame) {
      frame.addEventListener("load", function () {
        initialize(frame);
      });
      initialize(frame);
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
