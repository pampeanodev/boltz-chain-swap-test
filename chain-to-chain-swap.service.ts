import {randomBytes} from "crypto";
import {ECPairFactory, ECPairInterface} from "ecpair";
import * as bitcoin from "bitcoinjs-lib";
import {crypto as LiquidCrypto} from "liquidjs-lib";
import zkpInit, {Secp256k1ZKP} from "@vulpemventures/secp256k1-zkp";
import * as ecc from "tiny-secp256k1";

import {
    detectSwap,
    Musig,
    OutputType,
    SwapTreeSerializer,
    targetFee,
    TaprootUtils,
    constructClaimTransaction,
} from "boltz-core";
import {TaprootUtils as LiquidTaprootUtils, init} from "boltz-core/dist/lib/liquid";
import {BoltzClient} from "./boltz-client";
import {BoltzWebsocketClient} from "./boltz-websocket-client";
import {ChainSwapResponseDto} from "./dto/chain-swap-response.dto";
import {Transaction} from "bitcoinjs-lib";

// Mock entities for testing
interface WithdrawChainSwapTransaction {
    id: number;
    swapId: string;
    userAddress: string;
    claimPublicKey: string;
    claimSwapTree: string;
    claimBlindingKey: string;
    lockupPublicKey: string;
    lockupSwapTree: string;
    preimage: string;
    minerFees: number;
    boltzFee: number;
    feeRate: number;
}

// Mock enums for testing
enum ChainSwapTransactionStatus {
    CREATED = 0,
    LOCKUP_PENDING = 1,
    LOCKUP_CONFIRMED = 2,
    CLAIM_PENDING = 3,
    CLAIM_CONFIRMED = 4,
    LOCKUP_FAILED = 5,
    CLAIM_FAILED = 6,
}

export class ChainToChainSwapService {
    private bitcoinNetwork: bitcoin.networks.Network;
    private keyPair: ECPairInterface;
    private zkp: Secp256k1ZKP;
    private boltzClient: BoltzClient;
    private boltzWebSocketClient: BoltzWebsocketClient;

    constructor(
        boltzApiUrl: string,
        boltzWebSocketUrl: string,
        network: "mainnet" | "testnet" | "regtest" = "regtest"
    ) {
        this.boltzClient = new BoltzClient(boltzApiUrl);
        this.boltzWebSocketClient = new BoltzWebsocketClient(boltzWebSocketUrl);
        this.bitcoinNetwork =
            network === "mainnet"
                ? bitcoin.networks.bitcoin
                : network === "testnet"
                    ? bitcoin.networks.testnet
                    : bitcoin.networks.regtest;
    }

    async initialize() {
        this.zkp = await zkpInit();
        this.keyPair = ECPairFactory(ecc).makeRandom();
        init(this.zkp)

        // Connect to WebSocket
        try {
            await this.boltzWebSocketClient.connect();
            console.log("WebSocket client connected successfully");
        } catch (error) {
            console.error("Failed to connect to WebSocket:", error);
            throw error;
        }
    }

    async getPubKeyHex(): Promise<string> {
        return this.keyPair.publicKey.toString("hex");
    }

