// SMS sending via MSG91.
// Sign up at https://msg91.com, complete DLT registration (required for
// sending SMS in India), and create a template. Then fill in the
// MSG91_* values in your .env file.
//
// Docs: https://docs.msg91.com/p/tf9GTextN/e/tsE2Zjq09j/MSG91

async function sendSMS({ toPhone, studentName, endDate, kind }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || authKey === "your-msg91-auth-key") {
    console.log(`[SMS SKIPPED - no MSG91 key set] Would notify ${toPhone}: ${studentName} van fee ${kind} (${endDate})`);
    return { skipped: true };
  }

  // kind is 'upcoming' or 'expired' - use it to pick a different DLT-approved
  // template if you want two separate messages instead of one shared template.

  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      sender: senderId,
      recipients: [
        {
          mobiles: toPhone,
          VAR1: studentName,
          VAR2: endDate,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("MSG91 send failed:", data);
  }
  return data;
}

module.exports = { sendSMS };
