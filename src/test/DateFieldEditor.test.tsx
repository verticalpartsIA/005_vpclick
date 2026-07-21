import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { DateFieldEditor } from "../App";

// Reproduz o bug relatado: o usuário termina de digitar uma data (o
// "commit" só acontece quando o valor fica completo/válido), mas o
// salvamento é assíncrono (upsert no Supabase). Se algo re-renderiza o
// componente pai nesse intervalo com o valor antigo (ex: uma tarefa
// mudando via realtime em outro lugar do app), o campo não deve reverter
// para o valor antigo/vazio.
function Harness({ delayMs }: { delayMs: number }) {
  const [saved, setSaved] = useState<string | undefined>(undefined);
  const [unrelatedTick, setUnrelatedTick] = useState(0);

  const onCommit = (v: string) => {
    setTimeout(() => setSaved(v), delayMs);
  };

  return (
    <div>
      <button onClick={() => setUnrelatedTick((t) => t + 1)}>bump</button>
      <DateFieldEditor value={saved} onCommit={onCommit} />
    </div>
  );
}

describe("DateFieldEditor", () => {
  it("keeps the typed date visible while the async save is in flight, even if an unrelated re-render happens", async () => {
    vi.useFakeTimers();
    const { container, getByText } = render(<Harness delayMs={300} />);
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;

    fireEvent.change(dateInput, { target: { value: "2026-07-21" } });
    expect(dateInput.value).toBe("2026-07-21");

    // Um re-render não relacionado (ex: outra tarefa atualizada via
    // realtime) ocorre ANTES do upsert assíncrono terminar.
    fireEvent.click(getByText("bump"));
    expect(dateInput.value).toBe("2026-07-21");

    // O upsert assíncrono agora termina.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(dateInput.value).toBe("2026-07-21");

    vi.useRealTimers();
  });

  it("does not commit while the date is incomplete (partial year typed)", () => {
    const onCommit = vi.fn();
    const { container } = render(<DateFieldEditor value={undefined} onCommit={onCommit} />);
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;

    // Native <input type="date"> reports "" while a segment (e.g. the year)
    // is only partially filled in.
    fireEvent.change(dateInput, { target: { value: "" } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits an explicit clear when a previously saved value is removed", () => {
    const onCommit = vi.fn();
    const { container } = render(<DateFieldEditor value="2026-07-21" onCommit={onCommit} />);
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;

    fireEvent.change(dateInput, { target: { value: "" } });
    expect(onCommit).toHaveBeenCalledWith("");
  });
});
