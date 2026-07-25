import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen, rowsFrom } from './WorldScreenKit';

export default function ShopSellerScreen() {
  return (
    <WorldListScreen
      title="Seller Shop"
      subtitle="Sales"
      tone="shop"
      heroTitle="Seller activity"
      heroBody="Shows my-sales and transaction rows when those APIs are mounted."
      load={async () => {
        const [sales, transactions] = await Promise.all([
          api.getMySales().catch(() => []),
          api.getShopTransactions().catch(() => []),
        ]);
        return [
          ...rowsFrom(sales).map((row) => ({ ...row, type: row.type || 'sale' })),
          ...rowsFrom(transactions).map((row) => ({ ...row, type: row.type || 'transaction' })),
        ];
      }}
      emptyText="No seller activity yet"
    />
  );
}
