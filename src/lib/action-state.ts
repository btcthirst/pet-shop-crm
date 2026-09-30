import { isAppError, type FieldIssue } from "@/lib/errors";

/** Shape every catalogue Server Action returns, so forms share one contract. */
export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  createdId?: string;
  message?: string;
};

export const initialActionState: ActionState = {};

/**
 * Maps a thrown error onto the action state: Zod issues become per-field messages,
 * AppError becomes a single message, anything else a neutral fallback.
 */
export function toActionState(error: unknown, fallbackMessage: string): ActionState {
  if (isAppError(error)) {
    const details = error.details as { fields?: FieldIssue[]; field?: string } | undefined;

    if (details?.fields?.length) {
      return {
        error: error.message,
        fieldErrors: Object.fromEntries(details.fields.map((item) => [item.path, item.message])),
      };
    }

    if (details?.field) {
      return { error: error.message, fieldErrors: { [details.field]: error.message } };
    }

    return { error: error.message };
  }

  return { error: fallbackMessage };
}
