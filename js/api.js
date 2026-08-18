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
      const storedName = localStorage.getItem("tc_name") || "";
      const isLocum = localStorage.getItem("tc_is_locum") === "true";
      const storedRole = isLocum ? "Locum" : "Staff";
      await fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          name: storedName,
          role: storedRole
        })
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

function closePersonalShiftsModal() {
  const modal = document.getElementById("personal-shifts-modal");
  if (modal) modal.classList.remove("is-active");
}

async function openPersonalShiftsModal() {
  const modal = document.getElementById("personal-shifts-modal");
  if (!modal) return;
  modal.classList.add("is-active");

  const titleEl = document.getElementById("personal-shifts-modal-title");
  const bodyEl = document.getElementById("personal-shifts-modal-body");
  if (!bodyEl) return;

  const storedName = localStorage.getItem("tc_name");
  const storedPin = localStorage.getItem("tc_pin");

  // If NOT logged in: Render clean login form inside the modal
  if (!storedName || !storedPin) {
    if (titleEl) titleEl.innerText = "🔐 MY UPCOMING SHIFTS";
    bodyEl.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.4;">
          Select your name and enter your Portal PIN to view your personal schedule for this week and next week.
        </p>
      </div>
      <div class="field mb-3">
        <label class="label is-small">Select Name</label>
        <div class="control select is-fullwidth">
          <select id="modal-shift-name-select" style="background-color: #ffffff !important; color: #0f172a !important;">
            <option>Loading roster...</option>
          </select>
        </div>
      </div>
      <div class="field mb-4">
        <label class="label is-small">Portal PIN</label>
        <div class="control">
          <input class="input" type="password" id="modal-shift-pin-input" placeholder="Enter PIN" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password">
        </div>
      </div>
      <button class="button is-link is-fullwidth" id="modal-shift-login-btn" onclick="submitModalShiftLogin()" style="font-weight: 700; height: 40px; border-radius: 8px;">
        🔑 View My Shifts
      </button>
      <p id="modal-shift-login-error" class="has-text-danger is-size-7 mt-2" style="display:none;"></p>
    `;

    try {
      const empList = await callApi("getEmployeeNames");
      const sel = document.getElementById("modal-shift-name-select");
      if (sel) {
        sel.innerHTML = empList.map(e => {
          const nameStr = e.name || e;
          return `<option value="${nameStr}">${nameStr}</option>`;
        }).join('');
      }
    } catch (e) {
      console.error("Failed to load roster in modal:", e);
    }
    return;
  }

  // If LOGGED IN: Fetch shifts & render modal content
  if (titleEl) titleEl.innerText = `📅 MY SHIFTS: ${storedName.toUpperCase()}`;
  bodyEl.innerHTML = `
    <div style="text-align: center; padding: 24px 0;">
      <button class="button is-loading is-white is-large"></button>
      <p style="margin-top: 12px; font-size: 0.9rem; color: var(--text-muted);">Fetching your shifts...</p>
    </div>
  `;

  try {
    const result = await callApi("getEmployeeSchedule", { name: storedName, pin: storedPin });
    if (!result || !result.schedule || result.schedule.length === 0) {
      bodyEl.innerHTML = `
        <p style="font-style: italic; color: var(--text-muted); text-align: center; padding: 20px 0;">No upcoming shifts found in schedule.</p>
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 14px;">
          <button class="button is-small is-light" onclick="logoutFromShiftsModal()">Switch User</button>
          <button class="button is-small is-link" onclick="window.location.href='portal.html'">Full Portal →</button>
        </div>
      `;
      return;
    }

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

    // Group shifts by date
    const groupedCurrentWeek = {};
    const groupedNextWeek = {};

    result.schedule.forEach(item => {
      const shiftDate = item.sortDate ? new Date(item.sortDate) : null;
      if (!shiftDate) return;

      const dateKey = item.dateStr || shiftDate.toISOString().split('T')[0];
      const entryObj = {
        dateStr: item.dateStr,
        dayName: item.dayName,
        sortDate: item.sortDate,
        assignment: item.assignment
      };

      if (shiftDate >= todayMonday && shiftDate < nextMonday) {
        if (!groupedCurrentWeek[dateKey]) {
          groupedCurrentWeek[dateKey] = { dateStr: item.dateStr, dayName: item.dayName, assignments: [] };
        }
        groupedCurrentWeek[dateKey].assignments.push(item.assignment);
      } else if (shiftDate >= nextMonday && shiftDate < endOfNextWeek) {
        if (!groupedNextWeek[dateKey]) {
          groupedNextWeek[dateKey] = { dateStr: item.dateStr, dayName: item.dayName, assignments: [] };
        }
        groupedNextWeek[dateKey].assignments.push(item.assignment);
      }
    });

    const renderWeekSection = (title, groupedData) => {
      const keys = Object.keys(groupedData);
      let secHtml = `
        <div style="margin-bottom: 18px;">
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--accent-indigo); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">
            ${title}
          </div>
      `;

      if (keys.length === 0) {
        secHtml += `<p style="font-size: 0.82rem; color: var(--text-muted); font-style: italic; padding: 4px 0;">No shifts scheduled.</p></div>`;
        return secHtml;
      }

      keys.forEach(key => {
        const dayItem = groupedData[key];
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

        secHtml += `
          <div class="shift-day-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(226,232,240,0.4);">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">${dayItem.dayName}</span>
              <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">${dayItem.dateStr}</span>
            </div>
            <div class="shift-badges-wrap" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end;">
              ${badgesHtml}
            </div>
          </div>
        `;
      });

      secHtml += `</div>`;
      return secHtml;
    };

    let modalContentHtml = '<div style="display: flex; flex-direction: column;">';
    modalContentHtml += renderWeekSection("🗓️ This Week", groupedCurrentWeek);
    modalContentHtml += renderWeekSection("🗓️ Next Week", groupedNextWeek);
    modalContentHtml += `
      <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color);">
        <button class="button is-small is-light" onclick="logoutFromShiftsModal()" style="font-weight: 600;">Switch User</button>
        <button class="button is-small is-link" onclick="window.location.href='portal.html'" style="font-weight: 700;">Full Portal →</button>
      </div>
    </div>`;

    bodyEl.innerHTML = modalContentHtml;
  } catch (err) {
    console.error("Error fetching shifts for modal:", err);
    bodyEl.innerHTML = `<p class="has-text-danger is-size-7" style="padding: 15px 0;">Error loading shifts: ${err.message || err}</p>`;
  }
}

async function submitModalShiftLogin() {
  const sel = document.getElementById("modal-shift-name-select");
  const pinInput = document.getElementById("modal-shift-pin-input");
  const errEl = document.getElementById("modal-shift-login-error");
  const btn = document.getElementById("modal-shift-login-btn");

  const name = sel ? sel.value : "";
  const pin = pinInput ? pinInput.value.trim() : "";

  if (!pin) {
    if (errEl) { errEl.innerText = "Please enter your PIN"; errEl.style.display = "block"; }
    return;
  }

  if (btn) btn.classList.add("is-loading");
  if (errEl) errEl.style.display = "none";

  try {
    await callApi("getEmployeeSchedule", { name, pin });
    localStorage.setItem("tc_name", name);
    localStorage.setItem("tc_pin", pin);
    if (btn) btn.classList.remove("is-loading");
    openPersonalShiftsModal();
  } catch (e) {
    if (btn) btn.classList.remove("is-loading");
    if (errEl) {
      errEl.innerText = e.message || "Invalid PIN. Please try again.";
      errEl.style.display = "block";
    }
  }
}

function logoutFromShiftsModal() {
  localStorage.removeItem("tc_name");
  localStorage.removeItem("tc_pin");
  openPersonalShiftsModal();
}

// --- Upfront App Login Gate & Session Management ---

async function checkAppGateAuth() {
  const gateEl = document.getElementById("app-login-gate");
  if (!gateEl) return true;

  const storedName = localStorage.getItem("tc_name");
  const storedPin = localStorage.getItem("tc_pin");
  const isGuest = sessionStorage.getItem("guest_mode") === "true";

  if (storedName && storedPin) {
    gateEl.style.display = "none";
    renderUserSessionBadge(storedName, false);
    return true;
  } else if (isGuest) {
    gateEl.style.display = "none";
    renderUserSessionBadge("Guest", true);
    return true;
  } else {
    showAppGateLogin();
    return false;
  }
}

function getStoredNotificationPrefs() {
  try {
    const raw = localStorage.getItem("notif_prefs");
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { schedule: true, shifts: true, giWorkups: true, obStandby: true };
}

function renderUserSessionBadge(displayName, isGuest) {
  const badgeContainer = document.getElementById("user-session-badge-container");
  if (!badgeContainer) return;

  if (isGuest) {
    badgeContainer.style.display = "flex";
    badgeContainer.style.gap = "6px";
    badgeContainer.style.alignItems = "center";
    badgeContainer.innerHTML = `
      <div class="tags has-addons mb-0" style="cursor: pointer;" onclick="showAppGateLogin()" title="Click to sign in with your PIN">
        <span class="tag is-warning is-light" style="font-weight: 700; font-size: 0.78rem;">👤 Guest View</span>
        <span class="tag is-info" style="font-weight: 600; font-size: 0.78rem;">Sign In</span>
      </div>
      <button class="button is-small is-dark" style="height: 24px; padding: 0 8px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #94a3b8; font-size: 0.8rem;" onclick="openPortalSettingsModal()" title="Settings & Notifications">
        ⚙️
      </button>`;
  } else if (displayName) {
    const firstName = displayName.split(" ")[0].split("(")[0].trim();
    badgeContainer.style.display = "flex";
    badgeContainer.style.gap = "6px";
    badgeContainer.style.alignItems = "center";
    badgeContainer.innerHTML = `
      <div class="tags has-addons mb-0" style="cursor: pointer;" onclick="promptUserSessionMenu('${displayName.replace(/'/g, "\\'")}')" title="Logged in as ${displayName}. Click to switch.">
        <span class="tag is-dark" style="font-weight: 700; font-size: 0.78rem; background: rgba(255,255,255,0.12); color: #fff;">👤 ${firstName}</span>
        <span class="tag is-dark" style="font-weight: 500; font-size: 0.78rem; background: rgba(255,255,255,0.06); color: var(--text-muted, #94a3b8);">Switch</span>
      </div>
      <button class="button is-small is-dark" style="height: 24px; padding: 0 8px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #94a3b8; font-size: 0.8rem;" onclick="openPortalSettingsModal()" title="Settings & Notification Preferences">
        ⚙️
      </button>`;
  } else {
    badgeContainer.style.display = "none";
  }
}

function openPortalSettingsModal() {
  let modal = document.getElementById("portal-settings-modal");
  if (!modal) {
    createPortalSettingsModalDom();
    modal = document.getElementById("portal-settings-modal");
  }
  populatePortalSettingsValues();
  modal.classList.add("is-active");
}

function closePortalSettingsModal() {
  const modal = document.getElementById("portal-settings-modal");
  if (modal) modal.classList.remove("is-active");
}

function createPortalSettingsModalDom() {
  const div = document.createElement("div");
  div.id = "portal-settings-modal";
  div.className = "modal";
  div.innerHTML = `
    <div class="modal-background" onclick="closePortalSettingsModal()"></div>
    <div class="modal-card" style="max-width: 440px; width: 92%; border-radius: 14px; overflow: hidden; background: var(--card-bg, #1e293b); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <header class="modal-card-head" style="background: var(--card-bg, #1e293b); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
        <p class="modal-card-title has-text-weight-bold" style="color: var(--text-main, #fff); font-size: 1.05rem; margin-bottom: 0;">⚙️ Portal Settings</p>
        <button class="delete" aria-label="close" onclick="closePortalSettingsModal()"></button>
      </header>
      <section class="modal-card-body" style="background: var(--card-bg, #1e293b); padding: 18px 20px; color: var(--text-main, #fff);">
        <!-- Account Info -->
        <div class="mb-4 pb-3" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
          <label class="label is-size-7 mb-1" style="color: var(--text-muted, #94a3b8); font-weight: 600;">ACTIVE SESSION</label>
          <div class="is-flex is-justify-content-between is-align-items-center">
            <span id="settings-user-name" style="font-weight: 700; font-size: 0.95rem; color: var(--text-main, #fff);">Guest</span>
            <button class="button is-small is-ghost" onclick="promptUserSessionMenu(localStorage.getItem('tc_name') || 'Guest'); closePortalSettingsModal();" style="color: #38bdf8; font-size: 0.8rem; font-weight: 600; text-decoration: none;">
              Switch Account
            </button>
          </div>
        </div>

        <!-- Push Notifications Header & Master Toggle -->
        <div class="mb-3">
          <div class="is-flex is-justify-content-between is-align-items-center mb-2">
            <div>
              <span style="font-weight: 700; font-size: 0.95rem;">🔔 Push Notifications</span>
              <p class="is-size-7" style="color: var(--text-muted, #94a3b8);">Receive live shift alerts on this device</p>
            </div>
            <input type="checkbox" id="settings-notifs-master" onchange="toggleMasterPush(this.checked)" style="transform: scale(1.3); cursor: pointer;">
          </div>
        </div>

        <!-- Granular Alert Categories -->
        <div id="settings-category-container" class="box p-3 mb-4" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;">
          <div class="is-flex is-justify-content-between is-align-items-center mb-3">
            <div>
              <div style="font-weight: 600; font-size: 0.85rem;">📄 Daily Schedule Releases</div>
              <div style="font-size: 0.72rem; color: var(--text-muted, #94a3b8);">When tomorrow's schedule is posted (~5:00 PM)</div>
            </div>
            <input type="checkbox" id="pref-schedule" style="transform: scale(1.2); cursor: pointer;">
          </div>

          <div class="is-flex is-justify-content-between is-align-items-center mb-3" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
            <div>
              <div style="font-weight: 600; font-size: 0.85rem;">⏰ Personal Shift Changes</div>
              <div style="font-size: 0.72rem; color: var(--text-muted, #94a3b8);">When your room or call assignment is updated</div>
            </div>
            <input type="checkbox" id="pref-shifts" style="transform: scale(1.2); cursor: pointer;">
          </div>

          <div class="is-flex is-justify-content-between is-align-items-center mb-3" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
            <div>
              <div style="font-weight: 600; font-size: 0.85rem;">💩 GI Workup Activity</div>
              <div style="font-size: 0.72rem; color: var(--text-muted, #94a3b8);">When GI Workups are Started or Completed</div>
            </div>
            <input type="checkbox" id="pref-giWorkups" style="transform: scale(1.2); cursor: pointer;">
          </div>

          <div class="is-flex is-justify-content-between is-align-items-center" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
            <div>
              <div style="font-weight: 600; font-size: 0.85rem;">👶 OB & Standby Calls</div>
              <div style="font-size: 0.72rem; color: var(--text-muted, #94a3b8);">When OB Tracker or Standby is activated</div>
            </div>
            <input type="checkbox" id="pref-obStandby" style="transform: scale(1.2); cursor: pointer;">
          </div>
        </div>

        <!-- Test Notification Button -->
        <button class="button is-small is-fullwidth mb-3" id="btn-settings-test-push" onclick="sendSettingsTestPush()" style="height: 34px; border-radius: 8px; font-weight: 600; font-size: 0.8rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: var(--text-main, #fff);">
          🔔 Send Test Alert to this Device
        </button>
      </section>
      <footer class="modal-card-foot" style="background: var(--card-bg, #1e293b); border-top: 1px solid rgba(255,255,255,0.08); padding: 12px 20px; justify-content: flex-end; gap: 8px;">
        <button class="button is-small is-light" onclick="closePortalSettingsModal()" style="font-weight: 600; border-radius: 6px;">Cancel</button>
        <button class="button is-small is-link" id="btn-save-settings" onclick="savePortalSettingsModal()" style="font-weight: 700; border-radius: 6px; background: linear-gradient(135deg, #3b82f6, #1d4ed8);">Save Settings</button>
      </footer>
    </div>`;
  document.body.appendChild(div);
}

function populatePortalSettingsValues() {
  const userName = localStorage.getItem("tc_name") || "Guest (Read-Only)";
  const userEl = document.getElementById("settings-user-name");
  if (userEl) userEl.innerText = userName;

  const hasPermission = ('Notification' in window) && Notification.permission === 'granted';
  const masterToggle = document.getElementById("settings-notifs-master");
  const catContainer = document.getElementById("settings-category-container");

  if (masterToggle) masterToggle.checked = hasPermission;
  if (catContainer) catContainer.style.opacity = hasPermission ? "1" : "0.45";

  const prefs = getStoredNotificationPrefs();
  const keys = ['schedule', 'shifts', 'giWorkups', 'obStandby'];
  keys.forEach(k => {
    const el = document.getElementById(`pref-${k}`);
    if (el) {
      el.checked = prefs[k] !== false;
      el.disabled = !hasPermission;
    }
  });
}

async function toggleMasterPush(enable) {
  if (enable) {
    try {
      if (!('Notification' in window)) {
        alert("Push notifications are not supported on this browser.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await ensureValidPushSubscription();
        if (typeof showToast === "function") showToast("🔔 Notifications enabled on this device!", "success");
      } else {
        if (typeof showToast === "function") showToast("Permission denied in site settings.", "danger");
      }
    } catch(e) {
      console.error(e);
    }
  } else {
    await unsubscribeNotifications();
  }
  populatePortalSettingsValues();
}

async function savePortalSettingsModal() {
  const btn = document.getElementById("btn-save-settings");
  if (btn) btn.classList.add("is-loading");

  const prefs = {
    schedule: document.getElementById("pref-schedule") ? document.getElementById("pref-schedule").checked : true,
    shifts: document.getElementById("pref-shifts") ? document.getElementById("pref-shifts").checked : true,
    giWorkups: document.getElementById("pref-giWorkups") ? document.getElementById("pref-giWorkups").checked : true,
    obStandby: document.getElementById("pref-obStandby") ? document.getElementById("pref-obStandby").checked : true
  };

  localStorage.setItem("notif_prefs", JSON.stringify(prefs));

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const storedName = localStorage.getItem("tc_name") || "";
      const isLocum = localStorage.getItem("tc_is_locum") === "true";
      const storedRole = isLocum ? "Locum" : "Staff";
      await fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/update-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub,
          name: storedName,
          role: storedRole,
          prefs: prefs
        })
      });
    }
  } catch (e) {
    console.error("Error saving prefs to Cloudflare:", e);
  }

  if (btn) btn.classList.remove("is-loading");
  closePortalSettingsModal();
  if (typeof showToast === "function") showToast("Notification preferences saved! ⚙️", "success");
}

async function sendSettingsTestPush() {
  const btn = document.getElementById("btn-settings-test-push");
  if (btn) btn.classList.add("is-loading");
  const name = localStorage.getItem("tc_name") || "Scott";
  try {
    await ensureValidPushSubscription();
    const res = await fetch(`https://anesthesia-api-relay.scott-roberts-crna.workers.dev/test-push?target=${encodeURIComponent(name)}`, { method: "POST" });
    const data = await res.json();
    if (data.pushResult && data.pushResult.sent > 0) {
      if (typeof showToast === "function") showToast("🔔 Test alert fired to " + data.pushResult.sent + " device(s)!", "success");
    } else {
      await fetch("https://anesthesia-api-relay.scott-roberts-crna.workers.dev/test-push", { method: "POST" });
      if (typeof showToast === "function") showToast("🔔 Test alert fired!", "info");
    }
  } catch (e) {
    if (typeof showToast === "function") showToast("Test alert error: " + e.message, "danger");
  } finally {
    if (btn) btn.classList.remove("is-loading");
  }
}

