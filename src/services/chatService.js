const API = "/api";

export async function sendMessage(message, conversationHistory = [], sessionContext = {}, signal = null) {
  try {
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationHistory, sessionContext }),
      signal, // Pass abort signal to fetch
    });
    
    // Try to parse JSON safely — handle empty or non-JSON responses
    let data;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      console.error(`Failed to parse response (status ${res.status}):`, parseErr.message);
      // Return a fallback response instead of crashing
      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }
      // If response was "ok" but unparseable, return minimal valid data
      data = { reply: "I'm processing that. Could you ask again?", success: true };
    }
    
    if (!res.ok) {
      // An empty body on a 5xx means the request never reached the API server
      // (dev proxy could not connect, or the process is down) — say so plainly
      // instead of the useless "Server 500 Data: {}".
      const isEmpty = !data || Object.keys(data).length === 0;
      if (res.status >= 500 && isEmpty) {
        console.error(
          `[CHAT] API server unreachable (HTTP ${res.status}, empty body).\n` +
          `       The backend on :3001 is probably not running.\n` +
          `       Start it with "npm run server" — or use "npm run dev" to start both.`
        );
        throw new Error("API_UNREACHABLE");
      }
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
    // Already reported above with an actionable message
    if (error.message === 'API_UNREACHABLE') throw error;
    // fetch() rejects outright when nothing is listening at all
    if (error instanceof TypeError) {
      console.error(
        `[CHAT] Could not reach the API server at ${API}/chat.\n` +
        `       Start the backend with "npm run server", or "npm run dev" to start both.`
      );
      throw new Error("API_UNREACHABLE");
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
