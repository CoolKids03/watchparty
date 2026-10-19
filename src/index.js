
import { DurableObject } from "cloudflare:workers";

const DEFAULT_STATE = {
  videoId: "",
  playing: false,
  position: 0,
  updatedAt: Date.now(),
  revision: 0
};

const PAGE = String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101116">
<title>Watch Together</title>

<style>
:root {
  color-scheme: dark;
  --bg: #101116;
  --panel: #1a1b23;
  --border: #30313d;
  --text: #f4f3fa;
  --muted: #a1a3b3;
  --accent: #a18aff;
  --green: #63d8a1;
}
* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont,
               "Segoe UI", sans-serif;
  -webkit-tap-highlight-color: transparent;
}
button, input { font: inherit; }

.app {
  max-width: 620px;
  margin: 0 auto;
  padding: max(16px, env(safe-area-inset-top)) 16px
           max(30px, env(safe-area-inset-bottom));
}
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0 20px;
}
.logo {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 15px;
  color: #191422;
  background: var(--accent);
  font-size: 23px;
}
.brand { flex: 1; min-width: 0; }
.brand h1 {
  font-size: 20px;
  margin: 0 0 3px;
}
.brand p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.connection {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e4b15c;
}
.dot.online { background: var(--green); }
.dot.offline { background: #f16b76; }

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 14px;
}
.player-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #050507;
}
#player, #player iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.player-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  text-align: center;
  padding: 20px;
  pointer-events: none;
}
.play-symbol {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #22232e;
  color: var(--accent);
  font-size: 23px;
}
.player-meta { padding: 14px; }
.video-title { font-size: 15px; font-weight: 650; }
.video-subtitle {
  font-size: 12px;
  color: var(--muted);
  margin-top: 5px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  margin: 22px 2px 11px;
}
.video-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}
.field {
  width: 100%;
  border: 1px solid var(--border);
  background: #111219;
  color: var(--text);
  border-radius: 12px;
  min-height: 48px;
  padding: 0 13px;
  outline: none;
}
.field:focus { border-color: var(--accent); }
.btn {
  border: 1px solid var(--border);
  background: #22232e;
  color: var(--text);
  border-radius: 12px;
  padding: 13px 15px;
  min-height: 47px;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.btn.primary {
  background: var(--accent);
  color: #191422;
  border-color: var(--accent);
}
.hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
  margin: 10px 2px;
}
.notice {
  display: none;
  border-radius: 12px;
  background: #292438;
  border: 1px solid #51436e;
  color: #e4dcff;
  font-size: 12px;
  line-height: 1.6;
  padding: 12px;
  margin-bottom: 14px;
  overflow-wrap: anywhere;
}
.notice.show { display: block; }
.status-card {
  padding: 14px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
}
.footer {
  color: #737584;
  text-align: center;
  font-size: 11px;
  padding: 16px 0;
}
@media (max-width: 380px) {
  .app { padding-left: 11px; padding-right: 11px; }
  .brand h1 { font-size: 18px; }
  .connection { font-size: 10px; }
}
</style>
</head>

