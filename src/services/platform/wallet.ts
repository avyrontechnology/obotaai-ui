import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ledgerListSchema,
  topUpSchema,
  walletSchema,
  type TopUpInput,
  type Wallet,
} from "@/lib/schemas/platform";

export const walletKeys = {
  balance: ["wallet"] as const,
  ledger: ["wallet", "ledger"] as const,
};

export function useWallet() {
  return useQuery({
    queryKey: walletKeys.balance,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/wallet");
      return walletSchema.parse(raw);
    },
  });
}

export function useWalletLedger(limit = 50, type?: "topup" | "debit") {
  return useQuery({
    queryKey: [...walletKeys.ledger, { limit, type }] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (type) params.set("type", type);
      const raw = await apiClient<unknown>(`/wallet/ledger?${params.toString()}`);
      return ledgerListSchema.parse(raw).entries;
    },
  });
}

export function useTopUpWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TopUpInput) => {
      const raw = await apiClient<unknown>("/wallet/topup", {
        method: "POST",
        body: JSON.stringify(topUpSchema.parse(input)),
      });
      return walletSchema.parse(raw) as Wallet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.balance });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    },
  });
}
