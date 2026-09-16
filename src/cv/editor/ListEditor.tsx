import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ListEditor<T extends { id: string }>({ items, onChange, newItem, renderItem, addLabel, itemLabel }: {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
  itemLabel: (item: T, index: number) => string;
}) {
  function add() { onChange([...items, newItem()]); }
  function update(id: string, patch: Partial<T>) { onChange(items.map(i => i.id === id ? { ...i, ...patch } : i)); }
  function remove(id: string) { onChange(items.filter(i => i.id !== id)); }
  function duplicate(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const index = items.findIndex(i => i.id === id);
    const copy = [...items];
    copy.splice(index + 1, 0, { ...item, id: crypto.randomUUID() });
    onChange(copy);
  }
  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex(i => i.id === id);
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange(copy);
  }

  return <div className="cv-list-editor">
    {items.map((item, idx) => <div key={item.id} className="cv-list-item">
      <div className="cv-list-item-toolbar">
        <span className="cv-list-item-title">{itemLabel(item, idx)}</span>
        <div className="cv-list-item-actions">
          <Button type="button" variant="ghost" size="icon-sm" disabled={idx === 0} onClick={() => move(item.id, -1)} aria-label="Monter"><ChevronUp size={15} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={idx === items.length - 1} onClick={() => move(item.id, 1)} aria-label="Descendre"><ChevronDown size={15} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => duplicate(item.id)} aria-label="Dupliquer"><Copy size={15} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(item.id)} aria-label="Supprimer"><Trash2 size={15} /></Button>
        </div>
      </div>
      <div className="cv-list-item-body">{renderItem(item, patch => update(item.id, patch))}</div>
    </div>)}
    <Button type="button" variant="outline" onClick={add} className="cv-list-add"><Plus size={15} /> {addLabel}</Button>
  </div>;
}
