export interface SwapTreeDto {
  claimLeaf: ClaimLeaf;
  refundLeaf: RefundLeaf;
}

export interface ClaimLeaf {
  version: number;
  output: string;
}

export interface RefundLeaf {
  version: number;
  output: string;
}