    async createClaimTransaction(
        preimage: Buffer,
        swapEntity: WithdrawChainSwapTransaction,
        lockupTransactionHex: string
    ) {
        console.log("Creating claim transaction...");
        console.log("- Preimage:", preimage.toString("hex"));
        console.log("- Lockup transaction hex:", lockupTransactionHex);
        console.log("- Swap entity claim public key:", swapEntity.claimPublicKey);

        const boltzPublicKey = Buffer.from(swapEntity.claimPublicKey, "hex");

        // Create a musig signing session and tweak it with the Taptree of the swap scripts
        const musig = new Musig(this.zkp, this.keyPair, randomBytes(32), [
            boltzPublicKey,
            this.keyPair.publicKey,
        ]);
        const tweakedKey = TaprootUtils.tweakMusig(
            musig,
            SwapTreeSerializer.deserializeSwapTree(swapEntity.claimSwapTree).tree
        );

        console.log("- Tweaked key:", tweakedKey.toString("hex"));

        const lockupTx = bitcoin.Transaction.fromHex(lockupTransactionHex);
        console.log("- Lockup transaction parsed, outputs:", lockupTx.outs.length);

        const swapOutput = detectSwap(tweakedKey, lockupTx);

        console.log("- detectSwap result:", swapOutput);

        if (swapOutput === undefined) {
            console.error("ERROR: No swap output found in lockup transaction");
            console.error("- Transaction outputs:");
            lockupTx.outs.forEach((out, index) => {
                console.error(`  Output ${index}:`, {
                    value: out.value,
                    script: out.script.toString("hex"),
                    scriptLength: out.script.length,
                });
            });
            console.error("- Looking for tweaked key:", tweakedKey.toString("hex"));
            throw new Error("No swap output found in lockup transaction");
        }

        // Create a claim transaction to be signed cooperatively via a key path spend
        const transaction = targetFee(swapEntity.feeRate, (fee) =>
            constructClaimTransaction(
                [
                    {
                        ...swapOutput,
                        preimage,
                        keys: this.keyPair,
                        cooperative: true,
                        type: OutputType.Taproot,
                        txHash: lockupTx.getHash(),
                    } as any,
                ],
                bitcoin.address.toOutputScript(
                    swapEntity.userAddress,
                    this.bitcoinNetwork
                ),
                fee,
                false,
            )
        );

        return {musig, transaction, swapOutput, boltzPublicKey};
    }

    async startBoltzChainSwapWithListeners(
        userBtcAddress: string,
        amount: number
    ): Promise<{
        chainSwap: ChainSwapResponseDto;
        mockSwapEntity: WithdrawChainSwapTransaction;
    }> {
        if (!userBtcAddress || amount <= 0) {
            throw new Error("Invalid address or amount");
        }

        // Calculate proper lockup amount including fees
        const sendParams = await this.calculateLockupSend(amount);

        // Generate preimage and preimage hash for the chain swap
        const preimage = randomBytes(32);
        const preimageHash = LiquidCrypto.sha256(preimage);

        console.log("Creating chain swap with WebSocket listeners...");
        console.log("- Preimage:", preimage.toString("hex"));
        console.log("- Preimage hash:", preimageHash.toString("hex"));
        console.log("- User BTC address:", userBtcAddress);
        console.log("- Amount:", amount);
        console.log("- Lockup amount:", sendParams.lockupAmount);
        console.log("- Boltz fee:", sendParams.boltzFee);
        console.log("- Miner fees:", sendParams.minerFees);
        console.log("- Fee rate:", sendParams.feeRate);

        const chainSwap = await this.boltzClient.createChainSwap({
            from: "L-BTC",
            to: "BTC",
            userLockAmount: sendParams.lockupAmount,
            userAddress: userBtcAddress,
            refundPublicKey: await this.getPubKeyHex(),
            claimPublicKey: await this.getPubKeyHex(),
            preimageHash: preimageHash.toString("hex"),
        });

        if (!chainSwap || !chainSwap.id) {
            throw new Error("Error creating Chain Swap");
        }

        console.log("Chain swap created successfully:", chainSwap);

        // Create mock swap entity for testing
        const mockSwapEntity: WithdrawChainSwapTransaction = {
            id: 1,
            swapId: chainSwap.id,
            userAddress: userBtcAddress,
            claimPublicKey: chainSwap.claimDetails.serverPublicKey,
            claimSwapTree: JSON.stringify(chainSwap.claimDetails.swapTree),
            claimBlindingKey: chainSwap.claimDetails.blindingKey,
            lockupPublicKey: chainSwap.lockupDetails.serverPublicKey,
            lockupSwapTree: JSON.stringify(chainSwap.lockupDetails.swapTree),
            feeRate: sendParams.feeRate,
            boltzFee: sendParams.boltzFee,
            minerFees: sendParams.minerFees,
            preimage: preimage.toString("hex"),
        };

        // Subscribe to swap updates
        this.boltzWebSocketClient.subscribe("swap.update", [chainSwap.id]);
        this.handleChainSwapStatusUpdates(mockSwapEntity, "test-user-id");

        return {chainSwap, mockSwapEntity};
    }

