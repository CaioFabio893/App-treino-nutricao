import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ExerciseVideo from "@/components/ExerciseVideo";

const ID = "dQw4w9WgXcQ"; // 11 caracteres — formato válido do YouTube
const title = "Ver execução · Agachamento";

describe("ExerciseVideo", () => {
  it("não renderiza nada para URL não-HTTPS", () => {
    const { container } = render(<ExerciseVideo url="http://youtube.com/watch?v=dQw4w9WgXcQ" title={title} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("abre o iframe youtube-nocookie só após o clique e fecha de novo", () => {
    render(<ExerciseVideo url={`https://www.youtube.com/watch?v=${ID}`} title={title} />);
    expect(screen.queryByTitle(title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver execução/ }));
    const frame = screen.getByTitle(title);
    expect(frame).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${ID}?playsinline=1&rel=0`);

    fireEvent.click(screen.getByRole("button", { name: /Fechar vídeo/ }));
    expect(screen.queryByTitle(title)).not.toBeInTheDocument();
  });

  it.each([
    ["watch", `https://www.youtube.com/watch?v=${ID}`],
    ["youtu.be", `https://youtu.be/${ID}`],
    ["shorts", `https://www.youtube.com/shorts/${ID}`],
    ["live", `https://www.youtube.com/live/${ID}`],
    ["embed", `https://www.youtube.com/embed/${ID}`],
  ])("reconhece o formato %s", (_label, url) => {
    render(<ExerciseVideo url={url} title={title} />);
    expect(screen.getByRole("button", { name: /Ver execução/ })).toBeInTheDocument();
  });

  it("cai para link quando o ID é inválido, mantendo a URL original", () => {
    const bad = "https://www.youtube.com/watch?v=curto";
    render(<ExerciseVideo url={bad} title={title} />);
    const link = screen.getByRole("link", { name: title });
    expect(link).toHaveAttribute("href", bad);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
