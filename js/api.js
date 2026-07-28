/**
 * Shared API Client for Google Apps Script Web App
 */
async function callApi(action, params = {}) {
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      mode: "cors",
      keepalive: true, // Prevents iOS Safari from canceling background fetch on lock/app switch
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
  if (type === 'success') {
    toast.style.backgroundColor = '#10b981';
  } else if (type === 'warning') {
    toast.style.backgroundColor = '#f59e0b';
  } else {
    toast.style.backgroundColor = '#ef4444';
  }
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

// --- Shared Version Detection & Portal Link Sharing ---
let detectedAppVersion = "v165";

/**
 * Shares or copies portal URL to clipboard
 */
function sharePortalLink() {
  const shareUrl = window.location.origin + window.location.pathname;
  const shareData = {
    title: 'LAPA CRNA Portal',
    text: 'Access the LAPA Schedule, Timecard, Requests, and Preferences portal:',
    url: shareUrl
  };

  if (navigator.share) {
    navigator.share(shareData)
      .catch(err => console.log('Error sharing:', err));
  } else {
    try {
      navigator.clipboard.writeText(shareUrl);
      showToast("Portal link copied to clipboard!", "success");
    } catch (err) {
      const tempInput = document.createElement("input");
      tempInput.value = shareUrl;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      showToast("Portal link copied to clipboard!", "success");
    }
  }
}

/**
 * Auto-detects the active version from sw.js and updates version display elements
 */
async function autoDetectAppVersion() {
  try {
    const res = await fetch('./sw.js', { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/CACHE_NAME\s*=\s*['"]lawrence-anaesthesia-(v\d+)['"]/);
      if (match && match[1]) {
        detectedAppVersion = match[1];
      }
    }
  } catch (e) {
    console.log("Auto-detect version from sw.js skipped:", e);
  }

  // Update all version display elements across the document
  document.querySelectorAll('#version-display, .version-display').forEach(el => {
    el.textContent = el.dataset.raw === "true" ? detectedAppVersion : `(${detectedAppVersion})`;
    el.style.userSelect = "none";
    el.style.webkitUserSelect = "none";
    
    // Attach long-press support if not already bound
    if (!el.dataset.boundShare) {
      el.dataset.boundShare = "true";
      let pressTimer = null;

      el.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          if (navigator.vibrate) navigator.vibrate(50);
          sharePortalLink();
        }, 500);
      }, { passive: true });

      el.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
      });

      el.addEventListener('touchmove', () => {
        clearTimeout(pressTimer);
      });
    }
  });
}

// Auto-run version detection on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoDetectAppVersion);
} else {
  autoDetectAppVersion();
}

// --- Push Notification & Schedule Badge Helpers ---
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function syncNotificationButtonState() {
  const isPermissionGranted = ('Notification' in window) && (Notification.permission === 'granted');
  const isLocalStorageEnabled = localStorage.getItem("schedule_notifs_enabled") === "true";
  
  let isSubscribed = false;
  if ('serviceWorker' in navigator && isPermissionGranted) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        isSubscribed = true;
      }
    } catch (e) {
      console.log("Error checking SW push subscription:", e);
    }
  }

  const isActive = isPermissionGranted && (isSubscribed || isLocalStorageEnabled);

  document.querySelectorAll('.notif-bell-btn, [onclick*="setupScheduleNotifications"]').forEach(btn => {
    if (isActive) {
      btn.classList.remove("is-light");
      btn.classList.add("is-success");
      btn.innerHTML = `🔔 Alerts Active`;
    } else {
      btn.classList.remove("is-success");
      btn.classList.add("is-light");
      btn.innerHTML = `🔔 Enable Alerts`;
    }
  });
}

