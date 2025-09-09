
const $ = (sel) => document.querySelector(sel);
const threadList = $("#threadList");
const messagesEl = $("#messages");
const threadView = $("#threadView");
const threadsPanel = $("#threads");
const backBtn = $("#back");
const reloadBtn = $("#reload");
const apiBaseInput = $("#apiBase");
const moreThreadsBtn = $("#moreThreads");
const threadTitle = $("#threadTitle");

let nextThreadsCursor = null;

function api(path, opts={}) {
  const base = apiBaseInput.value.replace(/\/$/, "");
  return fetch(base + path, { ...opts })
    .then(r => {
      if (!r.ok) throw new Error("HTTP "+r.status);
      return r.json();
    });
}

function fmt(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function renderThreadItem(t) {
  const li = document.createElement("li");
  li.className = "thread-item";
  li.innerHTML = \`
    <div class="row">
      <div><strong>\${t.title || "(untitled)"} </strong></div>
      <span class="badge">\${t.assistant}</span>
    </div>
    <div class="meta">
      <span>started: \${fmt(t.started_at)}</span>
      <span>last: \${fmt(t.last_message_at)}</span>
    </div>
  \`;
  li.onclick = () => openThread(t.id, t.title);
  return li;
}

function loadThreads(cursor=null) {
  const url = cursor ? \`/threads?limit=30&cursor=\${encodeURIComponent(cursor)}\` : "/threads?limit=30";
  api(url).then(data => {
    (data.items || []).forEach(t => threadList.appendChild(renderThreadItem(t)));
    nextThreadsCursor = data.next_cursor || null;
    moreThreadsBtn.disabled = !nextThreadsCursor;
  }).catch(err => {
    console.error(err);
    alert("Failed to load threads: " + err.message);
  });
}

function openThread(id, title) {
  threadTitle.textContent = title || "Thread";
  threadsPanel.classList.add("hidden");
  threadView.classList.remove("hidden");
  messagesEl.innerHTML = "<div class='kv'>Loading …</div>";
  api(\`/threads/\${id}/messages\`).then(data => {
    messagesEl.innerHTML = "";
    (data.messages || []).forEach(m => {
      const div = document.createElement("div");
      div.className = "message";
      const artifacts = (m.artifacts || []).map(a => \`
        <div class="artifact">
          <div class="kv">artifact <code class="lang">\${a.language || a.kind || ""}</code></div>
          <pre><code>\${escapeHtml(a.content || "")}</code></pre>
        </div>\`).join("");
      const cards = (m.cards || []).map(c => \`
        <div class="card">
          <div class="kv">MemoryCard <code>\${c.id}</code></div>
          <div>\${escapeHtml(c.summary || "")}</div>
          \${(c.tags || []).length ? \`<div class='kv'>tags: \${c.tags.join(", ")}</div>\` : ""}
        </div>\`).join("");
      div.innerHTML = \`
        <div class="who">[\${fmt(m.created_at)}] \${m.role}</div>
        <div class="content">\${linkify(escapeHtml(m.content || ""))}</div>
        \${artifacts}
\${cards}
      \`;
      messagesEl.appendChild(div);
    });
    if (!(data.messages || []).length) {
      messagesEl.innerHTML = "<div class='kv'>No messages in this thread.</div>";
    }
  }).catch(err => {
    console.error(err);
    alert("Failed to load messages: " + err.message);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function linkify(text) {
  const urlRe = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRe, '<a href="$1" target="_blank">$1</a>');
}

backBtn.onclick = () => {
  threadView.classList.add("hidden");
  threadsPanel.classList.remove("hidden");
};
reloadBtn.onclick = () => {
  threadList.innerHTML = "";
  nextThreadsCursor = null;
  loadThreads();
};
moreThreadsBtn.onclick = () => {
  if (nextThreadsCursor) loadThreads(nextThreadsCursor);
};

// boot
loadThreads();
