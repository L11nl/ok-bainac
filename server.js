const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const MY_SECRET_KEY = "123456789_my_secret_password";

async function getBinanceTransactions(apiKey, apiSecret) {
  const url = "https://api.binance.com/sapi/v1/pay/transactions";
  const timestamp = Date.now();
  const queryString = `recvWindow=60000&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', String(apiSecret)).update(queryString).digest('hex');

  try {
    const response = await axios.get(`${url}?${queryString}&signature=${signature}`, {
      headers: {
        'X-MBX-APIKEY': String(apiKey),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    });
    return response.data;
  } catch (error) {
    // هذا السطر هو الذي سيفضح باينانس!
    console.error("❌ Binance Error Details:", error.response ? error.response.data : error.message);
    return null;
  }
}

app.post('/verify-binance', async (req, res) => {
  console.log("====================================");
  console.log("📥 Received request from Railway bot!");
  
  if (req.headers['x-proxy-secret'] !== MY_SECRET_KEY) {
    console.log("❌ Unauthorized Request");
    return res.status(403).json({ success: false, reason: 'unauthorized' });
  }

  console.log("🔑 API Key Received:", req.body.apiKey ? "Yes" : "No");

  const { apiKey, apiSecret, expectedAmount, expectedNote, orderIdToCheck } = req.body;
  const data = await getBinanceTransactions(apiKey, apiSecret);

  if (data && data.data) {
    console.log(`✅ Success from Binance! Found ${data.data.length} transactions.`);
    for (const tx of data.data) {
      const actualAmount = parseFloat(tx.amount || 0);
      const txNote = String(tx.note || '');
      const txOrderId = String(tx.orderId || '');

      if ((orderIdToCheck && orderIdToCheck === txOrderId) || (expectedNote && expectedNote === txNote)) {
        if (actualAmount >= expectedAmount) {
           console.log("🎯 Match found!");
          return res.json({
            success: true, amount: actualAmount,
            method: orderIdToCheck === txOrderId ? 'order_id' : 'note',
            orderId: txOrderId, note: txNote
          });
        }
      }
    }
    console.log("⚠️ No matching transaction found.");
    return res.json({ success: false, reason: 'not_found' });
  } else {
    console.log("❌ Returning api_error to Railway.");
    return res.json({ success: false, reason: 'api_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy running on port ${PORT}`));
