import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import FormattedText from "@/components/FormattedText";
import TextEditor from "@/components/TextEditor";

describe("Nutrition text formatting", () => {
  it("renders bold, headings and markers while escaping HTML", () => {
    const { container } = render(<FormattedText text={'## Preparo\n- **Aveia** 🥣\n<script>alert(1)</script>'} />);
    expect(screen.getByRole("heading", {name:"Preparo"})).toBeInTheDocument();
    expect(screen.getByText("Aveia").tagName).toBe("STRONG");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });
  it("formats selected text without submitting and previews the stored text", () => {
    function Example() { const [value, setValue] = useState("Aveia"); return <TextEditor value={value} onChange={setValue} />; }
    render(<Example />);
    const area = screen.getByRole("textbox") as HTMLTextAreaElement;
    area.setSelectionRange(0,5);
    fireEvent.click(screen.getByRole("button", {name:"Negrito"}));
    expect(area.value).toBe("**Aveia**");
    fireEvent.click(screen.getByRole("button", {name:"Visualizar"}));
    expect(screen.getByText("Aveia").tagName).toBe("STRONG");
  });
});
