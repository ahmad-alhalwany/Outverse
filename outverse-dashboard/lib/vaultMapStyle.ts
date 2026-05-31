export type VaultMapStyle = 'street' | 'cosmic';

const STORAGE_KEY = 'outverse-vault-map-style';

export function readVaultMapStyle(): VaultMapStyle {
  if (typeof window === 'undefined') return 'street';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'cosmic' ? 'cosmic' : 'street';
}

export function persistVaultMapStyle(style: VaultMapStyle) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, style);
}

export function toggleVaultMapStyle(current: VaultMapStyle): VaultMapStyle {
  return current === 'street' ? 'cosmic' : 'street';
}
