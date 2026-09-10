import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getSubscriptionsApi,
  getSubscriptionByIdApi,
  createSubscriptionApi,
  updateSubscriptionApi,
  transitionSubscriptionApi,
  deleteSubscriptionApi,
  getRecoveryCandidatesApi,
  getPendingPullOutsApi,
} from "../../api/admin/subscriptions";

/**
 * Anything that changes a subscription can change which ONUs are free, so the
 * ONU list is invalidated alongside.
 */
const invalidateRelated = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
  queryClient.invalidateQueries({ queryKey: ["onus"] });
  // Revoking, un-revoking and closing all move an account between the two
  // recovery lists, so both are stale after any transition.
  queryClient.invalidateQueries({ queryKey: ["recoveryCandidates"] });
  queryClient.invalidateQueries({ queryKey: ["pendingPullOuts"] });
};

export const useGetSubscriptions = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["subscriptions", filters],
    queryFn: () => getSubscriptionsApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
};

export const useGetSubscriptionById = (subscriptionId) => {
  return useQuery({
    queryKey: ["subscriptions", subscriptionId],
    queryFn: () => getSubscriptionByIdApi(subscriptionId),
    enabled: !!subscriptionId,
    staleTime: 10 * 60 * 1000,
  });
};

export const useCreateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubscriptionApi,
    onSuccess: () => {
      // Says what happens next: creating the paperwork does not start service.
      toast.success("Subscription created — activate it to start service");
      invalidateRelated(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create subscription");
    },
  });
};

export const useUpdateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subscriptionId, data }) => updateSubscriptionApi(subscriptionId, data),
    onSuccess: (_res, variables) => {
      toast.success("Subscription updated successfully");
      invalidateRelated(queryClient);
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", variables.subscriptionId],
      });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update subscription");
    },
  });
};

export const useTransitionSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subscriptionId, action, reason, outcome }) =>
      transitionSubscriptionApi(subscriptionId, { action, reason, outcome }),
    onSuccess: (res, variables) => {
      // Each transition says what it actually did, because they differ in ways
      // that matter to whoever pressed the button — especially the two that
      // decide where a modem ends up.
      const messages = {
        activate: "Subscription activated — billing starts from today",
        terminate: "Subscription terminated",
        revoke: "Marked for pull-out — paying no longer restores service",
        unrevoke: "Pull-out cancelled — the account is suspended again",
      };

      if (variables.action === "close") {
        toast.success(
          variables.outcome === "recovered"
            ? res?.data?.unblacklistQueued
              ? "Closed — the modem is back in stock and is being un-blacklisted"
              : "Closed — the modem is back in stock"
            : "Closed — the modem is written off and stays blacklisted",
        );
      } else {
        toast.success(messages[variables.action] ?? "Subscription updated");
      }

      invalidateRelated(queryClient);
    },
    onError: (error) => {
      // The API explains refusals precisely ("attach an ONU first", "restored by
      // payment, not by hand"), so its message is more useful than a generic one.
      toast.error(error.response?.data?.message || "Could not change the subscription");
    },
  });
};

export const useDeleteSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSubscriptionApi,
    onSuccess: () => {
      toast.success("Subscription deleted successfully");
      invalidateRelated(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to delete subscription");
    },
  });
};

export const useGetRecoveryCandidates = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["recoveryCandidates", filters],
    queryFn: () => getRecoveryCandidatesApi(filters),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    ...options,
  });
};

export const useGetPendingPullOuts = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["pendingPullOuts", filters],
    queryFn: () => getPendingPullOutsApi(filters),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    ...options,
  });
};
