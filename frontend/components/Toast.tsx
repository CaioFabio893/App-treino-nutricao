"use client";

export default function Toast({ message }: { message: string | null }) {
  return (
    <div id="toast" className={message ? "show" : ""}>
      {message}
    </div>
  );
}