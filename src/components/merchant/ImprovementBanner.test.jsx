// ImprovementBanner.test.jsx — the four rating states, one per copy title.
import { render, screen } from "@testing-library/react";
import ImprovementBanner from "./ImprovementBanner.jsx";

test("new: rating 0, no window", () => {
  render(<ImprovementBanner rating={0} improvementUntil={null} />);
  expect(screen.getByText("Just getting started")).toBeInTheDocument();
});

test("healthy: rating 4.5, no window", () => {
  render(<ImprovementBanner rating={4.5} improvementUntil={null} />);
  expect(screen.getByText("Healthy standing")).toBeInTheDocument();
});

test("warning: rating 3.6, no window", () => {
  render(<ImprovementBanner rating={3.6} improvementUntil={null} />);
  expect(screen.getByText("Getting close to the threshold")).toBeInTheDocument();
});

test("window: improvementUntil set", () => {
  render(<ImprovementBanner rating={3.2} improvementUntil="2026-09-01T00:00:00Z" />);
  expect(screen.getByText("Improvement window active")).toBeInTheDocument();
});
