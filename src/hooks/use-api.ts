"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import type { ApiContext } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/toast";

/**
 * Server state (backlog §63). Every key is prefixed with the workspace id so switching
 * workspaces can never show another workspace's cached data.
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  fn: (ctx: ApiContext) => Promise<T>,
  options: Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, "queryKey" | "queryFn"> & { keepPrevious?: boolean } = {},
) {
  const { ctx } = useSession();
  const { keepPrevious, ...rest } = options;
  return useQuery({
    queryKey: [ctx.workspaceId, ...key],
    queryFn: () => fn(ctx),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    ...rest,
  });
}

type MutationOptions<TVars, TResult> = {
  /** Query key prefixes (without workspace id) to invalidate on success. */
  invalidate?: readonly (readonly unknown[])[];
  success?: string | ((result: TResult, vars: TVars) => string | null);
  successDescription?: string | ((result: TResult, vars: TVars) => string | undefined);
  /** What failed, e.g. "Forecast run was not created." */
  failure: string;
  onSuccess?: (result: TResult, vars: TVars) => void;
};

export function useApiMutation<TVars, TResult>(fn: (ctx: ApiContext, vars: TVars) => Promise<TResult>, options: MutationOptions<TVars, TResult>) {
  const { ctx } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (vars: TVars) => fn(ctx, vars),
    onSuccess: (result, vars) => {
      for (const key of options.invalidate ?? []) queryClient.invalidateQueries({ queryKey: [ctx.workspaceId, ...key] });
      const title = typeof options.success === "function" ? options.success(result, vars) : options.success;
      const description = typeof options.successDescription === "function" ? options.successDescription(result, vars) : options.successDescription;
      if (title) toast({ tone: "success", title, description });
      options.onSuccess?.(result, vars);
    },
    onError: (error) => {
      toast({ tone: "critical", title: options.failure, description: errorMessage(error) });
    },
  });
}
