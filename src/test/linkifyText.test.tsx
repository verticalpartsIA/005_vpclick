import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { linkifyText } from "../App";

describe("linkifyText", () => {
  it("returns plain text untouched when there is no URL", () => {
    const { container } = render(<div>{linkifyText("sem nenhum link aqui")}</div>);
    expect(container.textContent).toBe("sem nenhum link aqui");
    expect(container.querySelector("a")).toBeNull();
  });

  it("turns a bare https URL into a clickable link", () => {
    const { container } = render(<div>{linkifyText("veja https://exemplo.com/pagina para mais info")}</div>);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://exemplo.com/pagina");
    expect(link?.textContent).toBe("https://exemplo.com/pagina");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(container.textContent).toBe("veja https://exemplo.com/pagina para mais info");
  });

  it("adds https:// to a www.-style link without a scheme", () => {
    const { container } = render(<div>{linkifyText("acesse www.exemplo.com.br agora")}</div>);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://www.exemplo.com.br");
    expect(link?.textContent).toBe("www.exemplo.com.br");
  });

  it("keeps trailing sentence punctuation outside the link", () => {
    const { container } = render(<div>{linkifyText("confirme em https://exemplo.com/x.")}</div>);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://exemplo.com/x");
    expect(container.textContent).toBe("confirme em https://exemplo.com/x.");
  });

  it("linkifies multiple URLs in the same text", () => {
    const { container } = render(<div>{linkifyText("https://a.com e depois https://b.com")}</div>);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("https://a.com");
    expect(links[1].getAttribute("href")).toBe("https://b.com");
  });
});
