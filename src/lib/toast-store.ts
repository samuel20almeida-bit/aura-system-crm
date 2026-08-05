export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
  undo?: () => void;
};

const MAX_VISIBLE = 3;

export function addToast(list: Toast[], toast: Omit<Toast, "id">, id: string): Toast[] {
  return [{ ...toast, id }, ...list].slice(0, MAX_VISIBLE);
}

export function removeToast(list: Toast[], id: string): Toast[] {
  return list.filter((t) => t.id !== id);
}
