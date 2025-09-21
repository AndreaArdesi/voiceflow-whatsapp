const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const {
  VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID,
  VF_API_KEY, VF_VERSION='production',
  VF_DM_URL='https://general-runtime.voiceflow.com',
  WHATSAPP_VERSION='v17.0', PORT=3000
} = process.env;

app.get('/webhook', (req,res)=>{
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post('/webhook', async (req,res)=>{
  try{
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if(!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body || '';

    const vf = await axios.post(
      `${VF_DM_URL}/state/user/${encodeURIComponent(from)}/interact`,
      { request: { type: 'text', payload: text } },
      { headers: { Authorization: VF_API_KEY, versionID: VF_VERSION } }
    );

    const traces = vf.data?.trace || [];
    const replies = traces
      .filter(t => t.type === 'speak')
      .map(t => (t.payload && (t.payload.message || t.payload.text)) || '')
      .filter(Boolean);

    for(const body of replies){
      await axios.post(
        `https://graph.facebook.com/${WHATSAPP_VERSION}/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: 'whatsapp', to: from, text: { body } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type':'application/json' } }
      );
    }

    res.sendStatus(200);
  }catch(err){
    console.error('ERR', err?.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, ()=> console.log(`webhook listening ${PORT}`));
