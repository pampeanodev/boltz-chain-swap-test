# Boltz Chain Swap WebSocket Test

A specialized WebSocket-based test environment for debugging Boltz chain swap `detectSwap` issues with real-time monitoring.

## Overview

This project provides a WebSocket-focused testing framework for Boltz Protocol chain swaps, specifically designed to debug and test the swap detection functionality with real-time status updates. It implements comprehensive WebSocket monitoring for the complete swap lifecycle.

## Features

- **WebSocket-First Design**: Real-time swap status monitoring via WebSocket connections
- **Chain-to-Chain Swap Service**: Complete implementation of Boltz Protocol chain swaps
- **Bitcoin/Liquid Integration**: Support for both Bitcoin and Liquid networks
- **Comprehensive Logging**: Detailed debugging information throughout the swap process
- **Regtest Support**: Configured for local regtest environment

## Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- Local Boltz instance running on regtest network
- Bitcoin Core and Elements Core (for regtest)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd boltz-chain-swap-test
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure your environment:
   - Update the configuration variables in `test-websocket.ts`
   - Ensure your local Boltz instance is running on `http://localhost:9001`
   - Set up your regtest Bitcoin address

## Configuration

The project uses the following default configuration:

- **Boltz API URL**: `http://localhost:9001`
- **Boltz WebSocket URL**: `ws://localhost:9001/v2/ws`
- **Network**: `regtest`
- **Default Amount**: `25,000` sats

Update these values in `test-websocket.ts` according to your setup.

## Usage

### WebSocket Chain Swap Test

Run the main WebSocket test with environment variable:

```bash
TEST_MODE=websocket npm run test:websocket
```

Or use the convenience script:

```bash
npm start
```

This will:

- Establish WebSocket connection to Boltz
- Create a chain swap with real-time monitoring
- Listen for swap status updates
- Automatically handle swap progression

### Development Mode

Run in development mode with auto-reload:

```bash
npm run dev
```

## Project Structure

```
├── README.md
├── package.json
├── tsconfig.json
├── pnpm-lock.yaml
├── LICENSE
├── .gitignore
├── test-websocket.ts                 # Main WebSocket test implementation
├── chain-to-chain-swap.service.ts    # Core service implementation
├── boltz-client.ts                   # Boltz API client
├── boltz-websocket-client.ts         # WebSocket client implementation
└── dto/
    ├── chain-swap-response.dto.ts    # Chain swap response DTO
    ├── create-chain-swap.dto.ts      # Create chain swap DTO
    └── swap-tree.dto.ts              # Swap tree DTO
```

## Key Components

### ChainToChainSwapService

The main service class that handles:
- Boltz API integration
- Cryptographic operations
- Transaction construction and signing
- Swap lifecycle management

### BoltzClient

REST API client for Boltz Protocol operations:
- Creating chain swaps
- Retrieving swap information
- Transaction broadcasting

### BoltzWebsocketClient

WebSocket client for real-time updates:
- Swap status monitoring
- Event-driven swap handling
- Connection management

## Testing Scenarios

The project focuses on comprehensive WebSocket-based testing scenarios:

1. **Real-time Swap Monitoring**: WebSocket connection establishment and monitoring
2. **Swap Lifecycle Testing**: Complete swap creation to completion via WebSocket events
3. **Error Handling**: Testing various failure scenarios with real-time updates
4. **Connection Management**: WebSocket reconnection and error recovery
5. **Event-driven Processing**: Automatic swap progression based on WebSocket events

## Debugging

The project includes extensive logging for debugging purposes:

- Swap creation details
- Transaction construction steps
- WebSocket connection status
- Error handling and recovery

## Dependencies

Key dependencies include:

- **boltz-core**: Core Boltz Protocol functionality
- **bitcoinjs-lib**: Bitcoin transaction handling
- **liquidjs-lib**: Liquid network support
- **ws**: WebSocket client implementation
- **axios**: HTTP client for REST API calls

## Development

### Adding New Tests

1. Create a new test file following the existing pattern
2. Import the required services
3. Configure your test parameters
4. Add the test script to `package.json`

### Extending Functionality

The service is designed to be extensible. Key areas for extension:

- Additional swap types
- Enhanced error handling
- Performance monitoring
- Multi-network support

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure Boltz instance is running
2. **Invalid Address**: Verify Bitcoin addresses are valid for regtest
3. **WebSocket Errors**: Check WebSocket URL and network connectivity
4. **Transaction Failures**: Verify sufficient funds and proper fee calculation

### Debug Mode

Enable detailed logging by setting appropriate log levels in the service configuration.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the terms specified in the LICENSE file.

## Support

For issues and questions:
- Check the existing issues in the repository
- Review Boltz Protocol documentation
- Test with a clean regtest environment

---

**Note**: This is a testing and debugging tool. Do not use with mainnet funds or in production environments.
