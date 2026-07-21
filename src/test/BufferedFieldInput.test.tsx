import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { BufferedFieldInput } from "../App";

// Confirmado em Chromium real (não só jsdom): sem buffer local, digitar
// "hello" num input controlado cujo `value` só é atualizado depois que um
// upsert assíncrono termina resulta em salvar apenas "o" — cada tecla reverte
// o campo pro valor antigo antes da tecla seguinte ser digitada, porque o
// React sincroniza o input controlado de volta ao `value` prop (que ainda
// não mudou) assim que o evento é processado.
function Harness({ delayMs, type = "text" }: { delayMs: number; type?: string }) {
  const [saved, setSaved] = useState<string | undefined>(undefined);
  return (
    <BufferedFieldInput
      type={type}
      value={saved}
      onCommit={(v) => setTimeout(() => setSaved(v), delayMs)}
    />
  );
}

describe("BufferedFieldInput", () => {
  it("keeps every typed character visible while the async save is in flight (text)", async () => {
    vi.useFakeTimers();
    const { container } = render(<Harness delayMs={300} />);
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "h" } });
    expect(input.value).toBe("h");
    fireEvent.change(input, { target: { value: "he" } });
    expect(input.value).toBe("he");
    fireEvent.change(input, { target: { value: "hel" } });
    expect(input.value).toBe("hel");
    fireEvent.change(input, { target: { value: "hell" } });
    expect(input.value).toBe("hell");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(input.value).toBe("hello");

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(input.value).toBe("hello");
    vi.useRealTimers();
  });

  it("keeps typed digits visible for number inputs too", async () => {
    vi.useFakeTimers();
    const { container } = render(<Harness delayMs={300} type="number" />);
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "4" } });
    expect(input.value).toBe("4");
    fireEvent.change(input, { target: { value: "42" } });
    expect(input.value).toBe("42");

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(input.value).toBe("42");
    vi.useRealTimers();
  });
});
