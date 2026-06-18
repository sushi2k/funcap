import { describe, it, expect } from "vitest";
import { DisplayName, SelfLevel } from "../src/shared/schemas/user";

describe("scaffold smoke", () => {
  it("validates a display name", () => {
    expect(DisplayName.safeParse("Alice_99").success).toBe(true);
    expect(DisplayName.safeParse("<script>").success).toBe(false);
  });

  it("validates self_level range", () => {
    expect(SelfLevel.safeParse(5).success).toBe(true);
    expect(SelfLevel.safeParse(11).success).toBe(false);
  });
});
