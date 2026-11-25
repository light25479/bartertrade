// Keeps track of who is connected, so we can push new messages to them instantly
const clients = new Map(); // userId -> Set of open connections

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  const set = clients.get(userId);
  // Allow at most 5 open tabs per user; close the oldest if exceeded
  if (set.size >= 5) {
    const oldest = set.values().next().value;
    set.delete(oldest);
    oldest.end();
  }
  set.add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
}

function pushTo(userId, event) {
  const set = clients.get(userId);
  if (!set) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) res.write(data);
}

module.exports = { addClient, removeClient, pushTo };