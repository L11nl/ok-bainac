const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// كلمة سر لحماية الوسيط الخاص بك (يمكنك تغييرها لاحقاً)
const MY_SECRET_KEY = "123456789_my_secret_password";

async function getBinanceTransactions(apiKey, apiSecret) {
  try {
    const url = "https://api.binance.com/sapi/v1/pay/transactions";
    const timestamp = Date.now();
    const queryString = `recvWindow=60000&timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', String(apiSecret)).update(queryString).digest('hex');

    const response = await axios.get(`${url}?${queryString}&signature=${signature}`, {
      headers: { 
        'X-MBX-APIKEY': String(apiKey),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    });
    return response.data;
  } catch (error) {
    return null;
  }
}

app.post('/verify-binance', async (req, res) => {
  if (req.headers['x-proxy-secret'] !== MY_SECRET_KEY) {
    return res.status(403).json({ success: false, reason: 'unauthorized' });
  }

  const { apiKey, apiSecret, expectedAmount, expectedNote, orderIdToCheck } = req.body;
  const data = await getBinanceTransactions(apiKey, apiSecret);

  if (data && data.data) {
    for (const tx of data.data) {
      const actualAmount = parseFloat(tx.amount || 0);
      const txNote = String(tx.note || '');
      const txOrderId = String(tx.orderId || '');

      if ((orderIdToCheck && orderIdToCheck === txOrderId) || (expectedNote && expectedNote === txNote)) {
        if (actualAmount >= expectedAmount) {
          return res.json({
            success: true,
            amount: actualAmount,
            method: orderIdToCheck === txOrderId ? 'order_id' : 'note',
            orderId: txOrderId,
            note: txNote
          });
        }
      }
    }
    return res.json({ success: false, reason: 'not_found' });
  } else {
    return res.json({ success: false, reason: 'api_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
