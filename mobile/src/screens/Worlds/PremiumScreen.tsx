import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen, openMaybeUrl } from './WorldScreenKit';

export default function PremiumScreen() {
  return (
    <WorldListScreen
      title="Premium"
      subtitle="Subscriptions"
      tone="shop"
      heroTitle="Choose a Cosmory plan"
      heroBody="Browse subscription plans and launch checkout when available."
      load={() => api.getSubscriptionPlans()}
      emptyText="No plans available"
      actions={[
        {
          label: 'Checkout',
          run: async (row) => {
            const result = await api.startPlanCheckout(row.id);
            await openMaybeUrl(result?.checkout_url || result?.url);
          },
        },
      ]}
    />
  );
}
