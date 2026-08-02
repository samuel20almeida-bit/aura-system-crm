import clsx from "clsx";
import Link from "next/link";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary: "bg-accent text-bone hover:bg-accent-logo",
  ghost: "bg-surface text-ink border border-border hover:border-faint",
  danger: "bg-red text-bone hover:opacity-90",
};

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={clsx(base, variants[variant], className)} {...props} />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  href: string;
}) {
  return (
    <Link href={href} className={clsx(base, variants[variant], className)} {...props} />
  );
}
