export interface CreateChainSwapDto {
  from: string;
  to: string;
  userLockAmount: number;
  userAddress: string;
  refundPublicKey: string;
  claimPublicKey: string;
  preimageHash: string;
}
