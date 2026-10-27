/* global Window, MessageEvent */
import { readFileSync } from "fs";
import { resolve } from "path";
import { runInNewContext } from "vm";

test("host validates both iframe window and origin, then accepts bounded height changes", () => {
  const iframe = document.createElement("iframe");
  iframe.src = "https://reports.example/report-2026.html";
  iframe.setAttribute("data-bms-report", "");
  document.body.append(iframe);
  const addListener = jest.spyOn(window, "addEventListener");
  const post = jest.spyOn(iframe.contentWindow!, "postMessage");
  jest.spyOn(document, "readyState", "get").mockReturnValue("complete");
  runInNewContext(readFileSync(resolve("public/embed-report.js"), "utf8"), { window, document });
  expect(post).toHaveBeenCalledWith({ type: "bms-report:init" }, "https://reports.example");
  const send = (
    height: unknown,
    origin = "https://reports.example",
    source: Window = iframe.contentWindow!
  ) =>
    window.dispatchEvent(
      new MessageEvent("message", { origin, source, data: { type: "bms-report:resize", height } })
    );
  send(900, "https://wrong.example");
  send(900, "https://reports.example", window);
  expect(iframe.style.height).toBe("");
  send(900);
  expect(iframe.style.height).toBe("900px");
  send(500);
  expect(iframe.style.height).toBe("500px");
  for (const value of [NaN, Infinity, -1, 100001, "1000"]) send(value);
  expect(iframe.style.height).toBe("500px");
  for (const [type, listener] of addListener.mock.calls)
    if (type === "message") window.removeEventListener(type, listener);
  Reflect.deleteProperty(window, "__bmsReportEmbedInstalled");
  iframe.remove();
  jest.restoreAllMocks();
});
