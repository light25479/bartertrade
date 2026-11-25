// Sends SMS through Africa's Talking. With no keys set (development), the message is printed instead.
async function sendSms(to, message) {
  const { AT_USERNAME, AT_API_KEY, AT_SENDER_ID } = process.env;

  if (!AT_USERNAME || !AT_API_KEY) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMS is not configured');
    console.log(`\n[DEV SMS] To: ${to}\n${message}\n`);
    return;
  }

  const base =
    AT_USERNAME === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
  const body = new URLSearchParams({ username: AT_USERNAME, to, message });
  if (AT_SENDER_ID) body.set('from', AT_SENDER_ID);

  const res = await fetch(`${base}/version1/messaging`, {
    method: 'POST',
    headers: {
      apiKey: AT_API_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`SMS failed with status ${res.status}`);

  const data = await res.json();
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (!recipient || recipient.status !== 'Success') {
    throw new Error(`SMS failed: ${recipient?.status || 'unknown'}`);
  }
}

module.exports = { sendSms };