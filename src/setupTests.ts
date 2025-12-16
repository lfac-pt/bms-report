// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Polyfill for TextEncoder/TextDecoder (needed for jsPDF in tests)
import { TextEncoder, TextDecoder } from "util";

// eslint-disable-next-line no-undef
global.TextEncoder = TextEncoder;
// eslint-disable-next-line no-undef
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Mock pdfExport module to avoid jsPDF issues in test environment
jest.mock("./utils/pdfExport", () => ({
  exportToPDF: jest.fn().mockResolvedValue(undefined),
}));

// Mock window.matchMedia for Ant Design Grid and responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver for Ant Design Table and other components
// eslint-disable-next-line no-undef
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock getComputedStyle to avoid CSS selector parsing issues with Ant Design
Object.defineProperty(window, "getComputedStyle", {
  writable: true,
  value: () => ({
    getPropertyValue: () => "",
    width: "0",
    height: "0",
    overflow: "visible",
    boxSizing: "border-box",
  }),
});
