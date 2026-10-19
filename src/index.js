
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
  --panel2: #22232e;
  --border: #30313d;
  --text: #f4f3fa;
  --muted: #a1a3b3;
  --accent: #a18aff;
  --accentText: #191422;
  --green: #63d8a1;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-tap-highlight-color: transparent;
}
button, input { font: inherit; }
button { cursor: pointer; }
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
  color: var(--accentText);
  background: var(--accent);
  font-size: 23px;
}
.brand { flex: 1; min-width: 0; }
.brand h1 {
  font-size: 20px;
  margin: 0 0 3px;
  letter-spacing: -.5px;
}
.brand p { margin: 0; color: var(--muted); font-size: 12px; }
.connection {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
.dot {
  width: 8px; height: 8px; border-radius: 50%;
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
  background: #050507;
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
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
  pointer-events: none;
  text-align: center;
  padding: 20px;
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
.video-subtitle { font-size: 12px; color: var(--muted); margin-top: 5px; }
.section-title {
  font-size: 15px;
  font-weight: 700;
  margin: 22px 2px 11px;
}
.controls { padding: 14px; }
.time-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
input[type=range] {
  display: block;
  width: 100%;
  accent-color: var(--accent);
  margin: 12px 0 16px;
  min-height: 24px;
}
.control-buttons { display: flex; gap: 10px; }
.btn {
  border: 1px solid var(--border);
  background: var(--panel2);
  color: var(--text);
  border-radius: 12px;
  padding: 13px 15px;
  min-height: 47px;
  font-size: 13px;
  font-weight: 650;
}
.btn:active { transform: scale(.985); }
.btn.primary {
  background: var(--accent);
  color: var(--accentText);
  border-color: var(--accent);
}
.btn.wide { flex: 1; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
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
.video-form { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
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
}
.notice.show { display: block; }
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
  .control-buttons { gap: 7px; }
  .btn { padding: 12px 10px; }
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
        <div style="font-size:12px">Tambahkan tautan YouTube di bawah</div>
      </div>
    </div>
    <div class="player-meta">
      <div class="video-title" id="videoTitle">Ruang tontonan bersama</div>
      <div class="video-subtitle" id="videoSubtitle">
        Semua pengunjung berbagi video yang sama
      </div>
    </div>
    <div class="controls">
      <div class="time-row">
        <span id="currentTime">0:00</span>
        <span id="duration">0:00</span>
      </div>
      <input id="seekBar" type="range" min="0" max="1000" value="0"
             aria-label="Posisi video" disabled>
      <div class="control-buttons">
        <button class="btn primary wide" id="playButton" disabled>
          ▶ Putar
        </button>
        <button class="btn" id="syncButton">
          Sinkronkan
        </button>
      </div>
    </div>
  </section>

  <div class="section-title">Ganti video untuk semua</div>
  <section class="card">
    <form class="video-form" id="videoForm">
      <input class="field" id="videoUrl" type="url"
             placeholder="Tempel tautan YouTube..."
             autocomplete="url" required>
      <button class="btn primary" type="submit">
        Putar video ini untuk semua
      </button>
    </form>
  </section>

  <div class="section-title">Cara menggunakan</div>
  <section class="card" style="padding:15px">
    <div class="hint" style="margin:0">
      1. Tempel tautan YouTube dan tekan tombol putar untuk semua.<br>
      2. Tekan Putar atau Jeda untuk mengontrol semua perangkat.<br>
      3. Gunakan bilah posisi untuk melompat ke bagian video tertentu.<br>
      4. Jika baru membuka halaman, tekan Sinkronkan bila posisi belum cocok.
    </div>
  </section>

  <div class="footer">Watch Together · Satu room global</div>
</main>

<script>
var player = null;
var playerReady = false;
var loadedVideoId = "";
var currentState = null;
var socket = null;
var reconnectTimer = null;
var serverClockOffset = 0;
var applyingRemote = false;
var draggingSeek = false;
var lastAppliedRevision = -1;
var activationTest = false;
var activationUntil = 0;

var statusDot = document.getElementById("statusDot");
var connectionText = document.getElementById("connectionText");
var notice = document.getElementById("notice");
var placeholder = document.getElementById("placeholder");
var playButton = document.getElementById("playButton");
var seekBar = document.getElementById("seekBar");
var currentTimeLabel = document.getElementById("currentTime");
var durationLabel = document.getElementById("duration");
var videoTitle = document.getElementById("videoTitle");
var videoSubtitle = document.getElementById("videoSubtitle");

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
    return hours + ":" + String(minutes).padStart(2, "0") + ":" +
           String(secs).padStart(2, "0");
  }
  return minutes + ":" + String(secs).padStart(2, "0");
}

function getVideoId(input) {
  try {
    var value = String(input || "").trim();

    if (!value) return "";

    // Mendukung URL yang ditempel tanpa protokol.
    if (!/^https?:\/\//i.test(value)) {
      value = "https://" + value;
    }

    var url = new URL(value);
    var host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

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

    // Validasi ID video YouTube.
    id = id.split(/[?&#]/)[0];

    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch (error) {
    console.error("Gagal membaca tautan YouTube:", error);
    return "";
  }
}

function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showNotice("Belum terhubung ke server. Tunggu koneksi tersambung lalu coba lagi.");
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
    } catch (e) {
      console.error("Pesan server tidak valid", e);
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
  var position = Number(state.position) || 0;
  if (state.playing) {
    var serverNow = Date.now() + serverClockOffset;
    position += Math.max(0, serverNow - state.updatedAt) / 1000;
  }
  return position;
}

function applyState(state) {
  if (!state) return;

  if (!state.videoId) {
    placeholder.style.display = "flex";
    videoTitle.textContent = "Ruang tontonan bersama";
    videoSubtitle.textContent = "Belum ada video yang dipilih";
    playButton.disabled = true;
    seekBar.disabled = true;
    return;
  }

  placeholder.style.display = "none";
  playButton.disabled = false;
  seekBar.disabled = false;

  if (state.videoId !== loadedVideoId) {
    loadedVideoId = state.videoId;
    videoTitle.textContent = "Video YouTube";
    videoSubtitle.textContent = "Video telah diperbarui untuk semua peserta";

    if (playerReady && player) {
      applyingRemote = true;
      var target = authoritativePosition(state);

      if (state.playing) {
        player.loadVideoById({
          videoId: state.videoId,
          startSeconds: target
        });
      } else {
        player.cueVideoById({
          videoId: state.videoId,
          startSeconds: target
        });
      }

      setTimeout(function() {
        applyingRemote = false;
      }, 1200);
    }
    lastAppliedRevision = state.revision;
  }

  if (!playerReady || !player) return;

  var targetPosition = authoritativePosition(state);
  var playerState = player.getPlayerState();

  applyingRemote = true;

  if (state.playing) {
    if (playerState !== YT.PlayerState.PLAYING &&
        playerState !== YT.PlayerState.BUFFERING) {
      player.playVideo();
    }
  } else if (playerState === YT.PlayerState.PLAYING ||
             playerState === YT.PlayerState.BUFFERING) {
    player.pauseVideo();
  }

  var localPosition = player.getCurrentTime() || 0;
  if (Math.abs(localPosition - targetPosition) > 1.8) {
    player.seekTo(targetPosition, true);
  }

  setTimeout(function() {
    applyingRemote = false;
  }, 350);

  lastAppliedRevision = state.revision;
}

window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    videoId: "",
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 1,
      playsinline: 1,
      rel: 0,
      enablejsapi: 1,
      origin: location.origin
    },
    events: {
      onReady: function() {
        playerReady = true;
        if (currentState) applyState(currentState);
      },
      onStateChange: function(event) {
        if (event.data === YT.PlayerState.PLAYING) {
          placeholder.style.display = "none";
        }

        if (event.data === YT.PlayerState.ENDED &&
            Date.now() > activationUntil &&
            !applyingRemote) {
          sendMessage({
            type: "pause",
            position: player.getCurrentTime() || 0
          });
        }
      },
      onError: function(event) {
        showNotice(
          "YouTube tidak dapat memutar video ini. Coba video lain yang mengizinkan pemutaran melalui embed."
        );
        console.error("YouTube player error:", event.data);
      }
    }
  });
};

