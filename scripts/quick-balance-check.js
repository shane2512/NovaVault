const https = require('https');

const data = JSON.stringify({
  jsonrpc: '2.0',
  method: 'eth_call',
  params: [{
    to: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    data: '0x70a082310000000000000000000000005f90f52ffdc875a8d93021c76d2e612a6459df63'
  }, 'latest'],
  id: 1
});

const options = {
  hostname: 'ethereum-sepolia-rpc.publicnode.com',
  port: 443,
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const response = JSON.parse(body);
    const hexValue = response.result;
    const decimalValue = BigInt(hexValue);
    console.log('Raw hex result:', hexValue);
    console.log('Decimal (base units):', decimalValue.toString());
    console.log('USDC amount (÷ 10^6):', Number(decimalValue) / 1000000);
  });
});

req.on('error', (error) => console.error('Error:', error));
req.write(data);
req.end();
