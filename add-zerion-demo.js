// Script to add a Zerion connection to your portfolio tracker
// This demonstrates how Zerion provides multi-chain portfolio aggregation

const zerionConnection = {
    id: crypto.randomUUID(),
    type: 'zerion',
    name: 'Vitalik.eth (Demo)',
    walletAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik's public address
    enabled: true
};

// Get existing connections
const existingConnections = JSON.parse(localStorage.getItem('portfolio_connections') || '[]');

// Check if Zerion connection already exists
const hasZerion = existingConnections.some(conn => conn.type === 'zerion');

if (!hasZerion) {
    // Add Zerion connection
    existingConnections.push(zerionConnection);
    localStorage.setItem('portfolio_connections', JSON.stringify(existingConnections));
    console.log('✅ Zerion connection added successfully!');
    console.log('📊 This will fetch balances across 50+ blockchains with ONE API call');
    console.log('🔄 Refresh the page to see it in action');
} else {
    console.log('ℹ️ Zerion connection already exists');
}

// Display what was added
console.log('\n📋 Connection Details:');
console.log('Type: Zerion (Multi-Chain Aggregator)');
console.log('Name:', zerionConnection.name);
console.log('Address:', zerionConnection.walletAddress);
console.log('\n💡 Zerion will automatically fetch:');
console.log('  • ETH, MATIC, ARB, OP, BASE, BSC, AVAX');
console.log('  • SOL, BTC, SUI, APTOS, TON, TRON, XRP');
console.log('  • DeFi positions (staking, LP tokens)');
console.log('  • All ERC20/SPL/TRC20 tokens');
console.log('  • Real-time USD values');