var apiScript = document.createElement("script");
apiScript.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(apiScript);

playButton.addEventListener("click", function() {
  if (!currentState || !currentState.videoId || !playerReady) {
    showNotice("Tunggu pemutar YouTube siap terlebih dahulu.");
    return;
  }

  var state = player.getPlayerState();
  var position = player.getCurrentTime() || 0;

  if (state === YT.PlayerState.PLAYING ||
      (currentState.playing && state === YT.PlayerState.BUFFERING)) {
    sendMessage({ type: "pause", position: position });
  } else {
    // Klik pengguna merupakan tindakan langsung untuk mengizinkan play.
    player.playVideo();
    sendMessage({ type: "play", position: position });
  }
});

document.getElementById("syncButton").addEventListener("click", function() {
  if (!currentState) {
    showNotice("Menunggu status room dari server.");
    return;
  }
  applyState(currentState);
  hideNotice();
});

document.getElementById("videoForm").addEventListener("submit", function(event) {
  event.preventDefault();

  var input = document.getElementById("videoUrl");
  var videoId = getVideoId(input.value);

  if (!videoId) {
    showNotice("Tautan tidak dikenali. Gunakan tautan video YouTube yang valid.");
    return;
  }

  if (sendMessage({ type: "setVideo", videoId: videoId })) {
    hideNotice();
    input.blur();
  }
});

