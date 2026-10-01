import { Fragment } from "react";

/** Small, escaped text format: no HTML, scripts, images or executable links. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}
export default function FormattedText({ text }: { text: string }) {
  return <div className="formatted-text">{text.split(/\r?\n/).map((line, i) => {
    if (/^#{1,3} /.test(line)) return <h3 key={i}>{inline(line.replace(/^#{1,3} /, ""))}</h3>;
    if (/^[-•] /.test(line)) return <div className="formatted-bullet" key={i}><span aria-hidden>•</span><span>{inline(line.slice(2))}</span></div>;
    return line ? <p key={i}>{inline(line)}</p> : <div className="formatted-space" key={i} />;
  })}</div>;
}
