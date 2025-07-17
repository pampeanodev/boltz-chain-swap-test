import { SwapTreeDto } from "./swap-tree.dto";

export interface ChainSwapResponseDto {
  id: string;
  referralId?: string;
  lockupDetails: ChainSwapDataDto;
  claimDetails: ChainSwapDataDto;
}

export interface ChainSwapDataDto {
  amount: number;
  swapTree: SwapTreeDto;
  timeoutBlockHeight: number;
  serverPublicKey?: string;
  bip21?: string;
  lockupAddress?: string;
  blindingKey?: string;
  refundAddress?: string;
}
