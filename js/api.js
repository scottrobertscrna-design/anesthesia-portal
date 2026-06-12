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

/**
 * Computes active dates locally on the client to render skeleton layout instantly.
 */
function getLocalActiveDates(customDateStr) {
  let today = new Date();
  if (customDateStr) {
    const parts = customDateStr.split('-');
    today = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  today.setHours(0, 0, 0, 0);

  const realToday = new Date();
  realToday.setHours(0, 0, 0, 0);
  const isRealTodaySelected = (today.getTime() === realToday.getTime());

  const dayOfWeek = today.getDay();
  const dates = [];

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const makeDateObj = (date, label, type, isEditable) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    return {
      dateStr: `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`,
      isoDateStr: `${yyyy}-${mm}-${dd}`,
      viewTitle: label,
      viewType: type,
      isEditable: !!isEditable
    };
  };

  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    // Mon-Thu: Today + Tomorrow
    dates.push(makeDateObj(today, isRealTodaySelected ? "TODAY" : "SELECTED DATE", "FULL", true));
    const next = new Date(today);
    next.setDate(today.getDate() + 1);
    dates.push(makeDateObj(next, "NEXT WORKDAY", "FULL", false));
  } else if (dayOfWeek === 5) {
    // Fri: Today (Fri), Sat, Sun, Mon
    dates.push(makeDateObj(today, isRealTodaySelected ? "TODAY" : "SELECTED DATE", "FULL", true));
    const sat = new Date(today); sat.setDate(today.getDate() + 1);
    dates.push(makeDateObj(sat, "SATURDAY", "WEEKEND", false));
    const sun = new Date(today); sun.setDate(today.getDate() + 2);
    dates.push(makeDateObj(sun, "SUNDAY", "WEEKEND", false));
    const mon = new Date(today); mon.setDate(today.getDate() + 3);
    dates.push(makeDateObj(mon, "MONDAY", "FULL", false));
  } else if (dayOfWeek === 6) {
    // Sat: Sat, Sun, Mon
    dates.push(makeDateObj(today, isRealTodaySelected ? "SATURDAY" : "SELECTED DATE", "WEEKEND", true));
    const sun = new Date(today); sun.setDate(today.getDate() + 1);
    dates.push(makeDateObj(sun, "SUNDAY", "WEEKEND", false));
    const mon = new Date(today); mon.setDate(today.getDate() + 2);
    dates.push(makeDateObj(mon, "MONDAY", "FULL", false));
  } else if (dayOfWeek === 0) {
    // Sun: Sun, Mon
    dates.push(makeDateObj(today, isRealTodaySelected ? "SUNDAY" : "SELECTED DATE", "WEEKEND", true));
    const mon = new Date(today); mon.setDate(today.getDate() + 1);
    dates.push(makeDateObj(mon, "MONDAY", "FULL", false));
  }

  return dates;
}

