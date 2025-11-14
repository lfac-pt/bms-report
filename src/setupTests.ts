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
