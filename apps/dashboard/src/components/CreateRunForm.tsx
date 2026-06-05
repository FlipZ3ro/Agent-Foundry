import { useState, type FormEvent } from "react";
import { Icon } from "./Icon.js";

export function CreateRunForm({ onCreate }: { onCreate: (idea: string) => Promise<void> }) {
  const [idea, setIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = idea.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onCreate(trimmed);
      setIdea("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <input
        type="text"
        placeholder="what do you want to ship?"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        disabled={submitting}
      />
      <button type="submit" className="primary" disabled={submitting || !idea.trim()}>
        <Icon name={submitting ? "sparkle" : "play"} />
        {submitting ? "running" : "run"}
      </button>
    </form>
  );
}
