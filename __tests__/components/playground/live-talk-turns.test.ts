import { upsertTurn } from "@/components/playground/live-talk";

function turn(id: number, role: "agent" | "user" | "system", text: string, asrTurnId?: number | string | null) {
  return { id, role, text, ts: "00:00:00", asrTurnId };
}

describe("upsertTurn", () => {
  it("updates the bubble when a caller turn grows", () => {
    const turns = [turn(1, "user", "हां जी", 1)];
    const next = upsertTurn(turns, { id: 2, role: "user", text: "हां जी मेरा नाम विक्रम", ts: "00:00:01", asrTurnId: 1 });
    expect(next.length).toBe(1);
    expect(next[0].text).toBe("हां जी मेरा नाम विक्रम");
  });

  it("appends a new caller turn for a new asr id", () => {
    const turns = [turn(1, "user", "हां जी", 1)];
    const next = upsertTurn(turns, { id: 2, role: "user", text: "phone number batao", ts: "00:00:01", asrTurnId: 2 });
    expect(next.length).toBe(2);
  });

  it("appends when no turn id is present (S2S parity)", () => {
    const turns = [turn(1, "user", "hello", undefined)];
    const next = upsertTurn(turns, { id: 2, role: "user", text: "hello again", ts: "00:00:01", asrTurnId: undefined });
    expect(next.length).toBe(2);
  });

  it("always appends agent turns", () => {
    const turns = [turn(1, "agent", "hi", undefined)];
    const next = upsertTurn(turns, { id: 2, role: "agent", text: "hi again", ts: "00:00:01", asrTurnId: undefined });
    expect(next.length).toBe(2);
  });

  it("does not update across an intervening agent reply", () => {
    const turns = [turn(1, "user", "हां जी", 1), turn(2, "agent", "namaste", undefined)];
    const next = upsertTurn(turns, { id: 3, role: "user", text: "हां जी मेरा", ts: "00:00:02", asrTurnId: 1 });
    expect(next.length).toBe(3);
  });
});
