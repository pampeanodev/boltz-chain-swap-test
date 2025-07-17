import axios from "axios";
import { CreateChainSwapDto } from "./dto/create-chain-swap.dto";
import { ChainSwapResponseDto } from "./dto/chain-swap-response.dto";

export class BoltzClient {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async createChainSwap(
    chainSwap: CreateChainSwapDto,
  ): Promise<ChainSwapResponseDto> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/v2/swap/chain`,
        chainSwap,
      );
      return response.data;
    } catch (error) {
      console.error(
        "Failed to create chain swap:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async getSwapClaimDetails(id: string) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/v2/swap/submarine/${id}/claim`,
      );
      return response.data;
    } catch (error) {
      console.error(
        `Failed to get swap claim details for ID ${id}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async claimChainSwap(
    swapId: string,
    preimage: string,
    signature: { partialSignature: string; pubNonce: string },
    toSign: { index: number; transaction: string; pubNonce: string },
  ): Promise<{ pubNonce: string; partialSignature: string }> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/v2/swap/chain/${swapId}/claim`,
        {
          preimage,
          signature,
          toSign,
        },
      );
      return response.data;
    } catch (error) {
      console.error(
        `Failed to claim chain swap for ID ${swapId}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async claimBTC(claimTxHex: string) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/v2/chain/BTC/transaction`,
        {
          hex: claimTxHex,
        },
      );
      return response.data;
    } catch (error) {
      console.error(
        "Failed to claim BTC:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
