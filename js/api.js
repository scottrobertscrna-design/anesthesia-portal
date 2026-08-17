/**
 * Shared API Client for Google Apps Script Web App
 */
async function callApi(action, params = {}, retries = 2) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    attempt++;
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
        if ([404, 500, 502, 503, 504].includes(response.status) && attempt <= retries) {
          console.warn(`callApi (${action}) returned HTTP ${response.status}. Retrying attempt ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, attempt * 400));
          continue;
        }
        throw new Error(`HTTP network error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "An unknown API error occurred.");
      }

      return result.data;
    } catch (error) {
      lastError = error;
      if (attempt <= retries && (error.name === 'TypeError' || String(error.message).includes('HTTP network error'))) {
        console.warn(`callApi (${action}) fetch error: ${error.message}. Retrying attempt ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, attempt * 400));
      } else {
        console.error("API Call Failed (" + action + "):", error);
        throw error;
      }
    }
  }
  throw lastError || new Error("API request failed.");
}

// --- Shared Utility Helpers ---

// Safe querySelector wrapper to prevent unescaped selector strings from throwing DOMException
function safeQuerySelector(selector, container = document) {
  try {
    return container.querySelector(selector);
  } catch (e) {
    console.warn(`safeQuerySelector syntax error for "${selector}":`, e);
    return null;
  }
}

// Safe querySelectorAll wrapper to prevent unescaped selector strings from throwing DOMException
function safeQuerySelectorAll(selector, container = document) {
  try {
    return container.querySelectorAll(selector);
  } catch (e) {
    console.warn(`safeQuerySelectorAll syntax error for "${selector}":`, e);
    return [];
  }
}

// Helper: decode Base64 to a binary Uint8Array in-browser
function base64ToUint8Array(base64) {
  try {
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  } catch (e) {
    console.error("base64ToUint8Array decode failed:", e);
    return new Uint8Array(0);
  }
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
  try {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.error("urlBase64ToUint8Array decode error:", e);
    return new Uint8Array(0);
  }
}

/**
 * Clears temporary local state and reloads the portal to resolve persistent browser state errors.
 */
async function resetPortalAppStorage() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
  } catch (e) {
    console.warn("Storage reset cleanup note:", e);
  }
  localStorage.clear();
  sessionStorage.clear();
  window.location.reload(true);
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

function openNotificationManagerModal() {
  let modal = document.getElementById('notif-manager-modal');
  if (!modal) {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'notif-manager-modal';
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
      <div class="modal-background" onclick="closeNotificationManagerModal()"></div>
      <div class="modal-card" style="max-width: 420px; width: 92%; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);">
        <header class="modal-card-head" style="background: var(--card-bg); border-bottom: 1px solid var(--border-color); padding: 16px 20px;">
          <p class="modal-card-title has-text-weight-bold" style="font-size: 1.15rem; color: var(--text-main) !important;">🔔 Schedule Alerts</p>
          <button class="delete" aria-label="close" onclick="closeNotificationManagerModal()"></button>
        </header>
        <section class="modal-card-body" style="background: var(--bg-gradient); padding: 20px; border-bottom-left-radius: 14px; border-bottom-right-radius: 14px;">
          <p class="is-size-7 mb-4" style="color: var(--text-muted); line-height: 1.4;">
            Schedule notifications are currently <strong style="color: var(--accent-emerald);">ACTIVE</strong> on this device.
          </p>
          <div class="field mb-3">
            <button class="button is-link is-fullwidth" onclick="triggerTestNotification(false)" style="font-weight: 700; height: 38px;">
              ⚡ Send Instant Test Notification
            </button>
          </div>
          <div class="field mb-4">
            <button class="button is-info is-light is-fullwidth" onclick="triggerTestNotification(true)" style="font-weight: 600; height: 38px;">
              ⏱️ Test 5s Delay (Lock Screen)
            </button>
          </div>
          <div class="field mt-4" style="border-top: 1px solid var(--border-color); padding-top: 15px;">
            <button class="button is-danger is-light is-fullwidth" onclick="unsubscribeNotifications()" style="font-weight: 600; height: 36px;">
              🔕 Turn OFF Schedule Alerts
            </button>
          </div>
        </section>
      </div>
    `;
    document.body.appendChild(modalDiv);
    modal = modalDiv;
  }
  modal.classList.add('is-active');
}

function closeNotificationManagerModal() {
  const modal = document.getElementById('notif-manager-modal');
  if (modal) modal.classList.remove('is-active');
}

async function triggerTestNotification(isDelayed = false) {
  closeNotificationManagerModal();

  if (!('Notification' in window)) {
    alert("Notifications API is not supported on this browser.");
    return;
  }

  const currentPerm = Notification.permission;
  if (currentPerm !== 'granted') {
    alert("Notification permission state is currently: '" + currentPerm + "'.\n\nPlease check Android Settings -> Apps -> Chrome (or PWA) -> Notifications and turn ON notifications.");
    return;
  }

  const bodyMsg = isDelayed 
    ? 'Notification system active! Delivery confirmed to notification bar.'
    : 'Test notification successful! Your device is receiving schedule alerts.';

  const notifTitle = '📄 Test Schedule Alert';
  const notifOptions = {
    body: bodyMsg,
    icon: './snoozle.png',
    badge: './snoozle_badge.png',
    tag: 'schedule-alert-test',
    renotify: true,
    vibrate: [200, 100, 200]
  };

  if (isDelayed) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'scheduleDelayedNotification',
        delayMs: 5000,
        title: notifTitle,
        body: bodyMsg
      });
    }
    showToast("Lock phone or go to Home Screen NOW! Notification fires in 5s.", "warning");
    return;
  }

  let isDelivered = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.showNotification) {
      await reg.showNotification(notifTitle, notifOptions);
      isDelivered = true;
    }
  } catch (err) {
    console.error("reg.showNotification error:", err);
  }

  if (!isDelivered) {
    try {
      new Notification(notifTitle, notifOptions);
      isDelivered = true;
    } catch (err) {
      console.error("window.Notification error:", err);
    }
  }

  if (isDelivered) {
    showToast("Test notification sent to device!", "success");
  } else {
    alert("Could not display system notification on device.\n\nPlease verify Android Settings -> Apps -> Chrome -> Notifications is enabled.");
  }
}

