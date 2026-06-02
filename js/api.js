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

// --- Shared Utility Helpers ---

// Helper: decode Base64 to a binary Uint8Array in-browser
function base64ToUint8Array(base64) {
  const raw = window.atob(base64);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));
  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

// Helper: Format AM/PM string to 24h input format
function formatTimeForInput(timeStr) {
  if (!timeStr) return '';
  const [time, ampm] = timeStr.split(' ');
  let [h, m] = time.split(':');
  h = parseInt(h, 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

// Helper: Show dynamic alert toast (success or error)
function showToast(message, type = 'danger') {
  let toast = document.getElementById('api-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'api-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.zIndex = '9999';
    toast.style.fontWeight = '600';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease, bottom 0.3s ease';
    document.body.appendChild(toast);
  }
  toast.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
  toast.innerText = message;
  toast.style.opacity = '1';
  toast.style.bottom = '30px';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.bottom = '20px';
  }, 4000);
}