    private handleChainSwapStatusUpdates(
        chainSwapEntity: WithdrawChainSwapTransaction,
        userId: string
    ) {
        console.log(
            `Setting up WebSocket listener for swap: ${chainSwapEntity.swapId}`
        );

        this.boltzWebSocketClient.onMessage().subscribe(async (msg) => {
            console.log("\n=== WebSocket Message Received ===");
            console.log("Raw message:", JSON.stringify(msg, null, 2));

            if (msg.event !== "update") {
                console.log("Ignoring non-update event:", msg.event);
                return;
            }

            if (
                !msg.args ||
                !msg.args[0] ||
                msg.args[0].id !== chainSwapEntity.swapId
            ) {
                console.log(
                    "Message not for our swap ID. Expected:",
                    chainSwapEntity.swapId,
                    "Got:",
                    msg.args?.[0]?.id
                );
                return;
            }

            console.log(`Processing update for swap: ${chainSwapEntity.swapId}`);
            console.log("Status:", msg.args[0].status);

            try {
                switch (msg.args[0].status) {
                    case "swap.created": {
                        console.log(
                            `✅ Swap created for chain swap: '${chainSwapEntity.swapId}' - Waiting for coins to be locked`
                        );
                        await this.updateChainSwapStatus(
                            chainSwapEntity.id,
                            ChainSwapTransactionStatus.LOCKUP_PENDING
                        );
                        break;
                    }

                    case "transaction.lockup": {
                        console.log(
                            `✅ Lockup transaction found for chain swap: '${chainSwapEntity.swapId}'`
                        );
                        console.log("Transaction details:", msg.args[0].transaction);
                        await this.updateChainSwapStatus(
                            chainSwapEntity.id,
                            ChainSwapTransactionStatus.LOCKUP_CONFIRMED,
                            msg.args[0].transaction?.id
                        );
                        break;
                    }

                    case "transaction.server.mempool": {
                        await this.updateChainSwapStatus(
                            chainSwapEntity.id,
                            ChainSwapTransactionStatus.CLAIM_PENDING,
                            msg.args[0].transaction?.id
                        );
                        break;
                    }

                    case "transaction.server.confirmed": {
                        await this.broadcastCoSignedClaimTransaction(
                            chainSwapEntity,
                            msg.args[0].transaction?.hex,
                            userId
                        );
                        break;
                    }

                    case "transaction.claimed": {
                        console.log(
                            `✅ Swap successfully claimed by Boltz for chain swap: '${chainSwapEntity.swapId}'`
                        );
                        await this.updateChainSwapStatus(
                            chainSwapEntity.id,
                            ChainSwapTransactionStatus.CLAIM_CONFIRMED
                        );
                        break;
                    }

                    case "transaction.lockupFailed": {
                        console.log(
                            `❌ Lockup failed for chain swap: '${chainSwapEntity.swapId}'`
                        );
                        await this.updateChainSwapStatus(
                            chainSwapEntity.id,
                            ChainSwapTransactionStatus.LOCKUP_FAILED
                        );
                        this.boltzWebSocketClient.unsubscribe("swap.update", [
                            chainSwapEntity.swapId,
                        ]);
                        break;
                    }

                    case "transaction.claimFailed": {
                        console.log(
                            `❌ Claim failed for chain swap: '${chainSwapEntity.swapId}'`
                        );
                        await this.updateChainSwapStatus(
                            chainSwapEntity.id,
                            ChainSwapTransactionStatus.CLAIM_FAILED
                        );
                        this.boltzWebSocketClient.unsubscribe("swap.update", [
                            chainSwapEntity.swapId,
                        ]);
                        break;
                    }

                    case "swap.expired": {
                        console.log(
                            `❌ Swap expired for chain swap: '${chainSwapEntity.swapId}'`
                        );
                        await this.updateChainSwapStatus(
                            chainSwapEntity.id,
                            ChainSwapTransactionStatus.LOCKUP_FAILED
                        );
                        this.boltzWebSocketClient.unsubscribe("swap.update", [
                            chainSwapEntity.swapId,
                        ]);
                        break;
                    }

                    default:
                        console.log(
                            `⚠️ Chain swap status '${msg.args[0].status}' not handled for swap: '${chainSwapEntity.swapId}'`
                        );
                        break;
                }
            } catch (e) {
                console.error("❌ Error processing WebSocket message:", e);
                await this.updateChainSwapStatus(
                    chainSwapEntity.id,
                    ChainSwapTransactionStatus.CLAIM_FAILED
                );
                this.boltzWebSocketClient.unsubscribe("swap.update", [
                    chainSwapEntity.swapId,
                ]);
            }
        });
    }

