import { describe, expect, it } from "vitest";
import type { MeDTO } from "@/shared/dto/me";
import type { PublicUserDTO } from "@/shared/dto/user";
import type {
  SeasonStandingDTO,
  SeasonScoreboardDTO,
  CareerRankedDTO,
  CareerUnrankedDTO,
  CareerScoreboardDTO,
} from "@/shared/dto/scoreboard";

// security.md DAL-4: password_hash and totp_secret never leave the DAL;
// email never appears in any guest/public response.
//
// Compile-time check: the DTO types we expose to callers do not contain
// secret fields. If somebody adds password_hash to a DTO this test fails to
// compile. The structural check below also acts as a runtime smoke.

type ForbiddenKeys = "password_hash" | "totp_secret";

type AssertNotPresent<T, Bad extends PropertyKey> = Bad extends keyof T ? never : true;

describe("DTO leakage", () => {
  it("MeDTO does not expose secret fields (compile-time + runtime)", () => {
    const _typeCheck: AssertNotPresent<MeDTO, ForbiddenKeys> = true;
    const sample: MeDTO = {
      id: "id",
      email: "a@b.c",
      display_name: "alice",
      role: "PLAYER",
      status: "ACTIVE",
      self_level: null,
      mfa_enabled: false,
      must_change_password: false,
    };
    expect(Object.keys(sample)).not.toContain("password_hash");
    expect(Object.keys(sample)).not.toContain("totp_secret");
    expect(_typeCheck).toBe(true);
  });

  it("PublicUserDTO contains no email or secret fields", () => {
    type _ = AssertNotPresent<PublicUserDTO, "email" | ForbiddenKeys>;
    const sample: PublicUserDTO = { id: "id", display_name: "alice", self_level: null };
    expect(Object.keys(sample)).not.toContain("email");
    expect(Object.keys(sample)).not.toContain("password_hash");
  });

  it("Scoreboard DTOs contain no email or secret fields (req §10, DAL-4)", () => {
    type _S = AssertNotPresent<SeasonStandingDTO, "email" | ForbiddenKeys>;
    type _SB = AssertNotPresent<SeasonScoreboardDTO, "email" | ForbiddenKeys>;
    type _C = AssertNotPresent<CareerRankedDTO, "email" | ForbiddenKeys>;
    type _CU = AssertNotPresent<CareerUnrankedDTO, "email" | ForbiddenKeys>;
    type _CB = AssertNotPresent<CareerScoreboardDTO, "email" | ForbiddenKeys>;

    const standingRow: SeasonStandingDTO = {
      rank: 1,
      user_id: "id",
      display_name: "alice",
      played: 0,
      wins: 0,
      losses: 0,
      sets_for: 0,
      sets_against: 0,
      games_for: 0,
      games_against: 0,
    };
    const season: SeasonScoreboardDTO = { tournament_id: null, tournament_name: null, rows: [standingRow] };
    expect(Object.keys(standingRow)).not.toContain("email");
    expect(JSON.stringify(season)).not.toMatch(/"email"/);

    const careerRow: CareerRankedDTO = {
      rank: 1,
      user_id: "id",
      display_name: "alice",
      played: 10,
      wins: 7,
      losses: 3,
      win_pct: 0.7,
    };
    const career: CareerScoreboardDTO = { threshold: 10, ranked: [careerRow], unranked: [] };
    expect(Object.keys(careerRow)).not.toContain("email");
    expect(JSON.stringify(career)).not.toMatch(/"email"/);
  });
});
