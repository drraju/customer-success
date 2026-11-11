"use client";

export function AutoForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onChange={(event) => {
        event.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}

export function ConfirmSubmit({
  action,
  message,
  label,
  fields,
  className = "btn danger",
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  label: string;
  fields: Record<string, string>;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button className={className} type="submit">
        {label}
      </button>
    </form>
  );
}
