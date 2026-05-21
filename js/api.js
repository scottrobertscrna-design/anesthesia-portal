/**
 * Shared API Client for Google Apps Script Web App
 */
async function callApi(action, params = {}) {
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8" // Bypasses CORS OPTIONS preflight
      },
      body: JSON.stringify({ action, ...params })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP network error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "An unknown API error occurred.");
    }
    
    return result.data;
  } catch (error) {
    console.error("API Call Failed (" + action + "):", error);
    throw error;
  }
}