async function unsubscribeNotifications() {
  closeNotificationManagerModal();
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
}

async function ensureValidPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    let publicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDnA45dffZTJ56Zad_6A1P7N-v3g-c4K9B-1Z_2fN7A8";
    try {
      const keyRes = await fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/push-public-key");
      if (keyRes.ok) {
        const keyData = await keyRes.json();
        if (keyData.success && keyData.publicKey) {
          publicKey = keyData.publicKey;
        }
      }
    } catch (e) {}

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await reg.pushManager.getSubscription();

    // Check for VAPID key mismatch if existing subscription exists
    if (subscription) {
      const existingKey = subscription.options && subscription.options.applicationServerKey;
      let keyMismatch = false;
      if (existingKey) {
        const existingKeyArray = new Uint8Array(existingKey);
        if (existingKeyArray.length !== applicationServerKey.length) {
          keyMismatch = true;
        } else {
          for (let i = 0; i < existingKeyArray.length; i++) {
            if (existingKeyArray[i] !== applicationServerKey[i]) {
              keyMismatch = true;
              break;
            }
          }
        }
      }
      if (keyMismatch) {
        console.log("VAPID key mismatch detected. Resubscribing with current server key...");
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }

    if (!subscription) {
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      } catch (subErr) {
        console.log("PushManager subscribe error:", subErr);
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
    return subscription;
  } catch (err) {
    console.error("Error ensuring push subscription:", err);
    return null;
  }
}

async function setupScheduleNotifications(btnElement) {
  const isAlreadyActive = (btnElement && btnElement.classList.contains("is-success")) || (localStorage.getItem("schedule_notifs_enabled") === "true" && Notification.permission === "granted");

  if (isAlreadyActive) {
    openNotificationManagerModal();
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

    await ensureValidPushSubscription();
    syncNotificationButtonState();

    // Trigger an immediate local system notification banner so user sees it working live
    triggerTestNotification(false);

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
        localStorage.setItem("latest_schedule_timestamp", data.timestamp.toString());
      }
    }
  } catch (e) {}
}

function markScheduleAsViewed() {
  localStorage.setItem("last_viewed_schedule_ts", Date.now().toString());
}