<body>
<main class="app">
  <header class="header">
    <div class="logo">▶</div>
    <div class="brand">
      <h1>Watch Together</h1>
      <p>Satu tontonan, tersinkron bersama</p>
    </div>
    <div class="connection">
      <span class="dot" id="statusDot"></span>
      <span id="connectionText">Menghubungkan</span>
    </div>
  </header>

  <div class="notice" id="notice"></div>

  <section class="card">
    <div class="player-wrap">
      <div id="player"></div>
      <div class="player-placeholder" id="placeholder">
        <div class="play-symbol">▶</div>
        <div>Belum ada video</div>
        <div style="font-size:12px">
          Tambahkan tautan YouTube di bawah
        </div>
      </div>
    </div>
    <div class="player-meta">
      <div class="video-title" id="videoTitle">
        Ruang tontonan bersama
      </div>
      <div class="video-subtitle" id="videoSubtitle">
        Semua pengunjung berbagi video yang sama
      </div>
    </div>
  </section>

  <div class="section-title">Ganti video untuk semua</div>
  <section class="card">
    <form class="video-form" id="videoForm">
      <input class="field" id="videoUrl" type="text"
             placeholder="Tempel tautan YouTube..."
             autocomplete="url" required>
      <button class="btn primary" type="submit">
        Muat video untuk semua
      </button>
    </form>
  </section>

  <div class="section-title">Status sinkronisasi</div>
  <section class="card status-card">
    <div id="syncStatus">Menunggu status server...</div>
    <div id="playbackStatus">Status pemutar: menunggu video</div>
  </section>

  <div class="section-title">Cara menggunakan</div>
  <section class="card" style="padding:15px">
    <div class="hint" style="margin:0">
      1. Tempel tautan YouTube lalu tekan Muat video untuk semua.<br>
      2. Gunakan tombol Play/Pause asli pada pemutar YouTube.<br>
      3. Geser timeline YouTube untuk berpindah ke bagian video.<br>
      4. Perubahan pemutaran akan dikirim ke perangkat lain.<br>
      5. Pada HP, jika video belum mulai, ketuk Play pada player.
    </div>
  </section>

  <div class="footer">Watch Together · Satu room global</div>
</main>

<script>
var player = null;
var playerReady = false;
var socket = null;
var reconnectTimer = null;
var currentState = null;
var loadedVideoId = "";
var serverClockOffset = 0;

var applyingRemoteUntil = 0;
var lastObservedPosition = null;
var lastObservedClock = 0;
var lastObservedPlayerState = -1;
var lastPublishedAt = 0;
var lastCorrectionAt = 0;
var draggingOrSeeking = false;

var SEEK_THRESHOLD = 2.0;
var PLAYING_DRIFT_THRESHOLD = 2.5;
var PAUSED_DRIFT_THRESHOLD = 1.0;
var PUBLISH_COOLDOWN_MS = 700;
var CORRECTION_COOLDOWN_MS = 1800;

var statusDot = document.getElementById("statusDot");
var connectionText = document.getElementById("connectionText");
var notice = document.getElementById("notice");
var placeholder = document.getElementById("placeholder");
var videoTitle = document.getElementById("videoTitle");
var videoSubtitle = document.getElementById("videoSubtitle");
var syncStatus = document.getElementById("syncStatus");
var playbackStatus = document.getElementById("playbackStatus");

function showNotice(message) {
  notice.textContent = message;
  notice.classList.add("show");
}

function hideNotice() {
  notice.textContent = "";
  notice.classList.remove("show");
}

function setConnection(online) {
  statusDot.className = "dot " + (online ? "online" : "offline");
  connectionText.textContent = online ? "Terhubung" : "Menyambung...";
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(Number(seconds) || 0));
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);
  var secs = seconds % 60;

  if (hours > 0) {
    return hours + ":" + String(minutes).padStart(2, "0") +
      ":" + String(secs).padStart(2, "0");
  }

  return minutes + ":" + String(secs).padStart(2, "0");
}

function getVideoId(input) {
  try {
    var value = String(input || "").trim();
    if (!value) return "";

    if (!/^https?:\/\//i.test(value)) {
      value = "https://" + value;
    }

    var url = new URL(value);
    var host = url.hostname.toLowerCase().replace(/^www\./, "");
    var id = "";

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v") || "";
      } else {
        var parts = url.pathname.split("/").filter(Boolean);

        if (
          parts.length >= 2 &&
          ["embed", "shorts", "live", "v"].includes(parts[0])
        ) {
          id = parts[1];
        }
      }
    }

    id = id.split(/[?&#]/)[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch (error) {
    return "";
  }
}

function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showNotice("Koneksi server terputus. Tunggu hingga tersambung kembali.");
    return false;
  }

  socket.send(JSON.stringify(message));
  return true;
}

