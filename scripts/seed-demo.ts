// Fills the console with a realistic month of conversations for the demo. No AI calls: answers are written here and
// cite real sections of the sample articles. Run: npm run seed (after npm run ingest).
import "dotenv/config";
import { connect, setup } from "../src/db.js";
import { excerptOf } from "../src/assistant.js";
import { ingestDir } from "../src/knowledge.js";

const sql = connect();
await setup(sql);
await ingestDir(sql, "knowledge");
await sql`truncate conversations restart identity cascade`;
await sql`update settings set assistant_name = 'Acme Help', greeting = 'Hi! I can help with plans, billing, invoices and your account. What do you need?', brand_color = '#111111' where id = 1`;

const section = async (heading: string) => {
  const [r] = await sql<{ id: number; title: string; heading: string; slug: string; content: string }[]>`
    select c.id, d.title, c.heading, d.slug, c.content from chunks c join documents d on d.id = c.document_id where c.heading = ${heading}`;
  if (!r) throw new Error(`No section called ${heading}`);
  return r;
};

type Turn = { q: string; a: string; cite?: string[]; handoff?: string };
const CONVERSATIONS: { daysAgo: number; turns: Turn[] }[] = [
  { daysAgo: 29, turns: [{ q: "How much is the Growth plan?", a: "Growth costs $29 per month and includes 5 users, unlimited invoices and automatic payment reminders. Paying yearly saves 20%.", cite: ["Plans and prices"] }] },
  { daysAgo: 28, turns: [{ q: "how do i add my logo to invoices", a: "Go to Settings → Business profile and upload your logo there, along with your business name, address and tax number. It appears on every invoice you send.", cite: ["Set up your business profile"] }] },
  { daysAgo: 27, turns: [{ q: "Do you integrate with QuickBooks?", a: "I'm not sure about that one, and I don't want to guess. I've passed this to our support team, and a person will reply by email.", handoff: "Integration question not covered in the docs" }] },
  { daysAgo: 25, turns: [
    { q: "Can my accountant see invoices but not billing?", a: "Yes. Invite them from Settings → Team as a Member. Members can create and send invoices but cannot see billing.", cite: ["Invite your team"] },
    { q: "and how many people can I invite on Starter?", a: "The Starter plan includes 1 user. Growth includes 5 users and Scale includes unlimited users.", cite: ["Invite your team", "Plans and prices"] },
  ] },
  { daysAgo: 24, turns: [{ q: "reset link isn't arriving", a: "Reset links are valid for 30 minutes. If the email hasn't arrived within 5 minutes, check your spam folder, then request a new link from “Forgot password” on the login page.", cite: ["Reset your password"] }] },
  { daysAgo: 22, turns: [{ q: "I want a refund for this month, I barely used it", a: "Monthly plans aren't refunded for partial months. Refund requests are reviewed by the billing team. I've passed this to our support team, and a person will reply by email.", cite: ["Refunds"], handoff: "Refund request" }] },
  { daysAgo: 21, turns: [{ q: "How do customers pay by card?", a: "Connect Stripe under Settings → Payments. Customers can then pay invoices by card from the invoice link; paid invoices are marked Paid automatically within a minute. Stripe's fees apply and Acme adds none.", cite: ["Accept card payments"] }] },
  { daysAgo: 20, turns: [{ q: "can I invoice in euros", a: "Yes. Each customer has a currency, and their invoices are issued in that currency.", cite: ["Currencies and tax"] }] },
  { daysAgo: 18, turns: [{ q: "Is there a mobile app?", a: "I'm not sure about that one, and I don't want to guess. I've passed this to our support team, and a person will reply by email.", handoff: "Question about a mobile app not covered in the docs" }] },
  { daysAgo: 17, turns: [{ q: "how to stop reminders for one client", a: "Go to Settings → Reminders. You can change the schedule or turn reminders off for a specific customer there.", cite: ["Payment reminders"] }] },
  { daysAgo: 16, turns: [{ q: "Can I edit an invoice after sending it?", a: "Yes, until it's paid. The customer's link always shows the latest version. To cancel a sent invoice, open it and choose Void.", cite: ["Edit or void an invoice"] }] },
  { daysAgo: 15, turns: [{ q: "I need to speak to someone about my account", a: "I've passed this to our support team, and a person will reply by email.", handoff: "Customer asked for a person" }] },
  { daysAgo: 14, turns: [{ q: "where is my data stored", a: "Data is stored in the EU and encrypted at rest and in transit. Backups are kept for 30 days.", cite: ["Data storage"] }] },
  { daysAgo: 12, turns: [{ q: "Import customers from a spreadsheet?", a: "Go to Customers → Import and upload a CSV with the columns name, email, company and currency. Existing emails are updated, not duplicated, and each file can have up to 5,000 rows.", cite: ["Import customers"] }] },
  { daysAgo: 11, turns: [{ q: "Please delete my account and all data", a: "Account deletion is permanent and must be confirmed by the account owner, and a person verifies your identity first. You can export your data beforehand from Settings → Export. I've passed this to our support team, and a person will reply by email.", cite: ["Delete your account", "Export your data"], handoff: "Account deletion request" }] },
  { daysAgo: 10, turns: [{ q: "what happens if I cancel", a: "Your account stays active until the end of the period you've paid for. It then becomes read-only for 90 days so you can export your data, and is deleted after that.", cite: ["Cancel your subscription"] }] },
  { daysAgo: 9, turns: [{ q: "how do I turn on 2FA", a: "Turn on two-factor authentication under Profile → Security using any authenticator app. On the Scale plan, admins can require it for the whole team.", cite: ["Two-factor authentication"] }] },
  { daysAgo: 8, turns: [{ q: "Do you offer a discount for nonprofits?", a: "I'm not sure about that one, and I don't want to guess. I've passed this to our support team, and a person will reply by email.", handoff: "Pricing question not covered in the docs" }] },
  { daysAgo: 7, turns: [{ q: "upgrade to scale mid month - do I pay full price?", a: "Upgrades take effect immediately, and you're charged a prorated amount for the rest of the billing period.", cite: ["Change your plan"] }] },
  { daysAgo: 6, turns: [{ q: "Where do I find receipts", a: "Receipts are emailed to the billing contact after each charge, and they're also under Settings → Billing → Receipts.", cite: ["Payment methods and receipts"] }] },
  { daysAgo: 5, turns: [{ q: "Can I add tax to line items", a: "Yes. Add tax rates under Settings → Tax, then apply one or more rates to each line item. Acme Invoicing doesn't file taxes for you.", cite: ["Currencies and tax"] }] },
  { daysAgo: 4, turns: [{ q: "Do you integrate with Xero?", a: "I'm not sure about that one, and I don't want to guess. I've passed this to our support team, and a person will reply by email.", handoff: "Integration question not covered in the docs" }] },
  { daysAgo: 3, turns: [{ q: "how long is the free trial", a: "You get a 14-day free trial of the Growth plan, and no card is needed to start it.", cite: ["Create your account"] }] },
  { daysAgo: 2, turns: [{ q: "When are reminders sent?", a: "On Growth and Scale, reminders go out 3 days before the due date, on the due date, and 7 days after it.", cite: ["Payment reminders"] }] },
  { daysAgo: 1, turns: [{ q: "I was charged twice this month", a: "I can't look into charges myself. I've passed this to our support team, and a person will reply by email.", handoff: "Billing dispute: possible duplicate charge" }] },
  { daysAgo: 0, turns: [{ q: "Which payment cards do you accept?", a: "We accept Visa, Mastercard and American Express.", cite: ["Payment methods and receipts"] }] },
];