async function renderMobilePersonalShiftsCard() {
  const container = document.getElementById("mobile-shifts-container");
  if (!container) return;

  const storedName = localStorage.getItem("tc_name");
  const storedPin = localStorage.getItem("tc_pin");

  // If NOT logged in: Render callout card with direct link to PIN entry
  if (!storedName || !storedPin) {
    container.innerHTML = `
      <div class="mobile-shifts-card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
            📅 My Upcoming Shifts
          </h4>
          <span class="tag is-light is-size-7" style="font-weight: 700;">PIN Entry</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 14px;">
          Log in with your PIN to view your personal shift schedule for this week and next week, or subscribe to your calendar.
        </p>
        <button class="button is-link is-fullwidth is-small" onclick="window.location.href='portal.html'" style="font-weight: 700; height: 34px; border-radius: 8px;">
          🔑 Enter Portal PIN to View Shifts
        </button>
      </div>
    `;
    return;
  }

  // If LOGGED IN: Fetch shifts & group by date for Current Week & Next Week
  container.innerHTML = `
    <div class="mobile-shifts-card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0;">
          📅 MY SHIFTS (${storedName.toUpperCase()})
        </h4>
        <a href="portal.html" style="font-size: 0.75rem; font-weight: 700; color: var(--accent-blue);">Full Portal →</a>
      </div>
      <div id="mobile-shifts-body" style="font-size: 0.85rem; color: var(--text-muted);">
        <p>Loading your shifts...</p>
      </div>
    </div>
  `;

  try {
    const result = await callApi("getEmployeeSchedule", { name: storedName, pin: storedPin });
    const bodyEl = document.getElementById("mobile-shifts-body");
    if (!bodyEl) return;

    if (!result || !result.schedule || result.schedule.length === 0) {
      bodyEl.innerHTML = `<p style="font-style: italic; color: var(--text-muted); text-align: center; padding: 10px 0;">No upcoming shifts found.</p>`;
      return;
    }

    // Helper: calculate week start (Monday) for any date
    const getWeekMonday = (d) => {
      const dt = new Date(d);
      const day = dt.getDay();
      const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dt.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return monday;
    };

    const todayMonday = getWeekMonday(new Date());
    const nextMonday = new Date(todayMonday);
    nextMonday.setDate(todayMonday.getDate() + 7);
    const endOfNextWeek = new Date(nextMonday);
    endOfNextWeek.setDate(nextMonday.getDate() + 7);

    // Group shifts by date (supporting multiple shifts on the same day)
    const groupedByDate = {};
    result.schedule.forEach(item => {
      const shiftDate = item.sortDate ? new Date(item.sortDate) : null;
      if (!shiftDate) return;

      if (shiftDate >= todayMonday && shiftDate < endOfNextWeek) {
        const dateKey = item.dateStr || shiftDate.toISOString().split('T')[0];
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = {
            dateStr: item.dateStr,
            dayName: item.dayName,
            sortDate: item.sortDate,
            assignments: []
          };
        }
        groupedByDate[dateKey].assignments.push(item.assignment);
      }
    });

    const dateKeys = Object.keys(groupedByDate);
    if (dateKeys.length === 0) {
      bodyEl.innerHTML = `<p style="font-style: italic; color: var(--text-muted); text-align: center; padding: 10px 0;">No shifts scheduled for this week or next week.</p>`;
      return;
    }

    // Render grouped shifts
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    dateKeys.forEach(key => {
      const dayItem = groupedByDate[key];
      const badgesHtml = dayItem.assignments.map(assign => {
        const cleanAssign = String(assign).trim().toUpperCase();
        let badgeClass = "shift-badge-blue-main";
        let icon = "🏥";

        if (cleanAssign.includes("BACKUP") || cleanAssign.includes("CALL")) {
          badgeClass = "shift-badge-purple-backup";
          icon = "📟";
        } else if (cleanAssign.includes("LSC")) {
          badgeClass = "shift-badge-emerald-lsc";
          icon = "🏥";
        } else if (["OFF", "VACATION", "VAC", "STANDBY", "CWR", "AT HOME"].includes(cleanAssign)) {
          badgeClass = "shift-badge-amber-off";
          icon = "🌴";
        }

        return `<span class="shift-pill ${badgeClass}">${icon} ${assign}</span>`;
      }).join('');

      html += `
        <div class="shift-day-row">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">${dayItem.dayName}</span>
            <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">${dayItem.dateStr}</span>
          </div>
          <div class="shift-badges-wrap">
            ${badgesHtml}
          </div>
        </div>
      `;
    });
    html += '</div>';

    bodyEl.innerHTML = html;
  } catch (err) {
    console.error("renderMobilePersonalShiftsCard error:", err);
  }
}

// Auto-run version detection, notification sync, schedule badge, and mobile shift card on DOM load, pageshow, and focus
const initPageHelpers = async () => {
  checkLatestScheduleBadge();
  syncNotificationButtonState();
  renderMobilePersonalShiftsCard();
  if (('Notification' in window) && Notification.permission === 'granted' && localStorage.getItem("schedule_notifs_enabled") === "true") {
    await ensureValidPushSubscription();
    syncNotificationButtonState();
  }
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
