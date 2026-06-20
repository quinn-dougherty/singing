"use client";

import { useCallback, useEffect, useState } from "react";

const ID_KEY = "karaoke.clientId";
const NAME_KEY = "karaoke.name";

/**
 * Per-browser identity: a stable random id (for vote attribution) plus an
 * editable display name. No accounts — everything lives in localStorage.
 */
export function useIdentity() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [name, setNameState] = useState("");

  useEffect(() => {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    setClientId(id);
    setNameState(localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  const setName = useCallback((next: string) => {
    const trimmed = next.trim();
    localStorage.setItem(NAME_KEY, trimmed);
    setNameState(trimmed);
  }, []);

  return { clientId, name, setName, ready: clientId !== null };
}