function isMdPortal() {
  return window.location.pathname.includes("timekeeper") || document.title.includes("MD Portal");
}

async function showAppGateLogin() {
  const gateEl = document.getElementById("app-login-gate");
  if (!gateEl) return;
  gateEl.style.display = "flex";

  const sel = document.getElementById("gate-name-select");
  if (sel && sel.options.length <= 1) {
    try {
      const endpoint = isMdPortal() ? "getPhysicianNames" : "getEmployeeNames";
      const items = await callApi(endpoint, { skipPinCheck: false });
      if (items && Array.isArray(items)) {
        sel.innerHTML = items.map(item =>
          `<option value="${item.name}" data-haspin="${item.hasPin}">${item.name}</option>`
        ).join("");
        updateGatePinPlaceholder();
      }
    } catch (e) {
      console.error("Failed to load roster for gate login:", e);
    }
  }
}

function updateGatePinPlaceholder() {
  const sel = document.getElementById("gate-name-select");
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  const hasPin = opt.getAttribute("data-haspin") === "true";
  const pinInput = document.getElementById("gate-pin-input");
  const pinLabel = document.getElementById("gate-pin-label");

  if (pinLabel) {
    pinLabel.innerText = hasPin ? "Enter PIN" : "First-Time Setup: Choose 4-Digit PIN";
  }
  if (pinInput) {
    pinInput.placeholder = hasPin ? "Enter existing PIN" : "Choose a 4-digit PIN";
  }
}