    private async broadcastCoSignedClaimTransaction(
        chainSwapEntity: WithdrawChainSwapTransaction,
        transactionHex: string,
        userId: string,
    ) {
        console.log(`Creating claim transaction for chain swap: '${chainSwapEntity.swapId}'`);
        const preimageBuffer = Buffer.from(chainSwapEntity.preimage, "hex");

        try {
            const claimTransactionDetails = await this.createClaimTransaction(
                preimageBuffer,
                chainSwapEntity,
                transactionHex,
            );

            console.log("✅ Claim transaction created successfully");

            const boltzPartialSignature = await this.getBoltzPartialSignature(
                preimageBuffer,
                chainSwapEntity,
                Buffer.from(claimTransactionDetails.musig.getPublicNonce()),
                claimTransactionDetails.transaction,
            );

            await this.performChainSwapClaim(
                claimTransactionDetails,
                chainSwapEntity,
                boltzPartialSignature,
            );

            console.log("✅ Claim transaction submitted");
        } catch (claimError) {
            console.error("❌ Error during claim process:", claimError);
            await this.updateChainSwapStatus(
                chainSwapEntity.id,
                ChainSwapTransactionStatus.CLAIM_FAILED
            );
            throw claimError;
        }
    }

    // Mock implementation for testing
    private async updateChainSwapStatus(
        chainSwapTransactionEntityId: number,
        status: ChainSwapTransactionStatus,
        lockupTransactionHash?: string,
        claimTransactionHash?: string,
        preimageHash?: string
    ) {
        console.log(
            `Updating swap status to: ${ChainSwapTransactionStatus[status]}`
        );
        if (lockupTransactionHash) console.log("Lockup TX:", lockupTransactionHash);
        if (claimTransactionHash) console.log("Claim TX:", claimTransactionHash);
        if (preimageHash) console.log("Preimage hash:", preimageHash);
    }

    private async finishChainSwap(
        chainSwapEntity: WithdrawChainSwapTransaction,
        userId: string,
        amount: number
    ) {
        await this.updateChainSwapStatus(
            chainSwapEntity.id,
            ChainSwapTransactionStatus.CLAIM_CONFIRMED
        );
        console.log("✅ Chain swap finished successfully");
    }

