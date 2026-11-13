// Server-side Gemini AI extraction and direct JSON parsing for invoices & line items

export function handleAiStatus(req, res) {
  res.json({ hasServerKey: Boolean(process.env.GEMINI_API_KEY) });
}

export async function handleAiParse(req, res) {
  try {
    const { file, text, apiKey } = req.body || {};
    const effectiveKey = (apiKey && String(apiKey).trim()) || process.env.GEMINI_API_KEY;

    // 1. Direct JSON handling if user uploaded structured JSON or pasted JSON text
    const isJsonFile = file && (file.mimeType === 'application/json' || file.name?.toLowerCase().endsWith('.json'));
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    const isJsonText = !file && (trimmedText.startsWith('[') || trimmedText.startsWith('{'));

    if (isJsonFile || isJsonText) {
      try {
        let jsonStr = '';
        if (file?.data) {
          jsonStr = Buffer.from(file.data, 'base64').toString('utf8');
        } else if (trimmedText) {
          jsonStr = trimmedText;
        }
        const parsed = JSON.parse(jsonStr);
        let rawItems = [];
        let rawClient = null;
        let rawDetails = null;

        if (Array.isArray(parsed)) {
          rawItems = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.items)) rawItems = parsed.items;
          else if (Array.isArray(parsed.products)) rawItems = parsed.products;
          else if (Array.isArray(parsed.itemList)) rawItems = parsed.itemList;
          else if (Array.isArray(parsed.lines)) rawItems = parsed.lines;
          if (parsed.client) rawClient = parsed.client;
          if (parsed.details) rawDetails = parsed.details;
        }

        if (rawItems.length > 0) {
          const items = rawItems.map((item, idx) => ({
            id: (Date.now() + idx).toString(),
            name: String(item.name || item.description || item.title || item.product || ('Item ' + (idx + 1))).trim(),
            hsn: String(item.hsn || item.sac || item.hsnCode || '').trim(),
            quantity: Number(item.quantity || item.qty || 1) || 1,
            unit: String(item.unit || item.uqc || 'Nos').trim() || 'Nos',
            rate: Number(item.rate || item.price || item.unitPrice || 0) || 0,
            discount: Number(item.discount || 0) || 0,
            taxPercent: Number(item.taxPercent ?? item.gst ?? item.tax ?? 18),
            cessPercent: Number(item.cessPercent || 0) || 0,
          }));
          return res.json({
            success: true,
            source: 'json_direct',
            data: { items, client: rawClient, details: rawDetails },
          });
        }
      } catch (jsonErr) {
        // Fall back to Gemini if JSON is custom or unstructured
      }
    }

    // 2. Validate API key
    if (!effectiveKey) {
      return res.status(400).json({
        error: 'Gemini API Key is missing. Please enter your Gemini API key in the modal or set GEMINI_API_KEY environment variable on your server.'
      });
    }

    if (!file && (!text || !String(text).trim())) {
      return res.status(400).json({ error: 'Please upload a document (PDF / Image / JSON) or paste invoice text.' });
    }

    // 3. Build Prompt & Gemini Payload
    const promptText = `You are an expert Indian GST billing and accounting assistant.
Analyze the provided invoice, receipt, purchase order, estimate, product catalog, document or text.
Extract all line items, buyer/client details, and invoice metadata into a valid JSON object.

Output MUST match this schema:
{
  "client": {
    "name": "Buyer/Customer/Party name (null if not found)",
    "gstin": "15-digit GSTIN if found (null if not found)",
    "address": "Full billing or shipping address (null if not found)",
    "phone": "Phone or mobile number (null if not found)",
    "email": "Email address (null if not found)",
    "state": "State name or 2-digit code (null if not found)"
  },
  "details": {
    "invoiceNumber": "Invoice / Bill number if found (null if not found)",
    "invoiceDate": "YYYY-MM-DD date if found (null if not found)",
    "dueDate": "YYYY-MM-DD date if found (null if not found)",
    "placeOfSupply": "Place of supply state name (null if not found)"
  },
  "items": [
    {
      "name": "Item description or product name",
      "hsn": "HSN or SAC code (numeric string, e.g. 8471 or empty string)",
      "quantity": 1,
      "unit": "Unit string (e.g. Nos, Pcs, Kgs, Mtr, Box, Set, Hours, Units)",
      "rate": 100.0,
      "discount": 0,
      "taxPercent": 18,
      "cessPercent": 0
    }
  ],
  "notes": "Any payment terms, note, or remarks if found (null if not found)"
}

Rules:
1. Extract EVERY single line item present.
2. quantity must be a positive number (default 1).
3. rate must be the price per unit without tax (or unit price stated).
4. taxPercent must be a standard GST rate (0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28) or standard Indian tax percentage. Default to 18 if uncertain.
5. Return ONLY pure raw JSON object. Do not wrap in markdown or backticks.`;

    const parts = [
      { text: promptText + (text ? ('\n\nUser Input / Text Content:\n' + text) : '') }
    ];

    if (file && file.data) {
      let mime = file.mimeType || 'image/jpeg';
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.pdf')) mime = 'application/pdf';
      else if (name.endsWith('.png')) mime = 'image/png';
      else if (name.endsWith('.webp')) mime = 'image/webp';
      else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mime = 'image/jpeg';

      parts.push({
        inlineData: {
          mimeType: mime,
          data: file.data,
        }
      });
    }

    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let geminiRes = null;
    let lastError = null;

    for (const m of models) {
      try {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(effectiveKey);
        geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            }
          })
        });
        if (geminiRes.ok) break;
        const errText = await geminiRes.text();
        lastError = new Error('Model ' + m + ' failed (' + geminiRes.status + '): ' + errText);
      } catch (err) {
        lastError = err;
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      return res.status(502).json({ error: lastError?.message || 'Gemini AI API request failed' });
    }

    const resJson = await geminiRes.json();
    const candidateText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return res.status(502).json({ error: 'No content returned by Gemini AI' });
    }

    let clean = candidateText.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    const parsedData = JSON.parse(clean);

    const rawItems = Array.isArray(parsedData.items) ? parsedData.items : [];
    const items = rawItems.map((item, idx) => ({
      id: (Date.now() + idx).toString(),
      name: String(item.name || item.description || ('Item ' + (idx + 1))).trim(),
      hsn: String(item.hsn || item.sac || '').trim(),
      quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
      unit: String(item.unit || 'Nos').trim() || 'Nos',
      rate: Number(item.rate) >= 0 ? Number(item.rate) : 0,
      discount: Number(item.discount) >= 0 ? Number(item.discount) : 0,
      taxPercent: [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28].includes(Number(item.taxPercent))
        ? Number(item.taxPercent)
        : (Number(item.taxPercent) >= 0 ? Number(item.taxPercent) : 18),
      cessPercent: Number(item.cessPercent) >= 0 ? Number(item.cessPercent) : 0,
    }));

    res.json({
      success: true,
      source: 'gemini_ai',
      data: {
        items,
        client: parsedData.client || null,
        details: parsedData.details || null,
        notes: parsedData.notes || null,
      }
    });
  } catch (err) {
    console.error('Gemini parse error:', err);
    res.status(500).json({ error: err.message || 'Server error processing AI extraction' });
  }
}
