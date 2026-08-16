const API = "/api";

export async function sendMessage(message, conversationHistory = [], sessionContext = {}) {
  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationHistory, sessionContext }),
  });
  if (!res.ok) throw new Error(`Server ${res.status}`);
  return res.json();
}

export async function getResource(type, id = "") {
  const url = id ? `${API}/resources/${type}/${id}` : `${API}/resources/${type}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Resource not found: ${type}/${id}`);
  return res.json();
}

export async function submitLead(data) {
  const res = await fetch(`${API}/resources/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
