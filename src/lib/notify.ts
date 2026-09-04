import { toast } from "sonner";
import { ApiError } from "./api-client";

/** Human-readable message from anything a mutation can throw. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

interface NotifyOptions {
  description?: string;
}

/** Themed toast shortcuts. Errors include the backend message when available. */
export const notify = {
  success: (title: string, options?: NotifyOptions) =>
    toast.success(title, { description: options?.description }),
  error: (title: string, error?: unknown) =>
    toast.error(title, { description: error === undefined ? undefined : errorMessage(error) }),
  info: (title: string, options?: NotifyOptions) =>
    toast.info(title, { description: options?.description }),
  loading: (title: string) => toast.loading(title),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
