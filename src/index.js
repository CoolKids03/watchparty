
import { DurableObject } from "cloudflare:workers";

const DEFAULT_STATE = {
  playing: false,
  position: 0,
  updatedAt: Date.now(),
  revision: 0,
  updatedBy: ""
};

const PAGE = String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101522">
<title>Local Video Watch Party</title>
<style>
:root {
  color-scheme: dark;
  --bg: #101522;
  --panel: #192131;
  --panel2: #222d40;
  --text: #f4f7fb;
  --muted: #aab6c8;
  --accent: #7c9cff;
  --green: #6ee7ad;
  --red: #ff8585;
  --border: #344057;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
main { width: min(920px, 100%); margin: auto; padding: 18px 14px 34px; }
header { margin-bottom: 18px; }
h1 { font-size: clamp(23px, 5vw, 32px); margin: 0 0 7px; }
.subtitle { color: var(--muted); line-height: 1.5; font-size: 14px; }
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 15px;
  margin-bottom: 14px;
}
h2 { font-size: 17px; margin: 0 0 12px; }
button, .file-button {
  border: 0;
  border-radius: 10px;
  background: var(--accent);
  color: #101522;
  padding: 11px 14px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 43px;
}
button.secondary, .file-button.secondary {
  background: var(--panel2);
  color: var(--text);
  border: 1px solid var(--border);
}
button:disabled { opacity: .45; cursor: not-allowed; }
input[type=file] { display: none; }
.file-button { width: 100%; }
#videoName { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; margin-top: 10px; }
#video {
  display: block;
  width: 100%;
  max-height: 68vh;
  background: #000;
  border-radius: 12px;
  aspect-ratio: 16 / 9;
}
.video-wrap { position: relative; }
#emptyOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 22px;
  color: #c5ccda;
  background: #05070b;
  border-radius: 12px;
  pointer-events: none;
}
#emptyOverlay.hidden { display: none; }
.status-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.status {
  background: var(--panel2);
  padding: 10px 12px;
  border-radius: 10px;
  min-width: 0;
}
.status-label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.status-value { font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
.green { color: var(--green); }
.red { color: var(--red); }
.controls { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 12px; }
.controls button { flex: 1; min-width: 90px; }
.seek-row { display: flex; gap: 10px; align-items: center; margin-top: 15px; }
#seek { flex: 1; width: 100%; accent-color: var(--accent); }
.time { font-size: 12px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
#message { font-size: 13px; line-height: 1.5; color: var(--muted); margin-top: 10px; }
.warning { color: #ffd18a !important; }
.small { color: var(--muted); font-size: 12px; line-height: 1.5; }
@media (max-width: 480px) {
  main { padding: 14px 10px 25px; }
  .panel { padding: 12px; border-radius: 13px; }
  .status-list { grid-template-columns: 1fr 1fr; }
  .controls { gap: 7px; }
  .controls button { padding: 10px 7px; min-width: 75px; }
}
</style>
</head>
<body>
<main>
  <header>
    <h1>Local Video Watch Party</h1>
    <div class="subtitle">Tonton bersama dari jarak jauh menggunakan video yang tersimpan di perangkat masing-masing.</div>
  </header>

  <section class="panel">
    <h2>1. Pilih video di perangkatmu</h2>
    <label class="file-button" for="filePicker">📁 Pilih video lokal</label>
    <input id="filePicker" type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.ogv,.mkv">
    <div id="videoName">Belum ada video yang dipilih.</div>
    <p class="small">Video tidak diunggah. File hanya dibaca oleh browser di perangkatmu. Dukungan format bergantung pada browser dan perangkat.</p>
  </section>

  <section class="panel">
    <h2>2. Pemutar video</h2>
    <div class="video-wrap">
      <video id="video" controls playsinline preload="metadata"></video>
      <div id="emptyOverlay">Pilih video lokal untuk mulai menonton.</div>
    </div>
    <div class="seek-row">
      <span id="currentTime" class="time">00:00</span>
      <input id="seek" type="range" min="0" max="1000" value="0" step="1" disabled aria-label="Posisi video">
      <span id="duration" class="time">00:00</span>
    </div>
    <div class="controls">
      <button id="playBtn" disabled>▶ Putar</button>
      <button id="pauseBtn" class="secondary" disabled>Ⅱ Jeda</button>
      <button id="syncBtn" class="secondary" disabled>↻ Sinkronkan</button>
    </div>
    <div id="message">Menghubungkan ke room...</div>
  </section>

  <section class="panel">
    <h2>3. Status room bersama</h2>
    <div class="status-list">
      <div class="status">
        <div class="status-label">Koneksi server</div>
        <div id="connectionStatus" class="status-value">Menghubungkan...</div>
      </div>
      <div class="status">
        <div class="status-label">Status pemutaran bersama</div>
        <div id="playStatus" class="status-value">Dijeda</div>
      </div>
      <div class="status">
        <div class="status-label">Durasi video lokal</div>
        <div id="localDuration" class="status-value">Belum tersedia</div>
      </div>
      <div class="status">
        <div class="status-label">Pembaruan terakhir</div>
        <div id="revisionStatus" class="status-value">Menunggu server</div>
      </div>
    </div>
    <p id="durationWarning" class="small"></p>
  </section>

  <section class="panel">
    <h2>Petunjuk</h2>
    <ul class="small">
      <li>Kedua peserta membuka alamat website yang sama.</li>
      <li>Masing-masing memilih video dari perangkat sendiri.</li>
      <li>Gunakan tombol video atau kontrol bawaan untuk Play, Pause, dan Seek.</li>
      <li>Perubahan pemutaran dari siapa pun akan dikirim ke peserta lain.</li>
      <li>Jika video lokal berbeda durasi, posisi waktu yang sama tidak selalu berarti adegan yang sama.</li>
    </ul>
  </section>
</main>

<script>
(() => {
  const video = document.getElementById("video");
  const picker = document.getElementById("filePicker");
  const videoName = document.getElementById("videoName");
  const overlay = document.getElementById("emptyOverlay");
  const seek = document.getElementById("seek");
  const currentTime = document.getElementById("currentTime");
  const duration = document.getElementById("duration");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const syncBtn = document.getElementById("syncBtn");
  const message = document.getElementById("message");
  const connectionStatus = document.getElementById("connectionStatus");
  const playStatus = document.getElementById("playStatus");
  const localDuration = document.getElementById("localDuration");
  const revisionStatus = document.getElementById("revisionStatus");
  const durationWarning = document.getElementById("durationWarning");

  let socket = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  let localUrl = null;
  let hasVideo = false;
  let metadataReady = false;
  let applyingRemote = false;
  let draggingSeek = false;
  let lastRevision = -1;
  let roomState = {
    playing: false,
    position: 0,
    updatedAt: Date.now(),
    revision: 0,
    updatedBy: ""
  };
  let lastSentActionAt = 0;
  let localDurationValue = 0;
  let syncTimer = null;
  let ignoreEventsUntil = 0;

  function setMessage(text, warning = false) {
    message.textContent = text;
    message.classList.toggle("warning", warning);
  }

  function formatTime(value) {
    if (!Number.isFinite(value) || value < 0) value = 0;
    value = Math.floor(value);
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    if (h > 0) return String(h).padStart(2, "0") + ":" +
      String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function expectedPosition(state = roomState) {
    let pos = Number(state.position) || 0;
    if (state.playing) {
      pos += Math.max(0, (Date.now() - Number(state.updatedAt || Date.now())) / 1000);
    }
    if (metadataReady && Number.isFinite(video.duration)) {
      pos = Math.min(pos, video.duration);
    }
    return Math.max(0, pos);
  }

  function send(data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setMessage("Koneksi server belum tersedia. Perintah akan aktif setelah tersambung.", true);
      return false;
    }
    socket.send(JSON.stringify(data));
    return true;
  }

  function updateConnection() {
    const connected = socket && socket.readyState === WebSocket.OPEN;
    connectionStatus.textContent = connected ? "Terhubung" : "Terputus";
    connectionStatus.className = "status-value " + (connected ? "green" : "red");
  }

  function updateUI() {
    const t = Number(video.currentTime) || 0;
    currentTime.textContent = formatTime(t);
    duration.textContent = formatTime(video.duration);
    localDuration.textContent = metadataReady ? formatTime(video.duration) : "Belum tersedia";
    playStatus.textContent = roomState.playing ? "Sedang diputar" : "Dijeda";
    playStatus.className = "status-value " + (roomState.playing ? "green" : "");
    revisionStatus.textContent = roomState.revision + (roomState.updatedBy ? " · diperbarui" : "");
    if (metadataReady && Number.isFinite(video.duration) && video.duration > 0) {
      if (!draggingSeek) seek.value = String(Math.round((t / video.duration) * 1000));
      seek.disabled = false;
    } else {
      seek.disabled = true;
    }
    playBtn.disabled = !metadataReady;
    pauseBtn.disabled = !metadataReady;
    syncBtn.disabled = !metadataReady;
    durationWarning.textContent = "";
    durationWarning.classList.remove("warning");
  }

  function showDurationDifference(state) {
    if (!metadataReady || !Number.isFinite(state.duration) || state.duration <= 0) {
      durationWarning.textContent = "Pilih video di kedua perangkat. Server tidak menerima atau menyimpan file video.";
      return;
    }
    const diff = Math.abs(video.duration - state.duration);
    if (diff > 1) {
      durationWarning.textContent = "Perhatian: durasi video perangkatmu (" + formatTime(video.duration) +
        ") berbeda dari durasi peserta lain (" + formatTime(state.duration) +
        "). Sinkronisasi berdasarkan detik; adegan mungkin berbeda.";
      durationWarning.classList.add("warning");
    } else {
      durationWarning.textContent = "Durasi yang dilaporkan peserta lain hampir sama dengan video lokalmu.";
    }
  }

  function clampPosition(pos) {
    pos = Math.max(0, Number(pos) || 0);
    if (metadataReady && Number.isFinite(video.duration)) pos = Math.min(pos, video.duration);
    return pos;
  }

  async function applyRoomState(state, force = false) {
    if (!state || typeof state !== "object") return;
    if (!force && Number(state.revision) < lastRevision) return;
    lastRevision = Math.max(lastRevision, Number(state.revision) || 0);
    roomState = {
      ...roomState,
      ...state,
      position: Math.max(0, Number(state.position) || 0),
      updatedAt: Number(state.updatedAt) || Date.now(),
      playing: Boolean(state.playing)
    };
    showDurationDifference(state);
    updateUI();

    if (!metadataReady || !hasVideo) {
      setMessage("Terhubung. Pilih video lokal untuk mengikuti pemutaran bersama.");
      return;
    }

    const target = clampPosition(expectedPosition(roomState));
    const difference = Math.abs((Number(video.currentTime) || 0) - target);
    applyingRemote = true;
    ignoreEventsUntil = Date.now() + 900;

    try {
      if (force || difference > 1.25) {
        try { video.currentTime = target; } catch (_) {}
      }

      if (roomState.playing) {
        if (video.paused) {
          try {
            await video.play();
            setMessage("Pemutaran mengikuti room bersama.");
          } catch (_) {
            setMessage("Tekan Putar di perangkat ini untuk mengizinkan browser memutar video. Status room tetap tersimpan.", true);
          }
        }
      } else if (!video.paused) {
        video.pause();
      }
    } finally {
      setTimeout(() => { applyingRemote = false; }, 250);
    }
    updateUI();
  }

  function sendAction(action, extra = {}) {
    if (!metadataReady || !hasVideo) {
      setMessage("Pilih video dan tunggu sampai siap terlebih dahulu.", true);
      return;
    }
    const position = clampPosition(video.currentTime);
    const sent = send({
      type: "control",
      action,
      position,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      ...extra
    });
    if (sent) {
      lastSentActionAt = Date.now();
      setMessage("Perintah " + action + " dikirim ke room.");
    }
  }

  function connect() {
    clearTimeout(reconnectTimer);
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(protocol + "//" + location.host + "/ws");
    updateConnection();

    socket.addEventListener("open", () => {
      reconnectDelay = 1000;
      updateConnection();
      setMessage("Terhubung ke room bersama.");
      send({
        type: "hello",
        duration: metadataReady && Number.isFinite(video.duration) ? video.duration : null,
        hasVideo
      });
    });

    socket.addEventListener("message", async (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      if (data.type === "state") {
        if (data.state) {
          await applyRoomState(data.state);
        }
      } else if (data.type === "peerInfo") {
        if (data.duration) showDurationDifference(data);
      } else if (data.type === "info") {
        if (data.message) setMessage(data.message);
      } else if (data.type === "error") {
        setMessage(data.message || "Terjadi kesalahan.", true);
      }
    });

    socket.addEventListener("close", () => {
      updateConnection();
      setMessage("Koneksi terputus. Mencoba menghubungkan kembali...", true);
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.7, 12000);
    });

    socket.addEventListener("error", () => {
      updateConnection();
      try { socket.close(); } catch (_) {}
    });
  }

  picker.addEventListener("change", () => {
    const file = picker.files && picker.files[0];
    if (!file) return;

    if (localUrl) URL.revokeObjectURL(localUrl);
    localUrl = URL.createObjectURL(file);
    hasVideo = true;
    metadataReady = false;
    localDurationValue = 0;
    videoName.textContent = file.name + " · " + (file.size / (1024 * 1024)).toFixed(1) + " MB";
    overlay.classList.add("hidden");
    video.src = localUrl;
    video.load();
    seek.disabled = true;
    setMessage("Memuat metadata video...");
  });

  video.addEventListener("loadedmetadata", async () => {
    metadataReady = true;
    localDurationValue = video.duration;
    updateUI();
    showDurationDifference(roomState);
    send({
      type: "hello",
      duration: Number.isFinite(video.duration) ? video.duration : null,
      hasVideo: true
    });
    await applyRoomState(roomState, true);
  });

  video.addEventListener("error", () => {
    if (!hasVideo) return;
    const code = video.error ? video.error.code : 0;
    const details = {
      1: "pemuatan dibatalkan",
      2: "kesalahan membaca file",
      3: "format atau codec tidak dapat didekode",
      4: "format video tidak didukung browser"
    };
    setMessage("Video gagal diputar: " + (details[code] || "format tidak didukung."), true);
  });

  video.addEventListener("play", () => {
    if (applyingRemote || Date.now() < ignoreEventsUntil) return;
    sendAction("play");
  });

  video.addEventListener("pause", () => {
    if (applyingRemote || Date.now() < ignoreEventsUntil || video.ended) return;
    sendAction("pause");
  });

  video.addEventListener("seeked", () => {
    if (applyingRemote || Date.now() < ignoreEventsUntil || !metadataReady) return;
    sendAction("seek");
  });

  video.addEventListener("ended", () => {
    if (applyingRemote) return;
    sendAction("pause", { position: Number(video.duration) || 0 });
  });

  video.addEventListener("timeupdate", updateUI);
  video.addEventListener("durationchange", updateUI);

  playBtn.addEventListener("click", async () => {
    if (!metadataReady) return;
    try {
      await video.play();
      sendAction("play");
    } catch (_) {
      setMessage("Browser tidak dapat memutar video. Coba tekan tombol Play pada pemutar.", true);
    }
  });

  pauseBtn.addEventListener("click", () => {
    if (!metadataReady) return;
    video.pause();
    sendAction("pause");
  });

  syncBtn.addEventListener("click", () => {
    if (!metadataReady) return;
    applyRoomState(roomState, true);
    send({
      type: "hello",
      duration: Number.isFinite(video.duration) ? video.duration : null,
      hasVideo: true
    });
  });

  seek.addEventListener("pointerdown", () => { draggingSeek = true; });
  seek.addEventListener("pointerup", () => { draggingSeek = false; });
  seek.addEventListener("input", () => {
    if (!metadataReady || !Number.isFinite(video.duration)) return;
    const target = (Number(seek.value) / 1000) * video.duration;
    currentTime.textContent = formatTime(target);
  });
  seek.addEventListener("change", () => {
    draggingSeek = false;
    if (!metadataReady || !Number.isFinite(video.duration)) return;
    video.currentTime = (Number(seek.value) / 1000) * video.duration;
    sendAction("seek");
  });

  // Koreksi ringan jika posisi lokal menyimpang dari waktu room.
  // Tidak menggeser saat pengguna sedang menggerakkan seek bar.
  syncTimer = setInterval(() => {
    updateConnection();
    if (!metadataReady || !hasVideo || !roomState.playing || draggingSeek || applyingRemote) return;
    if (Date.now() - lastSentActionAt < 1200) return;

    const target = clampPosition(expectedPosition(roomState));
    const diff = target - (Number(video.currentTime) || 0);
    if (Math.abs(diff) > 2.0) {
      applyingRemote = true;
      ignoreEventsUntil = Date.now() + 700;
      try { video.currentTime = target; } catch (_) {}
      setTimeout(() => { applyingRemote = false; }, 250);
    }
  }, 1000);

  window.addEventListener("beforeunload", () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
    if (socket) socket.close();
    if (syncTimer) clearInterval(syncTimer);
  });

  connect();
})();
</script>
</body>
</html>`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      const id = env.WATCH_ROOM.idFromName("global-watch-party");
      return env.WATCH_ROOM.get(id).fetch(request);
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "Local Video Watch Party" });
    }

    if (url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    return new Response(PAGE, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};

export class WatchRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sessions = new Map();
    this.state = { ...DEFAULT_STATE };
    this.ready = this.ctx.storage.get("state").then((saved) => {
      if (saved && typeof saved === "object") {
        this.state = { ...DEFAULT_STATE, ...saved };
      }
    });
  }

  async fetch(request) {
    await this.ready;

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.sessions.set(server, {
      duration: null,
      hasVideo: false,
      joinedAt: Date.now()
    });

    server.addEventListener("message", (event) => {
      this.handleMessage(server, event.data).catch(() => {
        this.send(server, {
          type: "error",
          message: "Pesan tidak dapat diproses."
        });
      });
    });

    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
    });

    this.send(server, { type: "state", state: this.state });
    return new Response(null, { status: 101, webSocket: client });
  }

  send(socket, data) {
    try {
      if (socket.readyState === 1) socket.send(JSON.stringify(data));
    } catch (_) {
      this.sessions.delete(socket);
    }
  }

  broadcast(data) {
    const encoded = JSON.stringify(data);
    for (const socket of this.sessions.keys()) {
      try {
        if (socket.readyState === 1) socket.send(encoded);
        else this.sessions.delete(socket);
      } catch (_) {
        this.sessions.delete(socket);
      }
    }
  }

  async persist() {
    await this.ctx.storage.put("state", this.state);
  }

  async publishState() {
    await this.persist();
    this.broadcast({ type: "state", state: this.state });
  }

  async handleMessage(socket, raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      this.send(socket, { type: "error", message: "Format pesan tidak valid." });
      return;
    }

    if (!data || typeof data.type !== "string") return;

    if (data.type === "hello") {
      const session = this.sessions.get(socket);
      if (session) {
        const d = Number(data.duration);
        session.duration = Number.isFinite(d) && d > 0 ? d : null;
        session.hasVideo = Boolean(data.hasVideo);
      }

      this.send(socket, { type: "state", state: this.state });

      const durations = [];
      for (const [peer, info] of this.sessions.entries()) {
        if (peer !== socket && info.duration) durations.push(info.duration);
      }
      if (durations.length) {
        this.send(socket, { type: "peerInfo", duration: durations[0] });
      }
      return;
    }

    if (data.type !== "control") return;

    const allowed = new Set(["play", "pause", "seek"]);
    if (!allowed.has(data.action)) {
      this.send(socket, { type: "error", message: "Jenis kontrol tidak dikenal." });
      return;
    }

    let position = Number(data.position);
    if (!Number.isFinite(position) || position < 0) position = 0;
    position = Math.min(position, 7 * 24 * 60 * 60);

    this.state = {
      ...this.state,
      position,
      playing: data.action === "play",
      updatedAt: Date.now(),
      revision: (Number(this.state.revision) || 0) + 1,
      updatedBy: data.action
    };

    await this.publishState();
  }
}