seekBar.addEventListener("input", function() {
  var duration = playerReady && player ? player.getDuration() || 0 : 0;
  var preview = duration * Number(seekBar.value) / 1000;
  currentTimeLabel.textContent = formatTime(preview);
});

seekBar.addEventListener("pointerdown", function() {
  draggingSeek = true;
});

function commitSeek() {
  if (!playerReady || !player || !currentState || !currentState.videoId) {
    draggingSeek = false;
    return;
  }

  var duration = player.getDuration() || 0;
  var target = duration * Number(seekBar.value) / 1000;

  player.seekTo(target, true);
  sendMessage({ type: "seek", position: target });
  draggingSeek = false;
}

seekBar.addEventListener("change", commitSeek);
seekBar.addEventListener("pointerup", function() {
  if (draggingSeek) commitSeek();
});

setInterval(function() {
  if (!playerReady || !player) return;

  try {
    var current = player.getCurrentTime() || 0;
    var duration = player.getDuration() || 0;

    if (!draggingSeek) {
      currentTimeLabel.textContent = formatTime(current);
      if (duration > 0) {
        seekBar.value = String(Math.min(1000, current / duration * 1000));
      }
    }

    durationLabel.textContent = formatTime(duration);

    if (currentState && currentState.videoId) {
      var playerState = player.getPlayerState();
      playButton.textContent =
        playerState === YT.PlayerState.PLAYING ? "Ⅱ Jeda untuk semua" : "▶ Putar untuk semua";

      // Koreksi posisi lokal terhadap jam server.
      // Jangan mengirim pesan dari timer, agar beberapa peserta
      // tidak saling menimpa status room.
      if (currentState.playing && !draggingSeek &&
          playerState === YT.PlayerState.PLAYING) {
        var target = authoritativePosition(currentState);
        if (Math.abs(current - target) > 2.2) {
          player.seekTo(target, true);
        }
      }
    }
  } catch (e) {
    // Pemutar mungkin belum selesai diinisialisasi.
  }
}, 1500);

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
      state: state,
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
      // Seek mempertahankan status play/pause yang sudah ada.
    } else {
      return;
    }

    state.revision = (Number(state.revision) || 0) + 1;

    await this.ctx.storage.put("state", state);

    const payload = JSON.stringify({
      type: "state",
      state: state,
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
    } catch {
      // Tidak perlu tindakan tambahan.
    }
  }

  async webSocketError(ws) {
    try {
      ws.close();
    } catch {
      // Tidak perlu tindakan tambahan.
    }
  }
}
