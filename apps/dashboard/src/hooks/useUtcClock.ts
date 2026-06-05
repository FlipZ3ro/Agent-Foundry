import { useEffect, useState } from "react";

function nowUtc(): string {
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function useUtcClock(): string {
  const [time, setTime] = useState(nowUtc);
  useEffect(() => {
    const id = setInterval(() => setTime(nowUtc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}
