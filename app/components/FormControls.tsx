type SelectFieldProps<T extends string> = {
  label: string;
  value: T | "";
  options: readonly T[];
  placeholder?: string;
  getLabel?: (value: T) => string;
  required?: boolean;
  onChange: (value: T | "") => void;
};

type TextFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "number" | "url";
  required?: boolean;
  onChange: (value: string) => void;
};

type TextAreaFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  placeholder,
  getLabel,
  required,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T | "")}
        required={required}
      >
        {placeholder ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel ? getLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField({
  label,
  value,
  placeholder,
  type = "text",
  required,
  onChange,
}: TextFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TextAreaField({ label, value, placeholder, onChange }: TextAreaFieldProps) {
  return (
    <label className="field sm:col-span-2">
      <span>{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