async function setupScheduleNotifications(btnElement) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    showToast("Push notifications are not supported on this browser.", "warning");
    return;
  }

  const isAlreadyActive = (btnElement && btnElement.classList.contains("is-success")) || (localStorage.getItem("schedule_notifs_enabled") === "true" && Notification.permission === "granted");

  if (isAlreadyActive) {
    // User clicked button while alerts are active -> present prompt choices
    const choice = prompt(
      "Schedule alerts are currently ACTIVE on this device.\n\n" +
      "1. Send a Test Notification now\n" +
      "2. Turn OFF notifications\n\n" +
      "Enter 1 or 2 and tap OK (or Cancel to close):",
      "1"
    );

    if (choice === "1") {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg.showNotification) {
          reg.showNotification("📄 Test Schedule Alert", {
            body: "Test notification successful! Your device is receiving schedule alerts.",
            icon: "./snoozle.png",
            badge: "./snoozle_maskable.png",
            tag: "test-schedule-alert",
            renotify: true
          }).catch(e => console.log("Test notification trigger error:", e));
        }
        const sub = await reg.pushManager.getSubscription();
        fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/test-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub || {} })
        }).catch(() => {});
        showToast("Test notification sent to your device screen!", "success");
      } catch (err) {
        showToast("Error triggering test notification: " + err.message, "danger");
      }
      return;
    } else if (choice === "2") {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub })
          }).catch(e => console.log("Unsubscribe send error:", e));
        }
      } catch (err) {
        console.log("Unsubscribe error:", err);
      }
      localStorage.removeItem("schedule_notifs_enabled");
      syncNotificationButtonState();
      showToast("Schedule notifications turned OFF for this device.", "warning");
      return;
    }
    return;
  }

  // Enabling notifications
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast("Notification permission was denied in browser settings.", "danger");
      syncNotificationButtonState();
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const publicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDnA45dffZTJ56Zad_6A1P7N-v3g-c4K9B-1Z_2fN7A8";
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      } catch (subErr) {
        console.log("PushManager subscribe details:", subErr);
      }
    }

    if (subscription) {
      await fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription })
      }).catch(e => console.log("Cloudflare subscribe send error:", e));
    }

    localStorage.setItem("schedule_notifs_enabled", "true");
    syncNotificationButtonState();

    // Trigger an immediate local system notification banner so user sees it working live
    if (reg.showNotification) {
      reg.showNotification("📄 Schedule Alerts Active!", {
        body: "Push notifications are enabled for this device. You will receive alerts when a new schedule is posted.",
        icon: "./snoozle.png",
        badge: "./snoozle_maskable.png",
        tag: "schedule-alert-enabled",
        renotify: true
      }).catch(e => console.log("System notification trigger error:", e));
    }

    showToast("Schedule notifications enabled on this device! 🔔", "success");
  } catch (err) {
    console.error("Error setting up push notifications:", err);
    localStorage.setItem("schedule_notifs_enabled", "true");
    syncNotificationButtonState();
    showToast("Notifications enabled on device!", "success");
  }
}

async function checkLatestScheduleBadge() {
  try {
    const res = await fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/latest-schedule");
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.timestamp) {
        const lastViewed = parseInt(localStorage.getItem("last_viewed_schedule_ts") || "0", 10);
        if (data.timestamp > lastViewed) {
          const targetSelectors = '.schedule-btn, .pdf-schedule-btn, .schedule-badge-btn, #btn-open-requests, #btn-open-sheet-viewer';
          document.querySelectorAll(targetSelectors).forEach(btn => {
            if (!btn.querySelector('.new-badge')) {
              const badge = document.createElement('span');
              badge.className = 'new-badge';
              badge.style.cssText = 'background: #ef4444; color: white; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 10px; margin-left: 6px; display: inline-block; vertical-align: middle; box-shadow: 0 0 8px rgba(239, 68, 68, 0.7);';
              badge.textContent = 'NEW';
              btn.appendChild(badge);
            }
          });
        }
      }
    }
  } catch (e) {}
}

function markScheduleAsViewed() {
  localStorage.setItem("last_viewed_schedule_ts", Date.now().toString());
  document.querySelectorAll('.new-badge').forEach(el => el.remove());
}

// Auto-run version detection, notification sync, and schedule badge on DOM load, pageshow, and focus
const initPageHelpers = () => {
  checkLatestScheduleBadge();
  syncNotificationButtonState();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPageHelpers);
} else {
  initPageHelpers();
}

window.addEventListener('pageshow', initPageHelpers);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    initPageHelpers();
  }
});



