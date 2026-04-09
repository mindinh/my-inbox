import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: (failureCount, error) => {
                // Never retry authorization and user-mapping errors
                if ((error as any)?.response?.status === 403 || (error as any)?.isForbidden) return false;
                if ((error as any)?.response?.data?.code === 'SAP_USER_MAPPING_MISSING') return false;
                return failureCount < 1;
            },
            refetchOnWindowFocus: false,
        },
    },
});
