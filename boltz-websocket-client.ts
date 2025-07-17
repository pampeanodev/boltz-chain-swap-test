import { WebSocket } from "ws";
import { Subject } from "rxjs";

export class BoltzWebsocketClient {
  private ws: WebSocket;
  private messageSubject = new Subject<any>();
  private webSocketEndpoint: string;
  private isConnected = false;

  constructor(webSocketUrl: string) {
    this.webSocketEndpoint = webSocketUrl;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to Boltz WebSocket: ${this.webSocketEndpoint}`);

      this.ws = new WebSocket(this.webSocketEndpoint);

      this.ws.on("open", () => {
        console.log("Connected to Boltz WebSocket");
        this.isConnected = true;
        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(
            "WebSocket message received:",
            JSON.stringify(message, null, 2),
          );
          this.messageSubject.next(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.isConnected = false;
        reject(error);
      });

      this.ws.on("close", (code, reason) => {
        console.warn(
          `Disconnected from Boltz WebSocket. Code: ${code}, Reason: ${reason}`,
        );
        this.isConnected = false;
      });

      // Set timeout for connection
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);
    });
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
      this.isConnected = false;
    }
  }

  subscribe(channel: string, args: string[]) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        op: "subscribe",
        channel,
        args,
      };
      console.log(
        "Subscribing to channel:",
        JSON.stringify(subscribeMessage, null, 2),
      );
      this.ws.send(JSON.stringify(subscribeMessage));
    } else {
      console.error("WebSocket is not connected - cannot subscribe");
    }
  }

  unsubscribe(channel: string, args: string[]) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = {
        op: "unsubscribe",
        channel,
        args,
      };
      console.log(
        "Unsubscribing from channel:",
        JSON.stringify(unsubscribeMessage, null, 2),
      );
      this.ws.send(JSON.stringify(unsubscribeMessage));
    } else {
      console.error("WebSocket is not connected - cannot unsubscribe");
    }
  }

  onMessage() {
    return this.messageSubject.asObservable();
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws.readyState === WebSocket.OPEN;
  }
}