function connectSocket() {
  if (socket && (
    socket.readyState === WebSocket.OPEN ||
    socket.readyState === WebSocket.CONNECTING
  )) {
    return;
  }

  setConnection(false);

  var protocol = location.protocol === "https:" ? "wss://" : "ws://";
  socket = new WebSocket(protocol + location.host + "/ws");

  socket.onopen = function() {
    setConnection(true);
    hideNotice();
  };

  socket.onmessage = function(event) {
    try {
      var message = JSON.parse(event.data);

      if (typeof message.serverNow === "number") {
        serverClockOffset = message.serverNow - Date.now();
      }

      if (message.type === "state" && message.state) {
        currentState = message.state;
        applyState(currentState);
      }
    } catch (error) {
      console.error("Pesan server tidak valid:", error);
    }
  };

  socket.onclose = function() {
    setConnection(false);

    if (!reconnectTimer) {
      reconnectTimer = setTimeout(function() {
        reconnectTimer = null;
        connectSocket();
      }, 2000);
    }
  };

  socket.onerror = function() {
    setConnection(false);
  };
}

function authoritativePosition(state) {
  if (!state) return 0;

  var position = Math.max(0, Number(state.position) || 0);

  if (state.playing) {
    var serverNow = Date.now() + serverClockOffset;
    var elapsed = Math.max(0, serverNow - Number(state.updatedAt || serverNow));
    position += elapsed / 1000;
  }

  return position;
}

function playerStateName(state) {
  if (!window.YT) return "Menunggu YouTube";

  switch (state) {
    case YT.PlayerState.PLAYING: return "Memutar";
    case YT.PlayerState.PAUSED: return "Dijeda";
    case YT.PlayerState.BUFFERING: return "Buffering";
    case YT.PlayerState.ENDED: return "Selesai";
    case YT.PlayerState.CUED: return "Siap diputar";
    default: return "Memuat";
  }
}

function armRemoteGuard(milliseconds) {
  applyingRemoteUntil = Math.max(
    applyingRemoteUntil,
    performance.now() + milliseconds
  );
}

function rememberPlayerPosition() {
  if (!playerReady || !player) return;

  try {
    lastObservedPosition = player.getCurrentTime() || 0;
    lastObservedClock = performance.now();
    lastObservedPlayerState = player.getPlayerState();
  } catch (error) {
    // Player belum siap sepenuhnya.
  }
}

function applyState(state) {
  if (!state) return;

  if (!state.videoId) {
    placeholder.style.display = "flex";
    videoTitle.textContent = "Ruang tontonan bersama";
    videoSubtitle.textContent = "Belum ada video yang dipilih";
    syncStatus.textContent = "Menunggu video dari peserta...";
    return;
  }

  placeholder.style.display = "none";
  videoTitle.textContent = "Video YouTube";
  videoSubtitle.textContent =
    "Video yang sama untuk semua peserta";

  if (!playerReady || !player) {
    return;
  }

  var targetPosition = authoritativePosition(state);
  var now = performance.now();

  // Muat video baru satu kali. Tunggu pemutar siap sebelum
  // menerapkan koreksi posisi berikutnya.
  if (loadedVideoId !== state.videoId) {
    loadedVideoId = state.videoId;
    armRemoteGuard(3000);

    if (state.playing) {
      player.loadVideoById({
        videoId: state.videoId,
        startSeconds: targetPosition
      });
    } else {
      player.cueVideoById({
        videoId: state.videoId,
        startSeconds: targetPosition
      });
    }

    syncStatus.textContent = "Memuat video bersama...";
    return;
  }

  try {
    var localState = player.getPlayerState();
    var localPosition = player.getCurrentTime() || 0;

    // Jangan koreksi posisi saat buffering atau belum dimulai.
    if (
      localState === YT.PlayerState.BUFFERING ||
      localState === YT.PlayerState.UNSTARTED
    ) {
      syncStatus.textContent = "Menunggu pemutar siap...";
      return;
    }

    var drift = Math.abs(localPosition - targetPosition);
    var cooldownPassed =
      now - lastCorrectionAt >= CORRECTION_COOLDOWN_MS;

    if (
      drift > (state.playing
        ? PLAYING_DRIFT_THRESHOLD
        : PAUSED_DRIFT_THRESHOLD) &&
      cooldownPassed
    ) {
      armRemoteGuard(1600);
      lastCorrectionAt = now;
      player.seekTo(targetPosition, true);
    }

    if (state.playing) {
      if (localState !== YT.PlayerState.PLAYING) {
        armRemoteGuard(2000);
        player.playVideo();
      }
    } else {
      if (
        localState === YT.PlayerState.PLAYING ||
        localState === YT.PlayerState.BUFFERING
      ) {
        armRemoteGuard(1600);
        player.pauseVideo();
      }
    }

    syncStatus.textContent =
      "Status bersama: " + (state.playing ? "Memutar" : "Dijeda") +
      " · Posisi acuan " + formatTime(targetPosition);
  } catch (error) {
    console.warn("Gagal menerapkan status:", error);
  }
}

