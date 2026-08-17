const API = "/api";

export async function sendMessage(message, conversationHistory = [], sessionContext = {}, signal = null) {
  try {
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationHistory, sessionContext }),
      signal, // Pass abort signal to fetch
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`Chat API error: ${res.status}`, data);
      throw new Error(data.error || data.reply || `Server ${res.status}`);
    }
    
    return data;
  } catch (error) {
    // If abort error, don't log (expected behavior)
    if (error.name === 'AbortError') {
      console.log('Request was aborted');
      throw error;
    }
    console.error('sendMessage error:', error);
    throw error;
  }
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
