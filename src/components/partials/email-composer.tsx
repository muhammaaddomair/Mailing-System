"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

import { CharCounter } from "@/components/partials/char-counter";
import { SendAnimation } from "@/components/partials/send-animation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { updateAnalytics } from "@/utils/analytics";
import { cn } from "@/lib/utils";

import {
  SendHorizonal,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Paperclip,
  X,
  CheckCircle2,
} from "lucide-react";

const SENDER_DOMAINS = [
  "globalpublishingdesk.com",
] as const;

const FROM_EXTENSIONS = ["gov", "com", "com-direct", "us", "org", "gá»v"] as const;

function getFromExtension(ext: (typeof FROM_EXTENSIONS)[number]) {
  return ext === "com-direct" ? "com" : ext;
}

const formSchema = z
  .object({
    fromName: z.string().min(1, "From Name is required"),
    fromUser: z.string().min(1, "From user is required"),
    fromOrg: z.string().min(1, "From org is required"),
    ext: z.enum(FROM_EXTENSIONS),
    sendingDomain: z.enum(SENDER_DOMAINS),

    to: z.string().optional(),

    forwardTo: z.string().optional(),

    replyTo: z.string().email("Invalid email").or(z.literal("")).optional(),
    cc: z.string().optional(),
    bcc: z.string().optional(),

    subject: z.string().min(1, "Subject is required"),
  })
  .superRefine((values, ctx) => {
    const needsForwarding = values.ext === "gov" || values.ext === "com";

    if (needsForwarding) {
      if (!values.forwardTo || !values.forwardTo.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["forwardTo"],
          message: "Forward To is required for this mode",
        });
      }
    } else {
      if (!values.to || !values.to.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["to"],
          message: "To is required",
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

/* TOOLBAR BUTTON */
function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-9 w-9 inline-flex items-center justify-center rounded-md border",
        "border-border bg-background hover:bg-muted",
        active ? "ring-2 ring-ring" : "",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* RICH EDITOR */
function RichEmailEditor({
  value,
  onChange,
  disabled,
  resetKey,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  resetKey: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write your email…" }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,

    editorProps: {
      attributes: {
        class: "font-serif text-[16px] leading-[1.6]",
      },
    },

    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      key={resetKey}
      className={["space-y-4 mt-8", disabled ? "opacity-60" : ""].join(" ")}
    >
      <div className="flex flex-wrap gap-2">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          disabled={!!disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          disabled={!!disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          disabled={!!disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Bullets"
          active={editor.isActive("bulletList")}
          disabled={!!disabled}
          onClick={() => {
            if (!editor.state.selection.empty) {
              editor.chain().focus().toggleBulletList().run();
            }
          }}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Ordered"
          active={editor.isActive("orderedList")}
          disabled={!!disabled}
          onClick={() => {
            if (!editor.state.selection.empty) {
              editor.chain().focus().toggleOrderedList().run();
            }
          }}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Link"
          disabled={!!disabled}
          onClick={() => {
            const url = prompt("Enter URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Undo"
          disabled={!!disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Redo"
          disabled={!!disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div
        className={[
          "min-h-[200px] border !bg-input rounded-md p-3 bg-white",
          disabled ? "pointer-events-none" : "",
        ].join(" ")}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default function EmailComposer() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [html, setHtml] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [forwardStatus, setForwardStatus] = useState<
    "idle" | "setting" | "set" | "error"
  >("idle");
  const [editorResetKey, setEditorResetKey] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ext: "gov",
      fromName: "",
      fromUser: "",
      fromOrg: "",
      sendingDomain: "globalpublishingdesk.com",
      to: "",
      forwardTo: "",
      replyTo: "",
      cc: "",
      bcc: "",
      subject: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const ext = form.watch("ext");
  const needsForwarding = ext === "gov" || ext === "com";

  useEffect(() => {
    setForwardStatus("idle");
    form.setValue("forwardTo", "");

    if (needsForwarding) {
      form.setValue("cc", "");
      form.setValue("bcc", "");
    }
  }, [ext]); // eslint-disable-line react-hooks/exhaustive-deps

  const FORWARDING_FIXED_TO = useMemo(
    () =>
      process.env.NEXT_PUBLIC_FORWARDING_FIXED_TO ||
      "support@globalpublishingdesk.com",
    []
  );

  const forwardingLocked = needsForwarding && forwardStatus !== "set";

  const setForwarding = async () => {
    const forwardTo = (form.getValues("forwardTo") || "").trim();
    if (!forwardTo) {
      form.setError("forwardTo", { message: "Forward To is required" });
      toast.error("Set Forward To first");
      return;
    }

    setForwardStatus("setting");

    try {
      const res = await axios.post("/api/set-forward", { forwardTo });

      if (res?.data?.success) {
        setForwardStatus("set");
        toast.success("Forwarding set successfully");
      } else {
        setForwardStatus("error");
        toast.error("Forwarding failed");
      }
    } catch (err) {
      console.error(err);
      setForwardStatus("error");
      toast.error("Forwarding failed");
    }
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!html || html.replace(/<[^>]+>/g, "").trim().length < 5) {
      toast.error("Email body is too short");
      return;
    }

    if (needsForwarding && forwardStatus !== "set") {
      toast.error("Set Forward To first");
      return;
    }

    setStatus("sending");

    const toFinal = needsForwarding
      ? FORWARDING_FIXED_TO
      : (values.to || "").trim();
    const fromEmail = `${values.fromUser}@${values.fromOrg}.${getFromExtension(
      values.ext,
    )}`;
    const ccList = (values.cc || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    const bccList = (values.bcc || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    const formData = new FormData();

    formData.append("fromName", values.fromName);
    formData.append("fromEmail", fromEmail);
    formData.append("sendingDomain", values.sendingDomain);
    formData.append("to", toFinal);

    if (needsForwarding && (values.forwardTo || "").trim()) {
      formData.append("forwardTo", (values.forwardTo || "").trim());
    }

    if (values.replyTo?.trim())
      formData.append("replyTo", values.replyTo.trim());
    ccList.forEach((email) => formData.append("cc[]", email));
    bccList.forEach((email) => formData.append("bcc[]", email));

    formData.append("subject", values.subject);

    const htmlWithFont = `
<div style="
  font-family: 'Times New Roman', Times, serif;
  font-size: 16px;
  line-height: 1.6;
">
  ${html}
</div>
`;

    formData.append("html", htmlWithFont);

    attachments.forEach((file) => {
      formData.append("attachments", file);
    });

    console.group("📤 EMAIL SEND (FormData)");
    console.log("toFinal:", toFinal);
    console.log("fromEmail:", fromEmail);
    console.log("sendingDomain:", values.sendingDomain);
    console.log("subject:", values.subject);
    console.log("cc:", ccList);
    console.log("bcc:", bccList);
    console.log("replyTo:", values.replyTo);
    console.log(
      "attachments:",
      attachments.map((f) => f.name)
    );
    console.groupEnd();

    try {
      await axios.post("/api/send", formData);

      toast.success("Email sent");
      updateAnalytics("sent");
      setStatus("success");
      form.reset();
      setHtml("");
      setAttachments([]);
      setForwardStatus("idle");
      setEditorResetKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      const details = axios.isAxiosError(err)
        ? err.response?.data?.details || err.response?.data?.error
        : undefined;

      toast.error(details ? `Send failed: ${details}` : "Send failed");
      updateAnalytics("failed");
      setStatus("error");
    }

    setTimeout(() => setStatus("idle"), 1500);
  };

  const subjectValue = form.watch("subject") || "";

  return (
    <div className="w-full md:max-w-3xl layout-standard md:section-padding-standard py-6 flex flex-col gap-6">
      {needsForwarding && (
        <div
          className={cn(
            "w-full px-4 py-4 rounded-lg border border-border space-y-3",
            forwardStatus !== "set" ? "bg-muted/30 shadow-md" : "bg-card"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium md:text-base text-sm">
              .{ext} mode requires forwarding setup
            </div>

            {forwardStatus === "set" ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-600">Forwarding set</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            ) : forwardStatus === "setting" ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-yellow-700">Setting…</span>
              </div>
            ) : forwardStatus === "error" ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-600">Failed</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                <span className="text-muted-foreground">Not set</span>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
            <div>
              <Label className="text-sm font-medium">Forward To</Label>
              <Input
                className="mt-2 h-[50px] border-border bg-input"
                placeholder="client@gmail.com"
                {...form.register("forwardTo")}
                disabled={forwardStatus === "setting"}
              />
              <p className="text-xs text-muted-foreground mt-2">
                This will configure{" "}
                <b className="text-primary">
                  support@globalpublishingdesk.com
                </b>{" "}
                forwarding in ImprovMX.
              </p>
            </div>

            <Button
              type="button"
              className="h-12 !rounded-sm mt-2 bg-primary hover:bg-primary-hover !text-primary-foreground"
              onClick={setForwarding}
              disabled={forwardStatus === "setting"}
            >
              Set Forwarding
            </Button>
          </div>

          <div className="pt-2 text-sm">
            <span className="text-muted-foreground">Send To (fixed): </span>
            <span className="font-medium">{FORWARDING_FIXED_TO}</span>
          </div>
        </div>
      )}

      {/* MAIN FORM */}
      <div>
        <Label className="text-sm font-medium">From Name</Label>
        <Input
          className="mt-2 h-[50px] border-border bg-input"
          {...form.register("fromName")}
          disabled={forwardingLocked}
        />
      </div>

      <div>
        <Label className="text-sm font-medium">From</Label>
        <div className="flex items-center gap-2">
          <Input
            className="mt-2 h-[50px] border-border bg-input"
            {...form.register("fromUser")}
            disabled={forwardingLocked}
          />
          <span>@</span>
          <Input
            className="mt-2 h-[50px] border-border bg-input"
            {...form.register("fromOrg")}
            disabled={forwardingLocked}
          />
          <span>.</span>
          <select
            {...form.register("ext")}
            className="mt-2 h-[50px] px-2 border rounded-md bg-input"
          >
            {FROM_EXTENSIONS.map((ext) => (
              <option key={ext} value={ext}>
                {ext === "com-direct" ? "com (no forwarding)" : ext}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Via / Sending Domain</Label>
        <select
          {...form.register("sendingDomain")}
          className="mt-2 h-[50px] w-full px-3 border rounded-md bg-input"
        >
          {SENDER_DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-2">
          This controls the authenticated via domain. The From address above
          stays custom.
        </p>
      </div>

      {!needsForwarding && (
        <div>
          <Label className="text-sm font-medium">To</Label>
          <Input
            className="mt-2 h-[50px] border-border bg-input"
            {...form.register("to")}
          />
        </div>
      )}

      <div>
        <Label className="text-sm font-medium">Reply To</Label>
        <Input
          className="mt-2 h-[50px] border-border bg-input"
          {...form.register("replyTo")}
          disabled={forwardingLocked}
        />
      </div>

      {!needsForwarding && (
        <>
          <div>
            <Label className="text-sm font-medium">CC</Label>
            <Input
              className="mt-2 h-[50px] border-border bg-input"
              {...form.register("cc")}
            />
          </div>

          <div>
            <Label className="text-sm font-medium">BCC</Label>
            <Input
              className="mt-2 h-[50px] border-border bg-input"
              {...form.register("bcc")}
            />
          </div>
        </>
      )}

      <div>
        <Label className="text-sm font-medium">Subject</Label>
        <Input
          className="mt-2 h-[50px] border-border bg-input"
          {...form.register("subject")}
          disabled={forwardingLocked}
        />
        <CharCounter value={subjectValue} limit={150} />
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="md:w-[300px] w-full h-12 bg-primary hover:bg-primary-hover !text-primary-foreground"
          onClick={() => document.getElementById("file-input")?.click()}
          disabled={forwardingLocked}
        >
          <Paperclip className="h-4 w-4" /> File Attachment
        </Button>

        <input
          id="file-input"
          type="file"
          multiple
          className="hidden"
          disabled={forwardingLocked}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;

            setAttachments((prev) => [...prev, ...files]);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1 text-sm border rounded-full bg-muted"
            >
              <span className="max-w-[200px] truncate">{file.name}</span>
              <button
                type="button"
                disabled={forwardingLocked}
                onClick={() =>
                  setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                <X className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      <RichEmailEditor
        value={html}
        onChange={setHtml}
        disabled={forwardingLocked}
        resetKey={editorResetKey}
      />

      <div className="flex items-center justify-between mt-4">
        <SendAnimation status={status} />

        <Button
          className="h-12 !rounded-sm hover:bg-primary-hover"
          onClick={form.handleSubmit(onSubmit)}
          disabled={status === "sending" || forwardingLocked}
        >
          <SendHorizonal className="h-4 w-4" />
          Send Email
        </Button>
      </div>
    </div>
  );
}