function publishPlayerState(playing, position) {
  if (!currentState || !currentState.videoId || !playerReady) return;
  if (performance.now() < applyingRemoteUntil) return;

  var now = performance.now();
  if (now - lastPublishedAt < PUBLISH_COOLDOWN_MS) return;

  lastPublishedAt = now;

  sendMessage({
    type: playing ? "play" : "pause",
    position: Math.max(0, Number(position) || 0)
  });
}

function onPlayerStateChange(event) {
  if (!playerReady || !player) return;

  var state = event.data;
  var position = 0;

  try {
    position = player.getCurrentTime() || 0;
  } catch (error) {}

  playbackStatus.textContent =
    "Status pemutar: " + playerStateName(state) +
    " · " + formatTime(position);

  if (state === YT.PlayerState.PLAYING) {
    placeholder.style.display = "none";
  }

  // Perubahan yang disebabkan server tidak boleh dikirim
  // kembali sebagai perintah baru.
  if (performance.now() < applyingRemoteUntil) {
    rememberPlayerPosition();
    return;
  }

  if (
    state === YT.PlayerState.PLAYING ||
    state === YT.PlayerState.PAUSED
  ) {
    publishPlayerState(
      state === YT.PlayerState.PLAYING,
      position
    );
  }

  rememberPlayerPosition();
}

function onPlayerReady() {
  playerReady = true;

  if (currentState && currentState.videoId) {
    // Paksa applyState memuat video yang ada di room.
    loadedVideoId = "";
    applyState(currentState);
  }

  rememberPlayerPosition();
}

function onPlayerError(event) {
  showNotice(
    "YouTube tidak dapat memutar video ini. " +
    "Coba video lain yang mengizinkan pemutaran melalui embed."
  );
  console.error("YouTube player error:", event.data);
}

window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 1,
      disablekb: 0,
      fs: 1,
      playsinline: 1,
      rel: 0,
      enablejsapi: 1,
      origin: location.origin
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
};

var apiScript = document.createElement("script");
apiScript.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(apiScript);

// Muat video bersama dari input.
document.getElementById("videoForm").addEventListener("submit", function(event) {
  event.preventDefault();

  var input = document.getElementById("videoUrl");
  var videoId = getVideoId(input.value);

  if (!videoId) {
    showNotice("Tautan tidak dikenali. Masukkan URL video YouTube yang valid.");
    return;
  }

  if (sendMessage({ type: "setVideo", videoId: videoId })) {
    hideNotice();
    input.blur();
  }
});

