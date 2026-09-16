import { useTranslation } from "react-i18next";
import { Copy, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CvDraft } from "../types/draft";
import { templateConfig } from "../templates/registry";

export default function MyCvsDialog({ open, onOpenChange, drafts, renamingId, renameValue, onStartRename, onRenameValueChange, onConfirmRename, onOpen, onDuplicate, onDelete }: {
  open: boolean; onOpenChange: (open: boolean) => void; drafts: CvDraft[];
  renamingId: string | null; renameValue: string;
  onStartRename: (id: string, current: string) => void; onRenameValueChange: (v: string) => void; onConfirmRename: () => void;
  onOpen: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const m = "cv.myCvs.";

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="cv-drafts-dialog">
      <DialogHeader><DialogTitle>{t(m + "title")}</DialogTitle></DialogHeader>
      {drafts.length === 0 && <p className="cv-drafts-empty">{t(m + "empty")}</p>}
      <div className="cv-drafts-list">
        {drafts.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(draft => <div key={draft.id} className="cv-draft-row">
          <div className="cv-draft-info" onClick={() => onOpen(draft.id)}>
            {renamingId === draft.id
              ? <Input autoFocus value={renameValue} onChange={e => onRenameValueChange(e.target.value)} onBlur={onConfirmRename} onKeyDown={e => e.key === "Enter" && onConfirmRename()} onClick={e => e.stopPropagation()} />
              : <strong>{draft.name}</strong>}
            <span className="cv-draft-meta">{t(m + "modified")} {new Date(draft.updatedAt).toLocaleDateString()} — {t(templateConfig(draft.templateId).nameKey)}</span>
          </div>
          <div className="cv-draft-actions">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onOpen(draft.id)} aria-label={t(m + "open")}><FolderOpen size={15} /></Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onStartRename(draft.id, draft.name)} aria-label={t(m + "rename")}><Pencil size={15} /></Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onDuplicate(draft.id)} aria-label={t(m + "duplicate")}><Copy size={15} /></Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onDelete(draft.id)} aria-label={t(m + "delete")}><Trash2 size={15} /></Button>
          </div>
        </div>)}
      </div>
    </DialogContent>
  </Dialog>;
}