async function submitGateLogin() {
  const sel = document.getElementById("gate-name-select");
  const pinInput = document.getElementById("gate-pin-input");
  const btn = document.getElementById("gate-login-btn");
  const err = document.getElementById("gate-login-error");

  const name = sel ? sel.value : "";
  const pin = pinInput ? pinInput.value.trim() : "";

  if (!name || name === "Loading roster...") {
    if (err) { err.innerText = "Please select your name."; err.style.display = "block"; }
    return;
  }
  if (!pin) {
    if (err) { err.innerText = "Please enter your 4-digit PIN."; err.style.display = "block"; }
    return;
  }

  if (btn) btn.classList.add("is-loading");
  if (err) err.style.display = "none";

  try {
    const loginEndpoint = isMdPortal() ? "physicianLogin" : "timecardLogin";
    const res = await callApi(loginEndpoint, { name, pin });
    if (res && res.success) {
      localStorage.setItem("tc_name", name);
      localStorage.setItem("tc_pin", pin);
      if (res.role) localStorage.setItem("tc_role", res.role);
      sessionStorage.removeItem("guest_mode");

      const gateEl = document.getElementById("app-login-gate");
      if (gateEl) gateEl.style.display = "none";

      renderUserSessionBadge(name, false);
      if (btn) btn.classList.remove("is-loading");

      // Register / update push notifications in background with identity
      if (('Notification' in window) && Notification.permission === 'granted' && localStorage.getItem("schedule_notifs_enabled") === "true") {
        ensureValidPushSubscription();
      }

      if (typeof showToast === "function") {
        showToast("Signed in as " + name, "success");
      }
    } else {
      throw new Error((res && res.error) || "Invalid PIN. Please try again.");
    }
  } catch (e) {
    if (btn) btn.classList.remove("is-loading");
    if (err) {
      err.innerText = e.message || "Failed to sign in. Please verify your PIN.";
      err.style.display = "block";
    }
  }
}

function enterGuestMode() {
  sessionStorage.setItem("guest_mode", "true");
  const gateEl = document.getElementById("app-login-gate");
  if (gateEl) gateEl.style.display = "none";
  renderUserSessionBadge("Guest", true);
  if (typeof showToast === "function") {
    showToast("Guest view active (read-only)", "info");
  }
}

function promptUserSessionMenu(currentName) {
  const confirmLogout = confirm(`You are signed in as ${currentName}.\n\nClick OK to switch accounts or log out.`);
  if (confirmLogout) {
    localStorage.removeItem("tc_name");
    localStorage.removeItem("tc_pin");
    localStorage.removeItem("tc_sheet_id");
    localStorage.removeItem("tc_is_locum");
    sessionStorage.removeItem("guest_mode");
    showAppGateLogin();
  }
}

// Auto-run version detection, notification sync, gate auth, and schedule badge on DOM load, pageshow, and focus
const initPageHelpers = async () => {
  checkAppGateAuth();
  checkLatestScheduleBadge();
  syncNotificationButtonState();
  if (('Notification' in window) && Notification.permission === 'granted') {
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