// Polling digunakan untuk mendeteksi perpindahan timeline
// yang dilakukan langsung pada kontrol asli YouTube.
setInterval(function() {
  if (!playerReady || !player) return;

  try {
    var now = performance.now();
    var position = player.getCurrentTime() || 0;
    var state = player.getPlayerState();

    playbackStatus.textContent =
      "Status pemutar: " + playerStateName(state) +
      " · " + formatTime(position);

    if (
      lastObservedPosition !== null &&
      lastObservedClock > 0 &&
      now >= applyingRemoteUntil &&
      state !== YT.PlayerState.BUFFERING &&
      lastObservedPlayerState !== YT.PlayerState.BUFFERING
    ) {
      var elapsed = (now - lastObservedClock) / 1000;
      var expected = lastObservedPosition;

      if (lastObservedPlayerState === YT.PlayerState.PLAYING) {
        expected += elapsed;
      }

      var jump = position - expected;

      if (Math.abs(jump) >= SEEK_THRESHOLD) {
        // Pengguna kemungkinan menggeser timeline player.
        if (currentState && currentState.videoId) {
          sendMessage({
            type: "seek",
            position: position
          });
        }
      }
    }

    // Koreksi ringan jika posisi lokal terlalu jauh dari acuan.
    if (
      currentState &&
      currentState.videoId &&
      state !== YT.PlayerState.BUFFERING &&
      now >= applyingRemoteUntil
    ) {
      var target = authoritativePosition(currentState);
      var drift = Math.abs(position - target);

      var threshold = currentState.playing
        ? PLAYING_DRIFT_THRESHOLD
        : PAUSED_DRIFT_THRESHOLD;

      if (
        drift > threshold &&
        now - lastCorrectionAt >= CORRECTION_COOLDOWN_MS
      ) {
        lastCorrectionAt = now;
        armRemoteGuard(1500);
        player.seekTo(target, true);
      }
    }

    lastObservedPosition = position;
    lastObservedClock = now;
    lastObservedPlayerState = state;
  } catch (error) {
    // Player bisa belum siap atau sedang berpindah video.
  }
}, 500);

connectSocket();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }

      const id = env.WATCH_ROOM.idFromName("global-watch-party");
      const room = env.WATCH_ROOM.get(id);
      return room.fetch(request);
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(PAGE, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

export class WatchRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async getState() {
    return await this.ctx.storage.get("state") || {
      ...DEFAULT_STATE,
      updatedAt: Date.now()
    };
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    const state = await this.getState();

    server.send(JSON.stringify({
      type: "state",
      state,
      serverNow: Date.now()
    }));

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string") return;

    let input;

    try {
      input = JSON.parse(message);
    } catch {
      return;
    }

    const state = await this.getState();
    const now = Date.now();

    if (input.type === "setVideo") {
      if (
        typeof input.videoId !== "string" ||
        !/^[A-Za-z0-9_-]{11}$/.test(input.videoId)
      ) {
        return;
      }

      state.videoId = input.videoId;
      state.playing = false;
      state.position = 0;
      state.updatedAt = now;
    } else if (
      input.type === "play" ||
      input.type === "pause" ||
      input.type === "seek"
    ) {
      const position = Number(input.position);

      if (!Number.isFinite(position) || position < 0 || position > 604800) {
        return;
      }

      if (!state.videoId) return;

      state.position = position;
      state.updatedAt = now;

      if (input.type === "play") {
        state.playing = true;
      } else if (input.type === "pause") {
        state.playing = false;
      }
      // Seek mempertahankan status play/pause.
    } else {
      return;
    }

    state.revision = (Number(state.revision) || 0) + 1;

    await this.ctx.storage.put("state", state);

    const payload = JSON.stringify({
      type: "state",
      state,
      serverNow: Date.now()
    });

    for (const client of this.ctx.getWebSockets()) {
      try {
        client.send(payload);
      } catch {
        // Abaikan koneksi yang sudah terputus.
      }
    }
  }

  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {}
  }

  async webSocketError(ws) {
    try {
      ws.close();
    } catch {}
  }
}
