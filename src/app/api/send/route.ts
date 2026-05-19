import { NextResponse } from "next/server";

export const runtime = "nodejs";

function buildMailApiSendUrl(mailApiUrl: string) {
  const trimmedUrl = mailApiUrl.trim().replace(/\/$/, "");

  return trimmedUrl.endsWith("/send") ? trimmedUrl : `${trimmedUrl}/send`;
}

function parseErrorDetails(text: string) {
  try {
    const body = JSON.parse(text) as { error?: unknown; details?: unknown };

    return String(body.details || body.error || text);
  } catch {
    return text;
  }
}

function getConnectionErrorDetails(err: unknown) {
  if (!(err instanceof Error)) {
    return String(err);
  }

  const cause = err.cause as
    | { code?: unknown; reason?: unknown; message?: unknown }
    | undefined;
  const code = cause?.code ? String(cause.code) : "";
  const reason = cause?.reason || cause?.message;

  if (
    code.includes("CERT") ||
    code.includes("TLS") ||
    err.message.toLowerCase().includes("certificate")
  ) {
    return `Mail API TLS/certificate error${code ? ` (${code})` : ""}${
      reason ? `: ${String(reason)}` : ""
    }`;
  }

  return reason ? `${err.message}: ${String(reason)}` : err.message;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const fromName = String(formData.get("fromName") || "");
    const fromEmail = String(formData.get("fromEmail") || "");
    const to = String(formData.get("to") || "");
    const subject = String(formData.get("subject") || "");
    const html = String(formData.get("html") || "");
    const forwardTo = String(formData.get("forwardTo") || "");
    const replyTo = String(formData.get("replyTo") || "");

    const cc = formData.getAll("cc[]").map(String);
    const bcc = formData.getAll("bcc[]").map(String);
    const attachments = [
      ...formData.getAll("attachments"),
      ...formData.getAll("attachments[]"),
    ].filter((attachment): attachment is File => attachment instanceof File);

    if (!fromEmail || !to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const MAIL_API_URL = process.env.MAIL_API_URL;

    if (!MAIL_API_URL) {
      return NextResponse.json(
        { error: "MAIL_API_URL not configured" },
        { status: 500 },
      );
    }

    // Forward all fields to mailer API
    const payload = new FormData();

    payload.append("fromName", fromName);
    payload.append("from", fromEmail);
    payload.append("to", to);
    payload.append("subject", subject);
    payload.append("html", html);

    if (forwardTo) {
      payload.append("forwardTo", forwardTo);
    }

    if (replyTo) {
      payload.append("replyTo", replyTo);
    }

    if (cc.length > 0) {
      payload.append("cc", cc.join(", "));
    }

    if (bcc.length > 0) {
      payload.append("bcc", bcc.join(", "));
    }

    attachments.forEach((attachment) => {
      payload.append("attachments", attachment, attachment.name);
    });

    console.log("SEND ROUTE ATTACHMENTS:", {
      count: attachments.length,
      files: attachments.map((attachment) => ({
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
      })),
    });

    const sendUrl = buildMailApiSendUrl(MAIL_API_URL);

    const res = await fetch(sendUrl, {
      method: "POST",
      body: payload,
    });

    const text = await res.text();

    if (!res.ok) {
      const details = parseErrorDetails(text);

      console.error("MAIL API ERROR:", {
        status: res.status,
        url: sendUrl,
        details,
      });

      return NextResponse.json(
        { error: "Mail delivery failed", details },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const details = getConnectionErrorDetails(err);

    console.error("SEND ERROR:", err);

    return NextResponse.json(
      { error: "Mail API connection failed", details },
      { status: 502 },
    );
  }
}
