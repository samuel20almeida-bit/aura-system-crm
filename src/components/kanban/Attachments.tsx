"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addFileAttachment, addLinkAttachment, removeAttachment } from "@/lib/actions/tasks";
import { useToast } from "@/components/ui/Toast";
import { normalizeLinkUrl } from "@/lib/links";
import type { Tables } from "@/lib/supabase/database.types";

const MAX_MB = 25;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/** A chave do storage aceita um alfabeto estreito: acento e espaço de um nome brasileiro
 *  ("Proposta – Ação final.pdf") quebram o upload. O nome original fica na coluna filename. */
function storageSafeName(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "arquivo";
}

export function Attachments({
  taskId,
  attachments,
}: {
  taskId: string;
  attachments: Tables<"task_attachments">[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      notify("error", `"${file.name}" tem mais de ${MAX_MB} MB. Suba num link e cole aqui.`);
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const path = `${taskId}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
    const { error } = await supabase.storage.from("task-attachments").upload(path, file);
    setUploading(false);
    if (error) {
      notify("error", "Não foi possível enviar o arquivo.");
      return;
    }
    startTransition(async () => {
      try {
        await addFileAttachment(taskId, file.name, path);
        notify("success", "Arquivo anexado.");
        router.refresh();
      } catch {
        // Sem isto o objeto ficava no bucket sem nenhuma linha apontando para
        // ele: invisível na interface, ocupando espaço para sempre.
        await supabase.storage.from("task-attachments").remove([path]);
        notify("error", "Não foi possível registrar o anexo.");
      }
    });
  }

  return (
    <div>
      <div className="label mb-1.5">ANEXOS</div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <span
            key={a.id}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted"
          >
            {/* Um nome longo sem espaços não quebra linha e estourava a largura
                do painel — daí max-w + truncate, com o nome inteiro no title. */}
            <a
              href={a.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              title={a.filename}
              className="max-w-[220px] truncate hover:text-accent"
            >
              {a.filename}
            </a>
            <button
              onClick={() =>
                startTransition(async () => {
                  try {
                    await removeAttachment(a.id);
                    router.refresh();
                  } catch {
                    notify("error", "Não foi possível remover o anexo.");
                  }
                })
              }
              className="hidden text-faint hover:text-red group-hover:block"
              aria-label={`Remover ${a.filename}`}
            >
              ✕
            </button>
          </span>
        ))}

        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <button
          disabled={uploading || pending}
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-faint hover:border-faint"
        >
          {uploading ? "Enviando…" : "+ arquivo"}
        </button>
        <button
          onClick={() => setLinkOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-faint hover:border-faint"
        >
          + link
        </button>
      </div>

      {linkOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // "figma.com/file/abc" — o que o Chrome mostra na barra — virava um
            // caminho relativo no href e o clique dava 404 sem nenhum aviso.
            const normalized = normalizeLinkUrl(linkUrl);
            if (!normalized.ok) {
              notify("error", normalized.message);
              return;
            }
            startTransition(async () => {
              try {
                await addLinkAttachment(taskId, linkName.trim() || normalized.url, normalized.url);
                setLinkUrl("");
                setLinkName("");
                setLinkOpen(false);
                notify("success", "Link anexado.");
                router.refresh();
              } catch {
                notify("error", "Não foi possível anexar o link.");
              }
            });
          }}
          className="mt-2 flex gap-2"
        >
          <input
            autoFocus
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Nome"
            className="w-28 rounded-lg border border-border bg-bone px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="figma.com/… ou https://…"
            className="flex-1 rounded-lg border border-border bg-bone px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button type="submit" disabled={pending} className="rounded-lg bg-accent px-3 text-xs text-bone">
            Anexar
          </button>
        </form>
      )}
    </div>
  );
}
