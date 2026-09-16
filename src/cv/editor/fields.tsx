import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: string }) {
  return <label className="cv-field">
    <span className="cv-field-label">{label}{optional && <span className="cv-field-optional"> ({optional})</span>}</span>
    {children}
  </label>;
}

export function TextField({ label, value, onChange, placeholder, optional, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; optional?: string; type?: string }) {
  return <Field label={label} optional={optional}>
    <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </Field>;
}

export function AreaField({ label, value, onChange, placeholder, optional, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; optional?: string; rows?: number }) {
  return <Field label={label} optional={optional}>
    <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
  </Field>;
}

// A month-precision date input (YYYY-MM), which is what CV date ranges
// need — plain <input type="month"> gives every browser's native picker
// for free without hand-rolling one.
export function MonthField({ label, value, onChange, optional }: { label: string; value: string; onChange: (v: string) => void; optional?: string }) {
  return <Field label={label} optional={optional}>
    <Input type="month" value={value} onChange={e => onChange(e.target.value)} />
  </Field>;
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="cv-field-row">{children}</div>;
}

export { Label };
