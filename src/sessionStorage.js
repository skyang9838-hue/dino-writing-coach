const SESSION_STORAGE_KEY = 'dino-writing-coach:session'

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // localStorage unavailable (e.g. private mode) — silently skip persistence
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // localStorage unavailable — nothing to clear
  }
}