for (const [i, conv] of CONVERSATIONS.entries()) {
  const at = (minutes: number) => {
    const d = new Date(Date.now() - conv.daysAgo * 86_400_000);
    d.setUTCHours(9 + (i % 8), (i * 7) % 60, 0, 0);
    return new Date(Math.min(d.getTime() + minutes * 60_000, Date.now() - 60_000));
  };
  const [c] = await sql<{ id: string }[]>`insert into conversations (created_at) values (${at(0)}) returning id`;
  let minute = 0;
  for (const t of conv.turns) {
    const cites = await Promise.all((t.cite ?? []).map(section));
    await sql`insert into messages (conversation_id, role, content, created_at) values (${c!.id}, 'user', ${t.q}, ${at(minute)})`;
    await sql`insert into messages (conversation_id, role, content, citations, created_at)
      values (${c!.id}, 'assistant', ${t.a}, ${sql.json(cites.map(({ id, title, heading, slug, content }) => ({ id, title, heading, slug, excerpt: excerptOf(content) })))}, ${at(minute)})`;
    if (t.handoff) {
      const old = conv.daysAgo > 6;
      await sql`insert into tickets (conversation_id, question, reason, status, created_at, resolved_at)
        values (${c!.id}, ${t.q}, ${t.handoff}, ${old ? "resolved" : "open"}, ${at(minute)}, ${old ? at(minute + 180) : null})`;
    }
    minute += 2;
  }
}

const [counts] = await sql<{ c: number; t: number }[]>`select (select count(*)::int from conversations) as c, (select count(*)::int from tickets) as t`;
console.log(`Demo history ready: ${counts!.c} conversations, ${counts!.t} tickets.`);
await sql.end();