    async getBoltzPartialSignature(
        preimage: Buffer,
        swapEntity: WithdrawChainSwapTransaction,
        claimPubNonce: Buffer,
        claimTransaction: Transaction
    ) {
        console.log("Getting Boltz partial signature...");

        const serverClaimDetails = await this.boltzClient.getChainSwapClaimDetails(
            swapEntity.swapId
        );
        const boltzPublicKey = Buffer.from(swapEntity.lockupPublicKey, "hex");

        const musig = new Musig(this.zkp, this.keyPair, randomBytes(32), [
            boltzPublicKey,
            this.keyPair.publicKey,
        ]);
        LiquidTaprootUtils.tweakMusig(
            musig,
            SwapTreeSerializer.deserializeSwapTree(swapEntity.lockupSwapTree).tree
        );

        musig.aggregateNonces([
            [boltzPublicKey, Buffer.from(serverClaimDetails.pubNonce, "hex")],
        ]);
        musig.initializeSession(
            Buffer.from(serverClaimDetails.transactionHash, "hex")
        );
        const partialSig = musig.signPartial();

        const ourClaimDetails = await this.boltzClient.claimChainSwap(
            swapEntity.swapId,
            preimage.toString("hex"),
            {
                partialSignature: Buffer.from(partialSig).toString("hex"),
                pubNonce: Buffer.from(musig.getPublicNonce()).toString("hex"),
            },
            {
                index: 0,
                transaction: claimTransaction.toHex(),
                pubNonce: claimPubNonce.toString("hex"),
            }
        );

        console.log("✅ Boltz partial signature obtained");

        return {
            pubNonce: Buffer.from(ourClaimDetails.pubNonce, "hex"),
            partialSignature: Buffer.from(ourClaimDetails.partialSignature, "hex"),
        };
    }

    private async performChainSwapClaim(
        claimDetails: {
            musig: any;
            transaction: any;
            swapOutput: any;
            boltzPublicKey: any;
        },
        chainSwapEntity: WithdrawChainSwapTransaction,
        boltzPartialSig: { pubNonce: any; partialSignature: any }
    ) {
        console.log("Performing chain swap claim...");

        // Aggregate the nonces
        claimDetails.musig.aggregateNonces([
            [claimDetails.boltzPublicKey, boltzPartialSig.pubNonce],
        ]);

        // Initialize the session to sign the claim transaction
        claimDetails.musig.initializeSession(
            claimDetails.transaction.hashForWitnessV1(
                0,
                [claimDetails.swapOutput.script],
                [claimDetails.swapOutput.value],
                Transaction.SIGHASH_DEFAULT
            )
        );

        // Add the partial signature from Boltz
        claimDetails.musig.addPartial(
            claimDetails.boltzPublicKey,
            boltzPartialSig.partialSignature
        );

        // Create our partial signature
        claimDetails.musig.signPartial();

        // Witness of the input to the aggregated signature
        claimDetails.transaction.ins[0].witness = [
            claimDetails.musig.aggregatePartials(),
        ];

        // Broadcast the finalized transaction
        await this.boltzClient.claimBTC(claimDetails.transaction.toHex());

        console.log(
            `✅ Sent claim transaction for chain swap: '${chainSwapEntity.swapId}'`
        );
    }

    private async calculateLockupSend(amount: number) {
        const claimTxFeeRate = await this.boltzClient.getNetworkFee("BTC");
        const swapPairs = await this.boltzClient.getChainSwapFee();
        const boltzFeePercentage = swapPairs["L-BTC"]["BTC"].fees.percentage;
        const serverFee = swapPairs["L-BTC"]["BTC"].fees.minerFees.server;
        const userClaimFee = swapPairs["L-BTC"]["BTC"].fees.minerFees.user.claim;
        const minerFees = serverFee + userClaimFee;
        const lockupAmount = Math.ceil((amount + minerFees) / (1 - boltzFeePercentage / 100));
        const boltzFee = lockupAmount - amount - minerFees;

        return {
            lockupAmount,
            minerFees,
            boltzFee,
            feeRate: claimTxFeeRate.fee
        };
    }

    // Method to disconnect WebSocket
    disconnect() {
        this.boltzWebSocketClient.disconnect();
    }

    // Method to check WebSocket connection status
    isWebSocketConnected(): boolean {
        return this.boltzWebSocketClient.isWebSocketConnected();
    }
}
